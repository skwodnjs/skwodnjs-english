const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
const bad = (message, status = 400) => json({ error: message }, status);
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const SESSION_COOKIE = "skwodnjs_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function safeJson(value) {
  try { return JSON.parse(value || "{}"); } catch { return {}; }
}

async function bodyJson(request) {
  try { return await request.json(); } catch { throw new Error("JSON 요청 본문이 필요합니다."); }
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(length = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function derivePasswordHash(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function getPasswordConfig(db) {
  const row = await db.prepare("SELECT value_json FROM app_settings WHERE key = 'auth.password'").first();
  if (!row) throw new Error("인증 설정이 없습니다. 최신 D1 migration을 적용하세요.");
  const config = safeJson(row.value_json);
  if (!config.salt || !config.hash || !config.iterations) throw new Error("인증 설정이 올바르지 않습니다.");
  return config;
}

async function verifyPassword(db, password) {
  const config = await getPasswordConfig(db);
  const actual = await derivePasswordHash(String(password || ""), base64ToBytes(config.salt), Number(config.iterations));
  return constantTimeEqual(actual, base64ToBytes(config.hash));
}

async function makePasswordConfig(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 120000;
  const hash = await derivePasswordHash(password, salt, iterations);
  return { algorithm: "PBKDF2-SHA256", iterations, salt: bytesToBase64(salt), hash: bytesToBase64(hash) };
}

function readCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

function sessionCookie(request, token, maxAge = SESSION_MAX_AGE) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function createSession(db, request) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const createdAt = now();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  await db.prepare("INSERT INTO auth_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)").bind(tokenHash, createdAt, expiresAt).run();
  return sessionCookie(request, token);
}

async function isAuthenticated(db, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return false;
  const tokenHash = await sha256Hex(token);
  const row = await db.prepare("SELECT expires_at FROM auth_sessions WHERE token_hash = ?").bind(tokenHash).first();
  if (!row) return false;
  if (String(row.expires_at) <= now()) {
    await db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(tokenHash).run();
    return false;
  }
  return true;
}

async function login(db, request) {
  const body = await bodyJson(request);
  const password = String(body.password || "");
  if (!await verifyPassword(db, password)) return bad("비밀번호가 올바르지 않습니다.", 401);
  await db.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").bind(now()).run();
  const cookie = await createSession(db, request);
  return json({ authenticated: true }, 200, { "set-cookie": cookie });
}

async function logout(db, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    const tokenHash = await sha256Hex(token);
    await db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return json({ authenticated: false }, 200, { "set-cookie": sessionCookie(request, "", 0) });
}

async function changePassword(db, request) {
  if (!await isAuthenticated(db, request)) return bad("로그인이 필요합니다.", 401);
  const body = await bodyJson(request);
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  if (!await verifyPassword(db, currentPassword)) return bad("현재 비밀번호가 올바르지 않습니다.", 401);
  if (newPassword.length < 4) return bad("새 비밀번호는 4자 이상이어야 합니다.");
  const config = await makePasswordConfig(newPassword);
  const ts = now();
  await db.batch([
    db.prepare("UPDATE app_settings SET value_json = ?, updated_at = ? WHERE key = 'auth.password'").bind(JSON.stringify(config), ts),
    db.prepare("DELETE FROM auth_sessions")
  ]);
  const cookie = await createSession(db, request);
  return json({ authenticated: true }, 200, { "set-cookie": cookie });
}

async function bootstrap(db) {
  const collectionsResult = await db.prepare("SELECT id, kind, name, description, sort_order, settings_json, created_at, updated_at FROM collections ORDER BY CASE kind WHEN 'vocabulary' THEN 0 WHEN 'sentence' THEN 1 ELSE 2 END, sort_order, created_at").all();
  const itemsResult = await db.prepare("SELECT id, collection_id, item_type, primary_text, meaning_text, example_text, notes_text, sort_order, metadata_json, created_at, updated_at FROM study_items ORDER BY collection_id, sort_order, created_at").all();
  const map = new Map((collectionsResult.results || []).map((row) => [row.id, { id: row.id, kind: row.kind, name: row.name, description: row.description, sortOrder: row.sort_order, settings: safeJson(row.settings_json), createdAt: row.created_at, updatedAt: row.updated_at, items: [] }]));
  for (const row of itemsResult.results || []) {
    const collection = map.get(row.collection_id);
    if (!collection) continue;
    collection.items.push({ id: row.id, type: row.item_type, primaryText: row.primary_text, meaning: row.meaning_text, example: row.example_text, notes: row.notes_text, sortOrder: row.sort_order, metadata: safeJson(row.metadata_json), createdAt: row.created_at, updatedAt: row.updated_at });
  }
  return [...map.values()];
}

async function ensureCollection(db, collectionId) {
  return await db.prepare("SELECT id, kind, name FROM collections WHERE id = ?").bind(collectionId).first();
}

async function createCollection(db, request) {
  const body = await bodyJson(request);
  const kind = String(body.kind || "").trim();
  const name = String(body.name || "").trim();
  if (!kind) return bad("목록 종류가 필요합니다.");
  if (!name) return bad("이름을 입력하세요.");
  const collectionId = id();
  const maxRow = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM collections WHERE kind = ?").bind(kind).first();
  const sortOrder = Number(maxRow?.max_sort ?? -1) + 1;
  const ts = now();
  await db.prepare("INSERT INTO collections (id, kind, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(collectionId, kind, name, sortOrder, ts, ts).run();
  return json({ collection: { id: collectionId, kind, name, items: [] } }, 201);
}

async function updateCollection(db, request, collectionId) {
  const body = await bodyJson(request);
  const name = String(body.name || "").trim();
  if (!name) return bad("이름을 입력하세요.");
  const result = await db.prepare("UPDATE collections SET name = ?, updated_at = ? WHERE id = ?").bind(name, now(), collectionId).run();
  if (!result.meta.changes) return bad("목록을 찾을 수 없습니다.", 404);
  return json({ ok: true });
}

async function createItem(db, request, collectionId) {
  const collection = await ensureCollection(db, collectionId);
  if (!collection) return bad("목록을 찾을 수 없습니다.", 404);
  const body = await bodyJson(request);
  const primaryText = String(body.primaryText || "").trim();
  const meaning = String(body.meaning || "").trim();
  const example = String(body.example || "").trim();
  if (!primaryText || !meaning) return bad("내용과 뜻은 필수입니다.");
  const maxRow = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM study_items WHERE collection_id = ?").bind(collectionId).first();
  const itemId = id();
  const sortOrder = Number(maxRow?.max_sort ?? -1) + 1;
  const ts = now();
  await db.prepare("INSERT INTO study_items (id, collection_id, item_type, primary_text, meaning_text, example_text, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(itemId, collectionId, collection.kind, primaryText, meaning, example, sortOrder, ts, ts).run();
  return json({ item: { id: itemId, type: collection.kind, primaryText, meaning, example, sortOrder } }, 201);
}

async function bulkCreateItems(db, request, collectionId) {
  const collection = await ensureCollection(db, collectionId);
  if (!collection) return bad("목록을 찾을 수 없습니다.", 404);
  const body = await bodyJson(request);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return bad("가져올 항목이 없습니다.");
  if (items.length > 5000) return bad("한 번에 최대 5000개까지 가져올 수 있습니다.");
  const maxRow = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM study_items WHERE collection_id = ?").bind(collectionId).first();
  let order = Number(maxRow?.max_sort ?? -1) + 1;
  const ts = now();
  const statements = [];
  for (const source of items) {
    const primaryText = String(source.primaryText || "").trim();
    const meaning = String(source.meaning || "").trim();
    const example = String(source.example || "").trim();
    if (!primaryText || !meaning) continue;
    statements.push(db.prepare("INSERT INTO study_items (id, collection_id, item_type, primary_text, meaning_text, example_text, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id(), collectionId, collection.kind, primaryText, meaning, example, order++, ts, ts));
  }
  if (!statements.length) return bad("유효한 항목이 없습니다.");
  for (let i = 0; i < statements.length; i += 100) await db.batch(statements.slice(i, i + 100));
  return json({ imported: statements.length }, 201);
}

async function updateItem(db, request, itemId) {
  const body = await bodyJson(request);
  const primaryText = String(body.primaryText || "").trim();
  const meaning = String(body.meaning || "").trim();
  const example = String(body.example || "").trim();
  if (!primaryText || !meaning) return bad("내용과 뜻은 필수입니다.");
  const result = await db.prepare("UPDATE study_items SET primary_text = ?, meaning_text = ?, example_text = ?, updated_at = ? WHERE id = ?").bind(primaryText, meaning, example, now(), itemId).run();
  if (!result.meta.changes) return bad("항목을 찾을 수 없습니다.", 404);
  return json({ ok: true });
}

async function deleteItem(db, itemId) {
  const result = await db.prepare("DELETE FROM study_items WHERE id = ?").bind(itemId).run();
  if (!result.meta.changes) return bad("항목을 찾을 수 없습니다.", 404);
  return json({ ok: true });
}

async function handleApi(request, env) {
  if (!env.DB) return bad("Cloudflare D1 binding 'DB'가 설정되지 않았습니다.", 500);
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?|\/+$/g, "");
  const parts = path ? path.split("/") : [];
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "bootstrap") return json({ collections: await bootstrap(env.DB) });
  if (method === "GET" && path === "auth/status") return json({ authenticated: await isAuthenticated(env.DB, request) });
  if (method === "POST" && path === "auth/login") return await login(env.DB, request);
  if (method === "POST" && path === "auth/logout") return await logout(env.DB, request);
  if (method === "POST" && path === "auth/password") return await changePassword(env.DB, request);

  const isMutation = ["POST", "PATCH", "PUT", "DELETE"].includes(method);
  if (isMutation && !await isAuthenticated(env.DB, request)) return bad("로그인이 필요합니다.", 401);

  if (method === "POST" && path === "collections") return await createCollection(env.DB, request);
  if (parts[0] === "collections" && parts[1] && parts.length === 2 && method === "PATCH") return await updateCollection(env.DB, request, parts[1]);
  if (parts[0] === "collections" && parts[1] && parts[2] === "items" && parts.length === 3 && method === "POST") return await createItem(env.DB, request, parts[1]);
  if (parts[0] === "collections" && parts[1] && parts[2] === "items" && parts[3] === "bulk" && parts.length === 4 && method === "POST") return await bulkCreateItems(env.DB, request, parts[1]);
  if (parts[0] === "items" && parts[1] && parts.length === 2 && method === "PATCH") return await updateItem(env.DB, request, parts[1]);
  if (parts[0] === "items" && parts[1] && parts.length === 2 && method === "DELETE") return await deleteItem(env.DB, parts[1]);
  return bad("API 경로를 찾을 수 없습니다.", 404);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return await handleApi(request, env);
      if (!env.ASSETS) return bad("Static asset binding 'ASSETS'가 설정되지 않았습니다.", 500);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return bad(error?.message || "서버 오류가 발생했습니다.", 500);
    }
  }
};