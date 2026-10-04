const $ = (selector) => document.querySelector(selector);
const elements = {
  sidebar: $("#sidebar"), sidebarBackdrop: $("#sidebarBackdrop"), openSidebarButton: $("#openSidebarButton"), closeSidebarButton: $("#closeSidebarButton"),
  newCollectionButton: $("#newCollectionButton"), vocabularyToggle: $("#vocabularyToggle"), sentenceToggle: $("#sentenceToggle"), vocabularyList: $("#vocabularyList"), sentenceList: $("#sentenceList"),
  loggedOutControls: $("#loggedOutControls"), loggedInControls: $("#loggedInControls"), loginButton: $("#loginButton"), changePasswordButton: $("#changePasswordButton"), logoutButton: $("#logoutButton"),
  collectionTitle: $("#collectionTitle"), collectionMeta: $("#collectionMeta"), primaryHeader: $("#primaryHeader"), searchInput: $("#searchInput"), addEntriesButton: $("#addEntriesButton"), entryTableBody: $("#entryTableBody"), emptyState: $("#emptyState"), emptyTitle: $("#emptyTitle"), emptyDescription: $("#emptyDescription"), emptyAddButton: $("#emptyAddButton"), noCollectionState: $("#noCollectionState"), noCollectionDescription: $("#noCollectionDescription"),
  collectionDialog: $("#collectionDialog"), collectionForm: $("#collectionForm"), collectionDialogTitle: $("#collectionDialogTitle"), collectionDialogDescription: $("#collectionDialogDescription"), collectionKindField: $("#collectionKindField"), collectionNameInput: $("#collectionNameInput"), collectionSubmitButton: $("#collectionSubmitButton"),
  addEntriesDialog: $("#addEntriesDialog"), addDialogTitle: $("#addDialogTitle"), addDialogDescription: $("#addDialogDescription"), manualTab: $("#manualTab"), csvTab: $("#csvTab"), manualEntryForm: $("#manualEntryForm"), csvPanel: $("#csvPanel"), primaryInputLabel: $("#primaryInputLabel"), primaryInput: $("#primaryInput"), meaningInput: $("#meaningInput"), exampleInput: $("#exampleInput"), csvFileInput: $("#csvFileInput"), fileDrop: $("#fileDrop"), csvFormatHint: $("#csvFormatHint"), csvHeaderHint: $("#csvHeaderHint"), csvResult: $("#csvResult"), importCsvButton: $("#importCsvButton"),
  editEntryDialog: $("#editEntryDialog"), editEntryForm: $("#editEntryForm"), editDialogTitle: $("#editDialogTitle"), editPrimaryLabel: $("#editPrimaryLabel"), editPrimaryInput: $("#editPrimaryInput"), editMeaningInput: $("#editMeaningInput"), editExampleInput: $("#editExampleInput"), deleteEntryButton: $("#deleteEntryButton"),
  loginDialog: $("#loginDialog"), loginForm: $("#loginForm"), loginPasswordInput: $("#loginPasswordInput"), loginError: $("#loginError"), loginSubmitButton: $("#loginSubmitButton"),
  passwordDialog: $("#passwordDialog"), passwordForm: $("#passwordForm"), currentPasswordInput: $("#currentPasswordInput"), newPasswordInput: $("#newPasswordInput"), confirmPasswordInput: $("#confirmPasswordInput"), passwordError: $("#passwordError"), passwordSubmitButton: $("#passwordSubmitButton"),
  toast: $("#toast")
};

elements.table = elements.entryTableBody.closest("table");
elements.exampleHeader = document.querySelector(".example-column");
elements.exampleInputLabel = document.querySelector('label[for="exampleInput"]');
elements.csvFallbackHint = document.querySelector(".csv-help > div:last-child");
elements.editDialogDescription = document.querySelector("#editEntryDialog .modal-header p");
elements.editExampleLabel = document.querySelector('label[for="editExampleInput"]');

const COLLAPSE_KEY = "skwodnjs-english:sidebar-groups:v1";
let state = { collections: [], selectedId: null, authenticated: false };
let collectionDialogMode = "create";
let editingCollectionId = null;
let editingEntryId = null;
let pendingCsvItems = [];
let toastTimer = null;
let collapsed = loadCollapsedState();
let expandedSentenceIds = new Set();

