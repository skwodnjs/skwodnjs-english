const STORAGE_KEY = "skwodnjs-english:v1";

const $ = (selector) => document.querySelector(selector);
const elements = {
  sidebar: $("#sidebar"), sidebarBackdrop: $("#sidebarBackdrop"), openSidebarButton: $("#openSidebarButton"), closeSidebarButton: $("#closeSidebarButton"),
  newBookButton: $("#newBookButton"), bookList: $("#bookList"), bookTitle: $("#bookTitle"), bookMeta: $("#bookMeta"), renameBookButton: $("#renameBookButton"),
  searchInput: $("#searchInput"), addWordsButton: $("#addWordsButton"), emptyAddButton: $("#emptyAddButton"), wordTableBody: $("#wordTableBody"), emptyState: $("#emptyState"),
  bookDialog: $("#bookDialog"), bookForm: $("#bookForm"), bookDialogTitle: $("#bookDialogTitle"), bookDialogDescription: $("#bookDialogDescription"), bookNameInput: $("#bookNameInput"), bookSubmitButton: $("#bookSubmitButton"),
  addWordsDialog: $("#addWordsDialog"), addWordsBookName: $("#addWordsBookName"), manualTab: $("#manualTab"), csvTab: $("#csvTab"), manualWordForm: $("#manualWordForm"), csvPanel: $("#csvPanel"),
  wordInput: $("#wordInput"), meaningInput: $("#meaningInput"), exampleInput: $("#exampleInput"), csvFileInput: $("#csvFileInput"), fileDrop: $("#fileDrop"), csvResult: $("#csvResult"), importCsvButton: $("#importCsvButton"),
  editWordDialog: $("#editWordDialog"), editWordForm: $("#editWordForm"), editWordInput: $("#editWordInput"), editMeaningInput: $("#editMeaningInput"), editExampleInput: $("#editExampleInput"), deleteWordButton: $("#deleteWordButton"),
  toast: $("#toast")
};

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const sampleState = {
  books: [{
    id: createId(),
    name: "기본 단어장",
    words: [
      { id: createId(), word: "accomplish", meaning: "성취하다, 완수하다", example: "She accomplished everything she planned for the day." },
      { id: createId(), word: "remarkable", meaning: "주목할 만한, 놀라운", example: "The team made remarkable progress in a short time." },
      { id: createId(), word: "precise", meaning: "정확한, 정밀한", example: "Please give me a precise description of the problem." }
    ]
  }],
  selectedBookId: null
};
sampleState.selectedBookId = sampleState.books[0].id;

