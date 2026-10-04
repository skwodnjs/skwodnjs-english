const PREFS_KEY = "skwodnjs-english:ui:v2";
const $ = (selector) => document.querySelector(selector);
const elements = {
  sidebar: $("#sidebar"), sidebarBackdrop: $("#sidebarBackdrop"), openSidebarButton: $("#openSidebarButton"), closeSidebarButton: $("#closeSidebarButton"),
  newVocabularyButton: $("#newVocabularyButton"), newSentenceButton: $("#newSentenceButton"), vocabularyToggle: $("#vocabularyToggle"), sentenceToggle: $("#sentenceToggle"), vocabularyList: $("#vocabularyList"), sentenceList: $("#sentenceList"), storageNote: $("#storageNote"),
  collectionTitle: $("#collectionTitle"), collectionMeta: $("#collectionMeta"), searchInput: $("#searchInput"), addEntriesButton: $("#addEntriesButton"), primaryHeader: $("#primaryHeader"), entryTableBody: $("#entryTableBody"), emptyState: $("#emptyState"), noCollectionState: $("#noCollectionState"), emptyTitle: $("#emptyTitle"), emptyDescription: $("#emptyDescription"), emptyAddButton: $("#emptyAddButton"),
  collectionDialog: $("#collectionDialog"), collectionForm: $("#collectionForm"), collectionDialogTitle: $("#collectionDialogTitle"), collectionDialogDescription: $("#collectionDialogDescription"), collectionNameInput: $("#collectionNameInput"), collectionSubmitButton: $("#collectionSubmitButton"),
  addEntriesDialog: $("#addEntriesDialog"), addDialogTitle: $("#addDialogTitle"), addDialogDescription: $("#addDialogDescription"), manualTab: $("#manualTab"), csvTab: $("#csvTab"), manualEntryForm: $("#manualEntryForm"), csvPanel: $("#csvPanel"), primaryInputLabel: $("#primaryInputLabel"), primaryInput: $("#primaryInput"), meaningInput: $("#meaningInput"), exampleInput: $("#exampleInput"), csvFileInput: $("#csvFileInput"), fileDrop: $("#fileDrop"), csvFormatHint: $("#csvFormatHint"), csvHeaderHint: $("#csvHeaderHint"), csvResult: $("#csvResult"), importCsvButton: $("#importCsvButton"),
  editEntryDialog: $("#editEntryDialog"), editEntryForm: $("#editEntryForm"), editDialogTitle: $("#editDialogTitle"), editPrimaryLabel: $("#editPrimaryLabel"), editPrimaryInput: $("#editPrimaryInput"), editMeaningInput: $("#editMeaningInput"), editExampleInput: $("#editExampleInput"), deleteEntryButton: $("#deleteEntryButton"), toast: $("#toast")
};

let state = { collections: [], selectedCollectionId: null };
let prefs = loadPrefs();
let collectionDialogMode = "create";
let collectionDialogKind = "vocabulary";
let editingCollectionId = null;
let editingEntryId = null;
let pendingCsvItems = [];
let toastTimer = null;

function loadPrefs() {
  try { return { selectedCollectionId: null, collapsed: { vocabulary: false, sentence: false }, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; }
  catch { return { selectedCollectionId: null, collapsed: { vocabulary: false, sentence: false } }; }
}
function savePrefs() { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
function selectedCollection() { return state.collections.find((item) => item.id === state.selectedCollectionId) || null; }
function kindLabel(kind) { return kind === "sentence" ? "문장" : "단어"; }
function collectionKindLabel(kind) { return kind === "sentence" ? "문장" : "단어장"; }

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `요청에 실패했습니다. (${response.status})`);
  return data;
}