function loadCollapsedState() {
  try { return { vocabulary: false, sentence: false, ...JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}") }; }
  catch { return { vocabulary: false, sentence: false }; }
}

function saveCollapsedState() {
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
}

function getSelectedCollection() {
  return state.collections.find((collection) => collection.id === state.selectedId) || null;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function escapeHtmlMultiline(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function showFormError(element, message) {
  element.textContent = message;
  element.hidden = !message;
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { credentials: "same-origin", headers: { "content-type": "application/json", ...(options.headers || {}) }, ...options });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    const error = new Error(response.status === 404 && !payload ? "API가 배포되지 않았습니다. Cloudflare Worker 설정을 확인하세요." : payload?.error || `요청에 실패했습니다. (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function reportError(error) {
  console.error(error);
  if (error?.status === 401) {
    state.authenticated = false;
    render();
  }
  showToast(error?.message || "요청에 실패했습니다.");
}

function requireLogin() {
  if (state.authenticated) return true;
  openLoginDialog();
  return false;
}

function renderCollectionList(kind, target) {
  const collections = state.collections.filter((collection) => collection.kind === kind);
  target.innerHTML = collections.map((collection) => `
    <div class="collection-item ${collection.id === state.selectedId ? "active" : ""}" data-collection-id="${collection.id}">
      <button class="collection-main" type="button" data-select-collection="${collection.id}">
        <span class="collection-name">${escapeHtml(collection.name)}</span>
        <span class="collection-count">${collection.items.length}</span>
      </button>
      ${state.authenticated ? `<button class="icon-button collection-menu" type="button" data-rename-collection="${collection.id}" aria-label="${escapeHtml(collection.name)} 이름 수정" title="이름 수정"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.7 6.3 3 3M4 20l4.1-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.1 16 4 20Z"/></svg></button>` : ""}
    </div>`).join("");
}

function renderAuth() {
  elements.loggedOutControls.hidden = state.authenticated;
  elements.loggedInControls.hidden = !state.authenticated;
  elements.newCollectionButton.hidden = !state.authenticated;
}

function renderSidebar() {
  renderCollectionList("vocabulary", elements.vocabularyList);
  renderCollectionList("sentence", elements.sentenceList);
  elements.vocabularyToggle.setAttribute("aria-expanded", String(!collapsed.vocabulary));
  elements.sentenceToggle.setAttribute("aria-expanded", String(!collapsed.sentence));
  elements.vocabularyList.classList.toggle("collapsed", collapsed.vocabulary);
  elements.sentenceList.classList.toggle("collapsed", collapsed.sentence);
  renderAuth();
}

function renderMain() {
  const collection = getSelectedCollection();
  const tableScroll = elements.entryTableBody.closest(".table-scroll");
  if (!collection) {
    elements.collectionTitle.textContent = "English";
    elements.collectionMeta.textContent = state.collections.length ? "왼쪽에서 목록을 선택하세요." : "단어장 또는 문장을 만들어 시작하세요.";
    elements.searchInput.disabled = true;
    elements.addEntriesButton.hidden = true;
    tableScroll.hidden = true;
    elements.emptyState.hidden = true;
    elements.noCollectionState.hidden = false;
    elements.noCollectionDescription.textContent = state.authenticated ? "왼쪽의 새로 만들기 버튼으로 단어장이나 문장을 추가할 수 있습니다." : "로그인 후 새 단어장이나 문장을 만들 수 있습니다.";
    return;
  }

  const isSentence = collection.kind === "sentence";
  elements.collectionTitle.textContent = collection.name;
  elements.collectionMeta.textContent = `${collection.items.length.toLocaleString("ko-KR")}개의 ${isSentence ? "문장" : "단어"}`;
  elements.primaryHeader.textContent = isSentence ? "문장" : "단어";
  elements.exampleHeader.hidden = isSentence;
  elements.table.classList.toggle("sentence-table", isSentence);
  elements.searchInput.placeholder = isSentence ? "문장, 뜻, 해설 검색" : "단어 검색";
  elements.searchInput.disabled = false;
  elements.addEntriesButton.hidden = !state.authenticated;
  elements.emptyTitle.textContent = `아직 ${isSentence ? "문장이" : "단어가"} 없습니다`;
  elements.emptyDescription.textContent = state.authenticated ? `직접 입력하거나 CSV 파일에서 한 번에 ${isSentence ? "문장을" : "단어를"} 추가할 수 있습니다.` : "로그인하면 항목을 추가할 수 있습니다.";
  elements.emptyAddButton.textContent = `첫 ${isSentence ? "문장" : "단어"} 추가하기`;
  elements.emptyAddButton.hidden = !state.authenticated;
  elements.noCollectionState.hidden = true;
  renderEntries();
}

function renderEntries() {
  const collection = getSelectedCollection();
  if (!collection) return;
  const isSentence = collection.kind === "sentence";
  const query = elements.searchInput.value.trim().toLocaleLowerCase();
  const items = collection.items.filter((item) => {
    const searchable = isSentence ? [item.primaryText, item.meaning, item.explanation] : [item.primaryText, item.meaning, item.example];
    return !query || searchable.some((value) => String(value || "").toLocaleLowerCase().includes(query));
  });
  const noItems = collection.items.length === 0;
  const tableScroll = elements.entryTableBody.closest(".table-scroll");
  elements.emptyState.hidden = !noItems;
  tableScroll.hidden = noItems;
  if (noItems) { elements.entryTableBody.innerHTML = ""; return; }
  if (!items.length) {
    elements.entryTableBody.innerHTML = `<tr><td colspan="${isSentence ? 4 : 5}" style="text-align:center;color:#8a8a8a;padding:42px 16px;">검색 결과가 없습니다.</td></tr>`;
    return;
  }

  if (isSentence) {
    elements.entryTableBody.innerHTML = items.map((item) => {
      const originalIndex = collection.items.findIndex((candidate) => candidate.id === item.id);
      const expanded = expandedSentenceIds.has(item.id);
      const explanation = item.explanation || "해설이 없습니다.";
      return `<tr class="sentence-row" data-toggle-explanation="${item.id}" tabindex="0" role="button" aria-expanded="${expanded}" aria-label="${expanded ? "해설 닫기" : "해설 열기"}">
        <td class="number-column">${originalIndex + 1}</td>
        <td class="word-cell"><div class="sentence-primary"><span>${escapeHtml(item.primaryText)}</span><svg class="sentence-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></div></td>
        <td>${escapeHtml(item.meaning)}</td>
        <td class="row-actions-column">${state.authenticated ? `<button class="icon-button row-action-button" type="button" data-edit-entry="${item.id}" aria-label="수정" title="수정"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.7 6.3 3 3M4 20l4.1-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.1 16 4 20Z"/></svg></button>` : ""}</td>
      </tr>${expanded ? `<tr class="sentence-explanation-row"><td colspan="4"><div class="sentence-explanation"><div class="sentence-explanation-label">해설</div><div class="sentence-explanation-body">${escapeHtmlMultiline(explanation)}</div></div></td></tr>` : ""}`;
    }).join("");
    return;
  }

  elements.entryTableBody.innerHTML = items.map((item) => {
    const originalIndex = collection.items.findIndex((candidate) => candidate.id === item.id);
    return `<tr>
      <td class="number-column">${originalIndex + 1}</td>
      <td class="word-cell">${escapeHtml(item.primaryText)}</td>
      <td>${escapeHtml(item.meaning)}</td>
      <td class="example-cell">${escapeHtml(item.example || "—")}</td>
      <td class="row-actions-column">${state.authenticated ? `<button class="icon-button row-action-button" type="button" data-edit-entry="${item.id}" aria-label="수정" title="수정"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.7 6.3 3 3M4 20l4.1-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.1 16 4 20Z"/></svg></button>` : ""}</td>
    </tr>`;
  }).join("");
}

function render() {
  renderSidebar();
  renderMain();
}

async function loadData() {
  try {
    const [data, auth] = await Promise.all([api("/bootstrap"), api("/auth/status")]);
    state.collections = Array.isArray(data?.collections) ? data.collections : [];
    state.authenticated = Boolean(auth?.authenticated);
    if (!state.collections.some((collection) => collection.id === state.selectedId)) state.selectedId = state.collections[0]?.id || null;
    render();
  } catch (error) {
    console.error(error);
    elements.collectionTitle.textContent = "데이터를 불러오지 못했습니다";
    elements.collectionMeta.textContent = error.message;
    elements.addEntriesButton.hidden = true;
    elements.searchInput.disabled = true;
    showToast(error.message);
  }
}

function openLoginDialog() {
  elements.loginForm.reset();
  showFormError(elements.loginError, "");
  elements.loginDialog.showModal();
  requestAnimationFrame(() => elements.loginPasswordInput.focus());
}

function openPasswordDialog() {
  if (!requireLogin()) return;
  elements.passwordForm.reset();
  showFormError(elements.passwordError, "");
  elements.passwordDialog.showModal();
  requestAnimationFrame(() => elements.currentPasswordInput.focus());
}

function openCreateCollectionDialog() {
  if (!requireLogin()) return;
  collectionDialogMode = "create";
  editingCollectionId = null;
  elements.collectionDialogTitle.textContent = "새로 만들기";
  elements.collectionDialogDescription.textContent = "만들 항목의 종류와 이름을 선택하세요.";
  elements.collectionKindField.hidden = false;
  elements.collectionSubmitButton.textContent = "만들기";
  elements.collectionNameInput.value = "";
  const vocabularyRadio = elements.collectionForm.querySelector('input[name="collectionKind"][value="vocabulary"]');
  vocabularyRadio.checked = true;
  updateCollectionPlaceholder();
  elements.collectionDialog.showModal();
  requestAnimationFrame(() => elements.collectionNameInput.focus());
}

function openRenameCollectionDialog(collectionId) {
  if (!requireLogin()) return;
  const collection = state.collections.find((item) => item.id === collectionId);
  if (!collection) return;
  collectionDialogMode = "rename";
  editingCollectionId = collection.id;
  elements.collectionDialogTitle.textContent = "이름 수정";
  elements.collectionDialogDescription.textContent = "사이드바에 표시할 이름을 변경합니다.";
  elements.collectionKindField.hidden = true;
  elements.collectionSubmitButton.textContent = "저장";
  elements.collectionNameInput.value = collection.name;
  elements.collectionDialog.showModal();
  requestAnimationFrame(() => { elements.collectionNameInput.focus(); elements.collectionNameInput.select(); });
}

function updateCollectionPlaceholder() {
  const kind = elements.collectionForm.querySelector('input[name="collectionKind"]:checked')?.value || "vocabulary";
  elements.collectionNameInput.placeholder = kind === "sentence" ? "예: 매일 쓰는 영어 문장" : "예: TOEFL 필수 단어";
}

function resetAddDialog() {
  pendingCsvItems = [];
  elements.manualEntryForm.reset();
  elements.csvFileInput.value = "";
  elements.csvResult.hidden = true;
  elements.csvResult.textContent = "";
  elements.importCsvButton.disabled = true;
  setAddMode("manual");
}

function openAddEntriesDialog() {
  if (!requireLogin()) return;
  const collection = getSelectedCollection();
  if (!collection) return;
  resetAddDialog();
  const isSentence = collection.kind === "sentence";
  const label = isSentence ? "문장" : "단어";
  elements.addDialogTitle.textContent = `${label} 추가`;
  elements.addDialogDescription.textContent = `“${collection.name}”에 ${label}을 추가합니다.`;
  elements.primaryInputLabel.textContent = label;
  elements.primaryInput.placeholder = isSentence ? "I have been looking forward to it." : "accomplish";
  elements.exampleInputLabel.textContent = isSentence ? "해설" : "예문";
  elements.exampleInput.placeholder = isSentence ? "문법, 표현, 뉘앙스 등을 입력하세요" : "예문을 입력하세요";
  elements.csvFormatHint.textContent = isSentence ? "열 형식: sentence, meaning, explanation" : "열 형식: word, meaning, example";
  elements.csvHeaderHint.textContent = isSentence ? "sentence, meaning, explanation 또는 문장, 뜻, 해설 헤더를 인식합니다." : "word, meaning, example 또는 단어, 뜻, 예문 헤더를 인식합니다.";
  elements.csvFallbackHint.textContent = isSentence ? "헤더가 없으면 1열=문장, 2열=뜻, 3열=해설로 가져옵니다." : "헤더가 없으면 1열=내용, 2열=뜻, 3열=예문으로 가져옵니다.";
  elements.addEntriesDialog.showModal();
  requestAnimationFrame(() => elements.primaryInput.focus());
}

function setAddMode(mode) {
  const manual = mode === "manual";
  elements.manualTab.classList.toggle("active", manual);
  elements.csvTab.classList.toggle("active", !manual);
  elements.manualTab.setAttribute("aria-selected", String(manual));
  elements.csvTab.setAttribute("aria-selected", String(!manual));
  elements.manualEntryForm.hidden = !manual;
  elements.csvPanel.hidden = manual;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function normalizeCsvRows(rows, kind) {
  if (!rows.length) return [];
  const normalize = (value) => value.trim().toLocaleLowerCase().replace(/\s+/g, "");
  const header = rows[0].map(normalize);
  const primaryNames = kind === "sentence" ? ["sentence", "문장", "english", "영어"] : ["word", "단어", "english", "영어"];
  const meaningNames = ["meaning", "뜻", "definition", "의미"];
  const detailNames = kind === "sentence"
    ? ["explanation", "commentary", "note", "notes", "해설", "설명", "비고", "example", "예문"]
    : ["example", "예문", "usage", "사용예"];
  const primaryIndex = header.findIndex((value) => primaryNames.includes(value));
  const meaningIndex = header.findIndex((value) => meaningNames.includes(value));
  const detailIndex = header.findIndex((value) => detailNames.includes(value));
  const hasHeader = primaryIndex >= 0 && meaningIndex >= 0;
  const start = hasHeader ? 1 : 0;
  const pi = hasHeader ? primaryIndex : 0;
  const mi = hasHeader ? meaningIndex : 1;
  const di = hasHeader ? detailIndex : 2;
  return rows.slice(start).map((row) => {
    const item = { primaryText: (row[pi] || "").trim(), meaning: (row[mi] || "").trim() };
    const detail = di >= 0 ? (row[di] || "").trim() : "";
    if (kind === "sentence") item.explanation = detail;
    else item.example = detail;
    return item;
  }).filter((item) => item.primaryText && item.meaning);
}

async function handleCsvFile(file) {
  const collection = getSelectedCollection();
  if (!file || !collection) return;
  try {
    const text = await file.text();
    pendingCsvItems = normalizeCsvRows(parseCsv(text.replace(/^\uFEFF/, "")), collection.kind);
    if (!pendingCsvItems.length) throw new Error("가져올 수 있는 행이 없습니다.");
    elements.csvResult.hidden = false;
    elements.csvResult.textContent = `${file.name}에서 ${pendingCsvItems.length.toLocaleString("ko-KR")}개의 항목을 찾았습니다.`;
    elements.importCsvButton.disabled = false;
  } catch (error) {
    pendingCsvItems = [];
    elements.csvResult.hidden = false;
    elements.csvResult.textContent = `CSV를 읽지 못했습니다. ${error.message}`;
    elements.importCsvButton.disabled = true;
  }
}

function openEditEntryDialog(entryId) {
  if (!requireLogin()) return;
  const collection = getSelectedCollection();
  const item = collection?.items.find((entry) => entry.id === entryId);
  if (!item) return;
  editingEntryId = item.id;
  const isSentence = collection.kind === "sentence";
  elements.editDialogTitle.textContent = `${isSentence ? "문장" : "단어"} 수정`;
  elements.editDialogDescription.textContent = isSentence ? "문장, 뜻, 해설을 수정할 수 있습니다." : "단어, 뜻, 예문을 수정할 수 있습니다.";
  elements.editPrimaryLabel.textContent = isSentence ? "문장" : "단어";
  elements.editExampleLabel.textContent = isSentence ? "해설" : "예문";
  elements.editExampleInput.placeholder = isSentence ? "문법, 표현, 뉘앙스 등을 입력하세요" : "예문을 입력하세요";
  elements.editPrimaryInput.value = item.primaryText;
  elements.editMeaningInput.value = item.meaning;
  elements.editExampleInput.value = isSentence ? (item.explanation || "") : (item.example || "");
  elements.editEntryDialog.showModal();
  requestAnimationFrame(() => elements.editPrimaryInput.focus());
}

function closeMobileSidebar() {
  elements.sidebar.classList.remove("open");
  elements.sidebarBackdrop.classList.remove("show");
}

function toggleGroup(kind) {
  collapsed[kind] = !collapsed[kind];
  saveCollapsedState();
  renderSidebar();
}

function toggleSentenceExplanation(entryId) {
  if (expandedSentenceIds.has(entryId)) expandedSentenceIds.delete(entryId);
  else expandedSentenceIds.add(entryId);
  renderEntries();
}

function bindCollectionList(target) {
  target.addEventListener("click", (event) => {
    const select = event.target.closest("[data-select-collection]");
    const rename = event.target.closest("[data-rename-collection]");
    if (rename) { openRenameCollectionDialog(rename.dataset.renameCollection); return; }
    if (select) {
      state.selectedId = select.dataset.selectCollection;
      expandedSentenceIds.clear();
      elements.searchInput.value = "";
      render();
      closeMobileSidebar();
    }
  });
}

function bindEvents() {
  elements.loginButton.addEventListener("click", openLoginDialog);
  elements.changePasswordButton.addEventListener("click", openPasswordDialog);
  elements.logoutButton.addEventListener("click", async () => {
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
      state.authenticated = false;
      render();
      showToast("로그아웃했습니다.");
    } catch (error) { reportError(error); }
  });

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showFormError(elements.loginError, "");
    elements.loginSubmitButton.disabled = true;
    try {
      const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ password: elements.loginPasswordInput.value }) });
      state.authenticated = Boolean(data?.authenticated);
      elements.loginDialog.close();
      render();
      showToast("로그인했습니다.");
    } catch (error) {
      showFormError(elements.loginError, error.message);
      elements.loginPasswordInput.select();
    } finally { elements.loginSubmitButton.disabled = false; }
  });

  elements.passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showFormError(elements.passwordError, "");
    const currentPassword = elements.currentPasswordInput.value;
    const newPassword = elements.newPasswordInput.value;
    const confirmPassword = elements.confirmPasswordInput.value;
    if (newPassword !== confirmPassword) { showFormError(elements.passwordError, "새 비밀번호가 서로 일치하지 않습니다."); return; }
    if (newPassword.length < 4) { showFormError(elements.passwordError, "새 비밀번호는 4자 이상이어야 합니다."); return; }
    elements.passwordSubmitButton.disabled = true;
    try {
      await api("/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      state.authenticated = true;
      elements.passwordDialog.close();
      render();
      showToast("비밀번호를 변경했습니다.");
    } catch (error) {
      if (error?.status === 401 && error.message === "로그인이 필요합니다.") state.authenticated = false;
      showFormError(elements.passwordError, error.message);
      render();
    } finally { elements.passwordSubmitButton.disabled = false; }
  });

  elements.newCollectionButton.addEventListener("click", openCreateCollectionDialog);
  elements.collectionForm.querySelectorAll('input[name="collectionKind"]').forEach((radio) => radio.addEventListener("change", updateCollectionPlaceholder));
  elements.vocabularyToggle.addEventListener("click", () => toggleGroup("vocabulary"));
  elements.sentenceToggle.addEventListener("click", () => toggleGroup("sentence"));
  bindCollectionList(elements.vocabularyList);
  bindCollectionList(elements.sentenceList);
  elements.searchInput.addEventListener("input", renderEntries);
  elements.addEntriesButton.addEventListener("click", openAddEntriesDialog);
  elements.emptyAddButton.addEventListener("click", openAddEntriesDialog);

  elements.collectionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireLogin()) return;
    const name = elements.collectionNameInput.value.trim();
    if (!name) return;
    elements.collectionSubmitButton.disabled = true;
    try {
      if (collectionDialogMode === "create") {
        const kind = elements.collectionForm.querySelector('input[name="collectionKind"]:checked')?.value || "vocabulary";
        const data = await api("/collections", { method: "POST", body: JSON.stringify({ kind, name }) });
        state.collections.push({ ...data.collection, items: data.collection.items || [] });
        state.selectedId = data.collection.id;
        expandedSentenceIds.clear();
        collapsed[kind] = false;
        saveCollapsedState();
        showToast(`${kind === "sentence" ? "문장" : "단어장"}을 만들었습니다.`);
      } else {
        const collection = state.collections.find((item) => item.id === editingCollectionId);
        if (!collection) return;
        await api(`/collections/${collection.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
        collection.name = name;
        showToast("이름을 변경했습니다.");
      }
      elements.collectionDialog.close();
      render();
    } catch (error) { reportError(error); }
    finally { elements.collectionSubmitButton.disabled = false; }
  });

  elements.manualTab.addEventListener("click", () => setAddMode("manual"));
  elements.csvTab.addEventListener("click", () => setAddMode("csv"));
  elements.manualEntryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireLogin()) return;
    const collection = getSelectedCollection();
    if (!collection) return;
    const detail = elements.exampleInput.value.trim();
    const payload = { primaryText: elements.primaryInput.value.trim(), meaning: elements.meaningInput.value.trim() };
    if (collection.kind === "sentence") payload.explanation = detail;
    else payload.example = detail;
    if (!payload.primaryText || !payload.meaning) return;
    const submit = elements.manualEntryForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const data = await api(`/collections/${collection.id}/items`, { method: "POST", body: JSON.stringify(payload) });
      collection.items.push(data.item);
      elements.manualEntryForm.reset();
      render();
      elements.primaryInput.focus();
      showToast("추가했습니다.");
    } catch (error) { reportError(error); }
    finally { submit.disabled = false; }
  });

  elements.csvFileInput.addEventListener("change", () => handleCsvFile(elements.csvFileInput.files[0]));
  ["dragenter", "dragover"].forEach((type) => elements.fileDrop.addEventListener(type, (event) => { event.preventDefault(); elements.fileDrop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((type) => elements.fileDrop.addEventListener(type, (event) => { event.preventDefault(); elements.fileDrop.classList.remove("dragging"); }));
  elements.fileDrop.addEventListener("drop", (event) => handleCsvFile(event.dataTransfer.files[0]));
  elements.importCsvButton.addEventListener("click", async () => {
    if (!requireLogin()) return;
    const collection = getSelectedCollection();
    if (!collection || !pendingCsvItems.length) return;
    elements.importCsvButton.disabled = true;
    try {
      const data = await api(`/collections/${collection.id}/items/bulk`, { method: "POST", body: JSON.stringify({ items: pendingCsvItems }) });
      elements.addEntriesDialog.close();
      await loadData();
      showToast(`${data.imported.toLocaleString("ko-KR")}개를 가져왔습니다.`);
    } catch (error) { reportError(error); elements.importCsvButton.disabled = false; }
  });

  elements.entryTableBody.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-entry]");
    if (editButton) { openEditEntryDialog(editButton.dataset.editEntry); return; }
    const sentenceRow = event.target.closest("[data-toggle-explanation]");
    if (sentenceRow) toggleSentenceExplanation(sentenceRow.dataset.toggleExplanation);
  });

  elements.entryTableBody.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const sentenceRow = event.target.closest("[data-toggle-explanation]");
    if (!sentenceRow) return;
    event.preventDefault();
    toggleSentenceExplanation(sentenceRow.dataset.toggleExplanation);
  });

  elements.editEntryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireLogin()) return;
    const collection = getSelectedCollection();
    const item = collection?.items.find((entry) => entry.id === editingEntryId);
    if (!item) return;
    const detail = elements.editExampleInput.value.trim();
    const payload = { primaryText: elements.editPrimaryInput.value.trim(), meaning: elements.editMeaningInput.value.trim() };
    if (collection.kind === "sentence") payload.explanation = detail;
    else payload.example = detail;
    try {
      await api(`/items/${item.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      Object.assign(item, payload);
      elements.editEntryDialog.close();
      render();
      showToast("수정했습니다.");
    } catch (error) { reportError(error); }
  });

  elements.deleteEntryButton.addEventListener("click", async () => {
    if (!requireLogin()) return;
    const collection = getSelectedCollection();
    const item = collection?.items.find((entry) => entry.id === editingEntryId);
    if (!item || !confirm("이 항목을 삭제할까요?")) return;
    try {
      await api(`/items/${item.id}`, { method: "DELETE" });
      collection.items = collection.items.filter((entry) => entry.id !== item.id);
      expandedSentenceIds.delete(item.id);
      elements.editEntryDialog.close();
      render();
      showToast("삭제했습니다.");
    } catch (error) { reportError(error); }
  });

  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => $("#" + button.dataset.closeDialog)?.close()));
  elements.openSidebarButton.addEventListener("click", () => { elements.sidebar.classList.add("open"); elements.sidebarBackdrop.classList.add("show"); });
  elements.closeSidebarButton.addEventListener("click", closeMobileSidebar);
  elements.sidebarBackdrop.addEventListener("click", closeMobileSidebar);
}

bindEvents();
loadData();