let state = loadState();
let bookDialogMode = "create";
let editingWordId = null;
let pendingCsvWords = [];
let toastTimer = null;

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.books)) return structuredClone(sampleState);
    if (!parsed.books.length) return structuredClone(sampleState);
    const selectedExists = parsed.books.some((book) => book.id === parsed.selectedBookId);
    return { books: parsed.books, selectedBookId: selectedExists ? parsed.selectedBookId : parsed.books[0].id };
  } catch {
    return structuredClone(sampleState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getSelectedBook() {
  return state.books.find((book) => book.id === state.selectedBookId) || state.books[0] || null;
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function render() {
  const selectedBook = getSelectedBook();
  if (!selectedBook) return;

  elements.bookList.innerHTML = state.books.map((book) => `
    <div class="book-item ${book.id === selectedBook.id ? "active" : ""}" data-book-id="${book.id}">
      <button class="book-main" type="button" data-select-book="${book.id}">
        <span class="book-name">${escapeHtml(book.name)}</span>
        <span class="book-count">${book.words.length}</span>
      </button>
      <button class="icon-button book-menu" type="button" data-rename-book="${book.id}" aria-label="${escapeHtml(book.name)} 이름 수정" title="이름 수정">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.7 6.3 3 3M4 20l4.1-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.1 16 4 20Z"/></svg>
      </button>
    </div>
  `).join("");

  elements.bookTitle.textContent = selectedBook.name;
  elements.bookMeta.textContent = `${selectedBook.words.length.toLocaleString("ko-KR")}개의 단어`;
  elements.addWordsBookName.textContent = `“${selectedBook.name}”에 단어를 추가합니다.`;
  renderWords();
}

function renderWords() {
  const selectedBook = getSelectedBook();
  if (!selectedBook) return;
  const query = elements.searchInput.value.trim().toLocaleLowerCase();
  const words = selectedBook.words.filter((item) => !query || [item.word, item.meaning, item.example].some((value) => String(value || "").toLocaleLowerCase().includes(query)));

  elements.wordTableBody.innerHTML = words.map((item) => {
    const originalIndex = selectedBook.words.findIndex((word) => word.id === item.id);
    return `
      <tr>
        <td class="number-column">${originalIndex + 1}</td>
        <td class="word-cell">${escapeHtml(item.word)}</td>
        <td>${escapeHtml(item.meaning)}</td>
        <td class="example-cell">${escapeHtml(item.example || "—")}</td>
        <td class="row-actions-column">
          <button class="icon-button row-action-button" type="button" data-edit-word="${item.id}" aria-label="${escapeHtml(item.word)} 수정" title="수정">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.7 6.3 3 3M4 20l4.1-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.1 16 4 20Z"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  const noWordsAtAll = selectedBook.words.length === 0;
  elements.emptyState.hidden = !noWordsAtAll;
  elements.wordTableBody.closest(".table-scroll").hidden = noWordsAtAll;
  if (!noWordsAtAll && words.length === 0) {
    elements.wordTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#8a8a8a;padding:42px 16px;">검색 결과가 없습니다.</td></tr>`;
  }
}

function openBookDialog(mode, bookId = null) {
  bookDialogMode = mode;
  const book = state.books.find((item) => item.id === bookId) || getSelectedBook();
  if (mode === "rename" && book) state.selectedBookId = book.id;
  elements.bookDialogTitle.textContent = mode === "create" ? "새 단어장" : "단어장 이름 수정";
  elements.bookDialogDescription.textContent = mode === "create" ? "새 단어장의 이름을 입력하세요." : "사이드바에 표시할 이름을 변경합니다.";
  elements.bookSubmitButton.textContent = mode === "create" ? "만들기" : "저장";
  elements.bookNameInput.value = mode === "rename" && book ? book.name : "";
  elements.bookDialog.showModal();
  requestAnimationFrame(() => elements.bookNameInput.focus());
}

function openAddWordsDialog() {
  const book = getSelectedBook();
  if (!book) return;
  resetAddWordsDialog();
  elements.addWordsDialog.showModal();
  requestAnimationFrame(() => elements.wordInput.focus());
}

function resetAddWordsDialog() {
  elements.manualWordForm.reset();
  elements.csvFileInput.value = "";
  pendingCsvWords = [];
  elements.csvResult.hidden = true;
  elements.csvResult.textContent = "";
  elements.importCsvButton.disabled = true;
  setAddMode("manual");
}

function setAddMode(mode) {
  const manual = mode === "manual";
  elements.manualTab.classList.toggle("active", manual);
  elements.csvTab.classList.toggle("active", !manual);
  elements.manualTab.setAttribute("aria-selected", String(manual));
  elements.csvTab.setAttribute("aria-selected", String(!manual));
  elements.manualWordForm.hidden = !manual;
  elements.manualWordForm.classList.toggle("active", manual);
  elements.csvPanel.hidden = manual;
  elements.csvPanel.classList.toggle("active", !manual);
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
  return rows.filter((item) => item.some((cell) => cell.trim() !== ""));
}

function normalizeCsvRows(rows) {
  if (!rows.length) return [];
  const normalizeHeader = (value) => value.trim().toLocaleLowerCase().replace(/\s+/g, "");
  const header = rows[0].map(normalizeHeader);
  const wordNames = ["word", "단어", "english", "영어"];
  const meaningNames = ["meaning", "뜻", "definition", "의미"];
  const exampleNames = ["example", "예문", "sentence", "문장"];
  const wordIndex = header.findIndex((value) => wordNames.includes(value));
  const meaningIndex = header.findIndex((value) => meaningNames.includes(value));
  const exampleIndex = header.findIndex((value) => exampleNames.includes(value));
  const hasHeader = wordIndex >= 0 && meaningIndex >= 0;
  const start = hasHeader ? 1 : 0;
  const wi = hasHeader ? wordIndex : 0;
  const mi = hasHeader ? meaningIndex : 1;
  const ei = hasHeader ? exampleIndex : 2;

  return rows.slice(start).map((row) => ({
    id: createId(),
    word: (row[wi] || "").trim(),
    meaning: (row[mi] || "").trim(),
    example: ei >= 0 ? (row[ei] || "").trim() : ""
  })).filter((item) => item.word && item.meaning);
}

async function handleCsvFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    pendingCsvWords = normalizeCsvRows(parseCsv(text.replace(/^\uFEFF/, "")));
    if (!pendingCsvWords.length) throw new Error("가져올 수 있는 행이 없습니다.");
    elements.csvResult.hidden = false;
    elements.csvResult.textContent = `${file.name}에서 ${pendingCsvWords.length.toLocaleString("ko-KR")}개의 단어를 찾았습니다.`;
    elements.importCsvButton.disabled = false;
  } catch (error) {
    pendingCsvWords = [];
    elements.csvResult.hidden = false;
    elements.csvResult.textContent = `CSV를 읽지 못했습니다. ${error.message || "파일 형식을 확인하세요."}`;
    elements.importCsvButton.disabled = true;
  }
}

function openEditWordDialog(wordId) {
  const book = getSelectedBook();
  const item = book?.words.find((word) => word.id === wordId);
  if (!item) return;
  editingWordId = item.id;
  elements.editWordInput.value = item.word;
  elements.editMeaningInput.value = item.meaning;
  elements.editExampleInput.value = item.example || "";
  elements.editWordDialog.showModal();
  requestAnimationFrame(() => elements.editWordInput.focus());
}

function closeMobileSidebar() {
  elements.sidebar.classList.remove("open");
  elements.sidebarBackdrop.classList.remove("show");
}

function bindEvents() {
  elements.newBookButton.addEventListener("click", () => openBookDialog("create"));
  elements.renameBookButton.addEventListener("click", () => openBookDialog("rename", state.selectedBookId));
  elements.addWordsButton.addEventListener("click", openAddWordsDialog);
  elements.emptyAddButton.addEventListener("click", openAddWordsDialog);
  elements.searchInput.addEventListener("input", renderWords);

  elements.bookList.addEventListener("click", (event) => {
    const select = event.target.closest("[data-select-book]");
    const rename = event.target.closest("[data-rename-book]");
    if (select) {
      state.selectedBookId = select.dataset.selectBook;
      elements.searchInput.value = "";
      saveState(); render(); closeMobileSidebar();
    } else if (rename) openBookDialog("rename", rename.dataset.renameBook);
  });

  elements.bookForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.bookNameInput.value.trim();
    if (!name) return;
    if (bookDialogMode === "create") {
      const book = { id: createId(), name, words: [] };
      state.books.unshift(book); state.selectedBookId = book.id;
      showToast("새 단어장을 만들었습니다.");
    } else {
      const book = getSelectedBook();
      if (book) book.name = name;
      showToast("단어장 이름을 변경했습니다.");
    }
    saveState(); render(); elements.bookDialog.close();
  });

  elements.manualTab.addEventListener("click", () => setAddMode("manual"));
  elements.csvTab.addEventListener("click", () => setAddMode("csv"));
  elements.manualWordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const book = getSelectedBook();
    if (!book) return;
    const word = elements.wordInput.value.trim(), meaning = elements.meaningInput.value.trim(), example = elements.exampleInput.value.trim();
    if (!word || !meaning) return;
    book.words.push({ id: createId(), word, meaning, example });
    saveState(); render(); elements.manualWordForm.reset(); elements.wordInput.focus(); showToast(`“${word}”을 추가했습니다.`);
  });

  elements.csvFileInput.addEventListener("change", () => handleCsvFile(elements.csvFileInput.files[0]));
  ["dragenter", "dragover"].forEach((type) => elements.fileDrop.addEventListener(type, (event) => { event.preventDefault(); elements.fileDrop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((type) => elements.fileDrop.addEventListener(type, (event) => { event.preventDefault(); elements.fileDrop.classList.remove("dragging"); }));
  elements.fileDrop.addEventListener("drop", (event) => handleCsvFile(event.dataTransfer.files[0]));
  elements.importCsvButton.addEventListener("click", () => {
    const book = getSelectedBook();
    if (!book || !pendingCsvWords.length) return;
    book.words.push(...pendingCsvWords);
    const count = pendingCsvWords.length;
    saveState(); render(); elements.addWordsDialog.close(); showToast(`${count.toLocaleString("ko-KR")}개의 단어를 가져왔습니다.`);
  });

  elements.wordTableBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-word]");
    if (button) openEditWordDialog(button.dataset.editWord);
  });
  elements.editWordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const book = getSelectedBook();
    const item = book?.words.find((word) => word.id === editingWordId);
    if (!item) return;
    item.word = elements.editWordInput.value.trim();
    item.meaning = elements.editMeaningInput.value.trim();
    item.example = elements.editExampleInput.value.trim();
    if (!item.word || !item.meaning) return;
    saveState(); render(); elements.editWordDialog.close(); showToast("단어를 수정했습니다.");
  });
  elements.deleteWordButton.addEventListener("click", () => {
    const book = getSelectedBook();
    const index = book?.words.findIndex((word) => word.id === editingWordId) ?? -1;
    if (!book || index < 0) return;
    const [removed] = book.words.splice(index, 1);
    saveState(); render(); elements.editWordDialog.close(); showToast(`“${removed.word}”을 삭제했습니다.`);
  });

  document.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-dialog]");
    if (!closeButton) return;
    const dialog = document.getElementById(closeButton.dataset.closeDialog);
    dialog?.close();
  });
  document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  }));

  elements.openSidebarButton.addEventListener("click", () => { elements.sidebar.classList.add("open"); elements.sidebarBackdrop.classList.add("show"); });
  elements.closeSidebarButton.addEventListener("click", closeMobileSidebar);
  elements.sidebarBackdrop.addEventListener("click", closeMobileSidebar);
}

bindEvents();
render();