async function loadBootstrap(preserveSelection = true) {
  try {
    const data = await api("/api/bootstrap");
    state.collections = Array.isArray(data.collections) ? data.collections : [];
    const preferred = preserveSelection ? (state.selectedCollectionId || prefs.selectedCollectionId) : null;
    state.selectedCollectionId = state.collections.some((item) => item.id === preferred) ? preferred : (state.collections[0]?.id || null);
    prefs.selectedCollectionId = state.selectedCollectionId;
    savePrefs();
    elements.storageNote.textContent = "Cloudflare D1에 저장됩니다.";
    render();
  } catch (error) {
    elements.storageNote.textContent = "D1 연결이 필요합니다.";
    elements.collectionTitle.textContent = "데이터베이스 연결 필요";
    elements.collectionMeta.textContent = error.message;
    elements.addEntriesButton.disabled = true;
    elements.searchInput.disabled = true;
    elements.entryTableBody.closest(".table-scroll").hidden = true;
    elements.emptyState.hidden = true;
    elements.noCollectionState.hidden = false;
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function render() {
  renderSidebarGroup("vocabulary", elements.vocabularyList, elements.vocabularyToggle);
  renderSidebarGroup("sentence", elements.sentenceList, elements.sentenceToggle);
  const collection = selectedCollection();
  const hasCollection = Boolean(collection);
  elements.noCollectionState.hidden = hasCollection;
  elements.emptyState.hidden = true;
  elements.entryTableBody.closest(".table-scroll").hidden = !hasCollection;
  elements.addEntriesButton.disabled = !hasCollection;
  elements.searchInput.disabled = !hasCollection;
  if (!collection) {
    elements.collectionTitle.textContent = "English Study";
    elements.collectionMeta.textContent = "왼쪽에서 새 단어장이나 새 문장을 만들어 주세요.";
    return;
  }
  const singular = kindLabel(collection.kind);
  elements.collectionTitle.textContent = collection.name;
  elements.collectionMeta.textContent = `${collection.items.length.toLocaleString("ko-KR")}개의 ${singular}`;
  elements.primaryHeader.textContent = singular;
  elements.searchInput.placeholder = `${singular} 검색`;
  renderEntries();
}

function renderSidebarGroup(kind, list, toggle) {
  const collapsed = Boolean(prefs.collapsed?.[kind]);
  toggle.setAttribute("aria-expanded", String(!collapsed));
  list.classList.toggle("collapsed", collapsed);
  const collections = state.collections.filter((item) => item.kind === kind);
  list.innerHTML = collections.map((collection) => `
    <div class="collection-item ${collection.id === state.selectedCollectionId ? "active" : ""}">
      <button class="collection-main" type="button" data-select-collection="${collection.id}">
        <span class="collection-name">${escapeHtml(collection.name)}</span><span class="collection-count">${collection.items.length}</span>
      </button>
      <button class="icon-button collection-menu" type="button" data-rename-collection="${collection.id}" aria-label="${escapeHtml(collection.name)} 이름 수정" title="이름 수정"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.7 6.3 3 3M4 20l4.1-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.1 16 4 20Z"/></svg></button>
    </div>`).join("");
}

function renderEntries() {
  const collection = selectedCollection();
  if (!collection) return;
  const query = elements.searchInput.value.trim().toLocaleLowerCase();
  const items = collection.items.filter((item) => !query || [item.primaryText, item.meaning, item.example].some((value) => String(value || "").toLocaleLowerCase().includes(query)));
  elements.entryTableBody.innerHTML = items.map((item) => {
    const originalIndex = collection.items.findIndex((entry) => entry.id === item.id);
    return `<tr><td class="number-column">${originalIndex + 1}</td><td class="primary-cell">${escapeHtml(item.primaryText)}</td><td>${escapeHtml(item.meaning)}</td><td class="example-cell">${escapeHtml(item.example || "—")}</td><td class="row-actions-column"><button class="icon-button row-action-button" type="button" data-edit-entry="${item.id}" aria-label="수정" title="수정"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.7 6.3 3 3M4 20l4.1-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.1 16 4 20Z"/></svg></button></td></tr>`;
  }).join("");
  const empty = collection.items.length === 0;
  elements.emptyState.hidden = !empty;
  elements.entryTableBody.closest(".table-scroll").hidden = empty;
  elements.emptyTitle.textContent = `아직 ${kindLabel(collection.kind)}이 없습니다`;
  elements.emptyDescription.textContent = "직접 입력하거나 CSV 파일에서 한 번에 추가할 수 있습니다.";
  elements.emptyAddButton.textContent = `첫 ${kindLabel(collection.kind)} 추가하기`;
  if (!empty && items.length === 0) elements.entryTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#8a8a8a;padding:42px 16px;">검색 결과가 없습니다.</td></tr>`;
}

function openCollectionDialog(mode, kind = "vocabulary", id = null) {
  collectionDialogMode = mode;
  collectionDialogKind = kind;
  editingCollectionId = id;
  const collection = state.collections.find((item) => item.id === id);
  const label = collectionKindLabel(collection?.kind || kind);
  elements.collectionDialogTitle.textContent = mode === "create" ? `새 ${label}` : `${label} 이름 수정`;
  elements.collectionDialogDescription.textContent = mode === "create" ? `새 ${label}의 이름을 입력하세요.` : "왼쪽 사이드바에 표시할 이름을 변경합니다.";
  elements.collectionSubmitButton.textContent = mode === "create" ? "만들기" : "저장";
  elements.collectionNameInput.placeholder = kind === "sentence" ? "예: 자주 쓰는 회화 문장" : "예: TOEFL 필수 단어";
  elements.collectionNameInput.value = collection?.name || "";
  elements.collectionDialog.showModal();
  requestAnimationFrame(() => elements.collectionNameInput.focus());
}

function openAddEntriesDialog() {
  const collection = selectedCollection();
  if (!collection) return;
  resetAddDialog();
  const label = kindLabel(collection.kind);
  elements.addDialogTitle.textContent = `${label} 추가`;
  elements.addDialogDescription.textContent = `“${collection.name}”에 ${label}을 추가합니다.`;
  elements.primaryInputLabel.textContent = label;
  elements.primaryInput.placeholder = collection.kind === "sentence" ? "I’m looking forward to it." : "accomplish";
  elements.csvFormatHint.textContent = collection.kind === "sentence" ? "열 형식: sentence, meaning, example" : "열 형식: word, meaning, example";
  elements.csvHeaderHint.textContent = collection.kind === "sentence" ? "sentence,meaning,example 또는 문장,뜻,예문 헤더를 인식합니다." : "word,meaning,example 또는 단어,뜻,예문 헤더를 인식합니다.";
  elements.addEntriesDialog.showModal();
  requestAnimationFrame(() => elements.primaryInput.focus());
}

function resetAddDialog() {
  elements.manualEntryForm.reset();
  elements.csvFileInput.value = "";
  pendingCsvItems = [];
  elements.csvResult.hidden = true;
  elements.importCsvButton.disabled = true;
  setAddMode("manual");
}
function setAddMode(mode) {
  const manual = mode === "manual";
  elements.manualTab.classList.toggle("active", manual); elements.csvTab.classList.toggle("active", !manual);
  elements.manualTab.setAttribute("aria-selected", String(manual)); elements.csvTab.setAttribute("aria-selected", String(!manual));
  elements.manualEntryForm.hidden = !manual; elements.csvPanel.hidden = manual;
}

function parseCsv(text) {
  const rows = []; let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) { if (char === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (char === '"') quoted = false; else field += char; }
    else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function normalizeCsvRows(rows, kind) {
  if (!rows.length) return [];
  const normalize = (value) => value.trim().toLocaleLowerCase().replace(/\s+/g, "");
  const header = rows[0].map(normalize);
  const primaryNames = kind === "sentence" ? ["sentence", "문장", "english", "영어"] : ["word", "단어", "english", "영어"];
  const meaningNames = ["meaning", "뜻", "definition", "의미", "translation", "해석"];
  const exampleNames = ["example", "예문", "example sentence"];
  const pi = header.findIndex((value) => primaryNames.includes(value));
  const mi = header.findIndex((value) => meaningNames.includes(value));
  const ei = header.findIndex((value) => exampleNames.includes(value));
  const hasHeader = pi >= 0 && mi >= 0;
  return rows.slice(hasHeader ? 1 : 0).map((row) => ({ primaryText: (row[hasHeader ? pi : 0] || "").trim(), meaning: (row[hasHeader ? mi : 1] || "").trim(), example: (row[hasHeader && ei >= 0 ? ei : 2] || "").trim() })).filter((item) => item.primaryText && item.meaning);
}

async function handleCsvFile(file) {
  const collection = selectedCollection();
  if (!file || !collection) return;
  try {
    pendingCsvItems = normalizeCsvRows(parseCsv((await file.text()).replace(/^\uFEFF/, "")), collection.kind);
    if (!pendingCsvItems.length) throw new Error("가져올 수 있는 행이 없습니다.");
    elements.csvResult.hidden = false;
    elements.csvResult.textContent = `${file.name}에서 ${pendingCsvItems.length.toLocaleString("ko-KR")}개의 항목을 찾았습니다.`;
    elements.importCsvButton.disabled = false;
  } catch (error) {
    pendingCsvItems = []; elements.csvResult.hidden = false; elements.csvResult.textContent = error.message; elements.importCsvButton.disabled = true;
  }
}

function openEditEntryDialog(id) {
  const collection = selectedCollection();
  const item = collection?.items.find((entry) => entry.id === id);
  if (!item) return;
  editingEntryId = id;
  const label = kindLabel(collection.kind);
  elements.editDialogTitle.textContent = `${label} 수정`;
  elements.editPrimaryLabel.textContent = label;
  elements.editPrimaryInput.value = item.primaryText;
  elements.editMeaningInput.value = item.meaning;
  elements.editExampleInput.value = item.example || "";
  elements.editEntryDialog.showModal();
  requestAnimationFrame(() => elements.editPrimaryInput.focus());
}

function closeMobileSidebar() { elements.sidebar.classList.remove("open"); elements.sidebarBackdrop.classList.remove("show"); }
function toggleGroup(kind) { prefs.collapsed = { ...(prefs.collapsed || {}), [kind]: !prefs.collapsed?.[kind] }; savePrefs(); render(); }

function bindEvents() {
  elements.newVocabularyButton.addEventListener("click", () => openCollectionDialog("create", "vocabulary"));
  elements.newSentenceButton.addEventListener("click", () => openCollectionDialog("create", "sentence"));
  elements.vocabularyToggle.addEventListener("click", () => toggleGroup("vocabulary"));
  elements.sentenceToggle.addEventListener("click", () => toggleGroup("sentence"));
  elements.searchInput.addEventListener("input", renderEntries);
  elements.addEntriesButton.addEventListener("click", openAddEntriesDialog);
  elements.emptyAddButton.addEventListener("click", openAddEntriesDialog);

  [elements.vocabularyList, elements.sentenceList].forEach((list) => list.addEventListener("click", (event) => {
    const select = event.target.closest("[data-select-collection]");
    const rename = event.target.closest("[data-rename-collection]");
    if (select) { state.selectedCollectionId = select.dataset.selectCollection; prefs.selectedCollectionId = state.selectedCollectionId; elements.searchInput.value = ""; savePrefs(); render(); closeMobileSidebar(); }
    else if (rename) { const collection = state.collections.find((item) => item.id === rename.dataset.renameCollection); if (collection) openCollectionDialog("rename", collection.kind, collection.id); }
  }));

  elements.collectionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = elements.collectionNameInput.value.trim(); if (!name) return;
    try {
      if (collectionDialogMode === "create") {
        const result = await api("/api/collections", { method: "POST", body: JSON.stringify({ kind: collectionDialogKind, name }) });
        state.selectedCollectionId = result.collection.id; prefs.selectedCollectionId = result.collection.id;
        showToast(`${collectionKindLabel(collectionDialogKind)}을 만들었습니다.`);
      } else {
        await api(`/api/collections/${editingCollectionId}`, { method: "PATCH", body: JSON.stringify({ name }) });
        state.selectedCollectionId = editingCollectionId; prefs.selectedCollectionId = editingCollectionId;
        showToast("이름을 변경했습니다.");
      }
      savePrefs(); elements.collectionDialog.close(); await loadBootstrap();
    } catch (error) { showToast(error.message); }
  });

  elements.manualTab.addEventListener("click", () => setAddMode("manual"));
  elements.csvTab.addEventListener("click", () => setAddMode("csv"));
  elements.manualEntryForm.addEventListener("submit", async (event) => {
    event.preventDefault(); const collection = selectedCollection(); if (!collection) return;
    const item = { primaryText: elements.primaryInput.value.trim(), meaning: elements.meaningInput.value.trim(), example: elements.exampleInput.value.trim() };
    if (!item.primaryText || !item.meaning) return;
    try { await api(`/api/collections/${collection.id}/items`, { method: "POST", body: JSON.stringify(item) }); elements.manualEntryForm.reset(); await loadBootstrap(); elements.primaryInput.focus(); showToast(`${kindLabel(collection.kind)}을 추가했습니다.`); }
    catch (error) { showToast(error.message); }
  });

  elements.csvFileInput.addEventListener("change", () => handleCsvFile(elements.csvFileInput.files[0]));
  ["dragenter", "dragover"].forEach((type) => elements.fileDrop.addEventListener(type, (event) => { event.preventDefault(); elements.fileDrop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((type) => elements.fileDrop.addEventListener(type, (event) => { event.preventDefault(); elements.fileDrop.classList.remove("dragging"); }));
  elements.fileDrop.addEventListener("drop", (event) => handleCsvFile(event.dataTransfer.files[0]));
  elements.importCsvButton.addEventListener("click", async () => {
    const collection = selectedCollection(); if (!collection || !pendingCsvItems.length) return;
    try { const count = pendingCsvItems.length; await api(`/api/collections/${collection.id}/items/bulk`, { method: "POST", body: JSON.stringify({ items: pendingCsvItems }) }); elements.addEntriesDialog.close(); await loadBootstrap(); showToast(`${count.toLocaleString("ko-KR")}개를 가져왔습니다.`); }
    catch (error) { showToast(error.message); }
  });

  elements.entryTableBody.addEventListener("click", (event) => { const button = event.target.closest("[data-edit-entry]"); if (button) openEditEntryDialog(button.dataset.editEntry); });
  elements.editEntryForm.addEventListener("submit", async (event) => {
    event.preventDefault(); if (!editingEntryId) return;
    try { await api(`/api/items/${editingEntryId}`, { method: "PATCH", body: JSON.stringify({ primaryText: elements.editPrimaryInput.value.trim(), meaning: elements.editMeaningInput.value.trim(), example: elements.editExampleInput.value.trim() }) }); elements.editEntryDialog.close(); await loadBootstrap(); showToast("수정했습니다."); }
    catch (error) { showToast(error.message); }
  });
  elements.deleteEntryButton.addEventListener("click", async () => {
    if (!editingEntryId || !confirm("이 항목을 삭제할까요?")) return;
    try { await api(`/api/items/${editingEntryId}`, { method: "DELETE" }); elements.editEntryDialog.close(); await loadBootstrap(); showToast("삭제했습니다."); }
    catch (error) { showToast(error.message); }
  });

  document.addEventListener("click", (event) => { const close = event.target.closest("[data-close-dialog]"); if (close) document.getElementById(close.dataset.closeDialog)?.close(); });
  elements.openSidebarButton.addEventListener("click", () => { elements.sidebar.classList.add("open"); elements.sidebarBackdrop.classList.add("show"); });
  elements.closeSidebarButton.addEventListener("click", closeMobileSidebar); elements.sidebarBackdrop.addEventListener("click", closeMobileSidebar);
}

bindEvents();
loadBootstrap(false);