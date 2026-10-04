(() => {
  const practiceButton = document.querySelector("#practiceButton");
  const dialog = document.querySelector("#practiceDialog");
  const title = document.querySelector("#practiceDialogTitle");
  const description = document.querySelector("#practiceDialogDescription");
  const setupPanel = document.querySelector("#practiceSetupPanel");
  const tableOptions = document.querySelector("#practiceTableOptions");
  const countInput = document.querySelector("#practiceCountInput");
  const allCheckbox = document.querySelector("#practiceAllCheckbox");
  const countHint = document.querySelector("#practiceCountHint");
  const setupError = document.querySelector("#practiceSetupError");
  const startButton = document.querySelector("#startPracticeButton");

  const singlePanel = document.querySelector("#singlePracticePanel");
  const singleProgress = document.querySelector("#singlePracticeProgress");
  const singleScore = document.querySelector("#singlePracticeScore");
  const singleProgressBar = document.querySelector("#singlePracticeProgressBar");
  const singleWord = document.querySelector("#singlePracticeWord");
  const singleForm = document.querySelector("#singlePracticeForm");
  const singleAnswer = document.querySelector("#singlePracticeAnswer");
  const singleResult = document.querySelector("#singlePracticeResult");
  const singleUserAnswer = document.querySelector("#singlePracticeUserAnswer");
  const singleCorrectAnswer = document.querySelector("#singlePracticeCorrectAnswer");
  const singleResultStatus = document.querySelector("#singlePracticeResultStatus");
  const singleNextButton = document.querySelector("#singlePracticeNextButton");

  const tablePanel = document.querySelector("#tablePracticePanel");
  const tableMeta = document.querySelector("#tablePracticeMeta");
  const tableScore = document.querySelector("#tablePracticeScore");
  const tableBody = document.querySelector("#tablePracticeBody");
  const backButton = document.querySelector("#practiceBackButton");
  const tableSubmitButton = document.querySelector("#tablePracticeSubmitButton");

  const summaryPanel = document.querySelector("#practiceSummaryPanel");
  const summaryText = document.querySelector("#practiceSummaryText");
  const setupAgainButton = document.querySelector("#practiceSetupAgainButton");
  const retryButton = document.querySelector("#practiceRetryButton");

  let practice = freshPracticeState();

  function freshPracticeState() {
    return {
      mode: null,
      items: [],
      index: 0,
      exactMatches: 0,
      answered: false,
      lastAnswer: "",
      tableRows: [],
      tableSubmitted: false,
      tableExactMatches: 0,
      requestedCount: null
    };
  }

  function getVocabulary() {
    const collection = getSelectedCollection();
    return collection?.kind === "vocabulary" ? collection : null;
  }

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function normalizeAnswer(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase();
  }

  function isExact(left, right) {
    return normalizeAnswer(left) === normalizeAnswer(right);
  }

  function setSetupError(message) {
    setupError.textContent = message;
    setupError.hidden = !message;
  }

  function hidePanels() {
    setupPanel.hidden = true;
    singlePanel.hidden = true;
    tablePanel.hidden = true;
    summaryPanel.hidden = true;
  }

  function updatePracticeButton() {
    const collection = getVocabulary();
    practiceButton.hidden = !collection;
    if (!collection) return;
    practiceButton.disabled = collection.items.length === 0;
    practiceButton.title = collection.items.length ? "" : "연습할 단어가 없습니다.";
  }

  const originalRenderMain = renderMain;
  renderMain = function (...args) {
    const result = originalRenderMain.apply(this, args);
    updatePracticeButton();
    return result;
  };

  function openPractice() {
    const collection = getVocabulary();
    if (!collection) return;

    if (!collection.items.length) {
      showToast("연습할 단어가 없습니다.");
      return;
    }

    practice = freshPracticeState();
    hidePanels();
    setupPanel.hidden = false;
    setSetupError("");

    title.textContent = `${collection.name} 연습`;
    description.textContent = `${collection.items.length.toLocaleString("ko-KR")}개의 단어 중에서 연습합니다.`;

    const singleRadio = document.querySelector('input[name="practiceType"][value="single"]');
    singleRadio.checked = true;
    tableOptions.hidden = true;

    allCheckbox.checked = false;
    countInput.disabled = false;
    countInput.min = "1";
    countInput.max = String(collection.items.length);
    countInput.value = String(Math.min(10, collection.items.length));
    countHint.textContent = `1~${collection.items.length.toLocaleString("ko-KR")}개까지 선택할 수 있습니다.`;

    dialog.showModal();
  }

  function syncTypeOptions() {
    const mode = document.querySelector('input[name="practiceType"]:checked')?.value || "single";
    tableOptions.hidden = mode !== "table";
    setSetupError("");
  }

  function syncCountMode() {
    const all = allCheckbox.checked;
    countInput.disabled = all;

    if (all) {
      countInput.value = "";
    } else if (!countInput.value) {
      const total = getVocabulary()?.items.length || 1;
      countInput.value = String(Math.min(10, total));
    }

    setSetupError("");
  }

  function readRequestedCount(total) {
    if (allCheckbox.checked) return total;

    const raw = countInput.value.trim();
    const value = Number(raw);

    if (!raw || !Number.isInteger(value) || value < 1) {
      setSetupError("문제 수를 1개 이상 입력하세요.");
      return null;
    }

    if (value > total) {
      setSetupError(`단어장에는 ${total.toLocaleString("ko-KR")}개의 단어만 있습니다.`);
      return null;
    }

    return value;
  }

  function startFromSetup() {
    const collection = getVocabulary();
    if (!collection?.items.length) return;

    setSetupError("");
    practice.mode = document.querySelector('input[name="practiceType"]:checked')?.value || "single";

    if (practice.mode === "single") {
      practice.items = shuffle(collection.items);
      practice.index = 0;
      practice.exactMatches = 0;
      practice.answered = false;
      practice.lastAnswer = "";
      hidePanels();
      singlePanel.hidden = false;
      renderSingle();
      return;
    }

    const count = readRequestedCount(collection.items.length);
    if (count == null) return;

    practice.requestedCount = count;
    buildTableRound(collection, count);
    hidePanels();
    tablePanel.hidden = false;
    renderTable();
  }

  function renderSingle() {
    const total = practice.items.length;
    const index = practice.index;

    if (index >= total) {
      hidePanels();
      summaryPanel.hidden = false;
      summaryText.textContent = `${total.toLocaleString("ko-KR")}개를 모두 풀었습니다. 입력한 답이 정답 문자열과 정확히 일치한 항목은 ${practice.exactMatches.toLocaleString("ko-KR")}개입니다.`;
      return;
    }

    const item = practice.items[index];

    singleProgress.textContent = `${index + 1} / ${total}`;
    singleScore.textContent = `정답 일치 ${practice.exactMatches}`;
    singleProgressBar.style.width = `${((index + 1) / total) * 100}%`;
    singleWord.textContent = item.primaryText;

    singleForm.hidden = practice.answered;
    singleResult.hidden = !practice.answered;

    if (!practice.answered) {
      singleForm.reset();
      requestAnimationFrame(() => singleAnswer.focus());
      return;
    }

    const exact = isExact(practice.lastAnswer, item.meaning);
    singleUserAnswer.textContent = practice.lastAnswer || "—";
    singleCorrectAnswer.textContent = item.meaning;
    singleResultStatus.textContent = exact
      ? "정답과 입력한 답이 일치합니다."
      : "정답과 본인의 답을 비교해 보세요.";
    singleResultStatus.classList.toggle("matched", exact);
    singleNextButton.textContent = index === total - 1 ? "결과 보기" : "다음";
    requestAnimationFrame(() => singleNextButton.focus());
  }

  function submitSingle() {
    if (practice.answered) return;

    const item = practice.items[practice.index];
    if (!item) return;

    practice.lastAnswer = singleAnswer.value.trim();
    practice.answered = true;
    if (isExact(practice.lastAnswer, item.meaning)) practice.exactMatches += 1;
    renderSingle();
  }

  function nextSingle() {
    if (!practice.answered) return;
    practice.index += 1;
    practice.answered = false;
    practice.lastAnswer = "";
    renderSingle();
  }

  function buildTableRound(collection, count) {
    const selected = shuffle(collection.items).slice(0, count);
    const blankTypes = shuffle(
      Array.from({ length: count }, (_, index) => index % 2 === 0 ? "meaning" : "word")
    );

    practice.tableRows = selected.map((item, index) => ({
      item,
      blank: blankTypes[index],
      userAnswer: "",
      exact: false
    }));
    practice.tableSubmitted = false;
    practice.tableExactMatches = 0;
  }

  function blankCell(index, correctAnswer, userAnswer, exact, label) {
    if (!practice.tableSubmitted) {
      return `<input class="practice-answer-input" type="text" autocomplete="off" data-practice-row="${index}" aria-label="${escapeHtml(label)} 답" value="${escapeHtml(userAnswer)}" placeholder="답 입력">`;
    }

    return `<div class="table-answer-result ${exact ? "matched" : ""}">
      <div><span>내 답</span><strong>${escapeHtml(userAnswer || "—")}</strong></div>
      <div class="table-correct-answer"><span>정답</span><strong>${escapeHtml(correctAnswer)}</strong></div>
    </div>`;
  }

  function renderTable() {
    const rows = practice.tableRows;

    tableMeta.textContent = `${rows.length.toLocaleString("ko-KR")}문제 · 영어/뜻 무작위 빈칸`;
    tableScore.textContent = practice.tableSubmitted
      ? `정답 일치 ${practice.tableExactMatches} / ${rows.length}`
      : "";

    tableBody.innerHTML = rows.map((row, index) => {
      const wordCell = row.blank === "word"
        ? blankCell(index, row.item.primaryText, row.userAnswer, row.exact, "영어 단어")
        : `<span class="practice-given-answer">${escapeHtml(row.item.primaryText)}</span>`;

      const meaningCell = row.blank === "meaning"
        ? blankCell(index, row.item.meaning, row.userAnswer, row.exact, "뜻")
        : `<span class="practice-given-answer">${escapeHtml(row.item.meaning)}</span>`;

      return `<tr>
        <td class="number-column">${index + 1}</td>
        <td>${wordCell}</td>
        <td>${meaningCell}</td>
      </tr>`;
    }).join("");

    tableSubmitButton.textContent = practice.tableSubmitted ? "다시 풀기" : "전체 제출";

    if (!practice.tableSubmitted) {
      requestAnimationFrame(() => tableBody.querySelector("input")?.focus());
    }
  }

  function syncTableAnswers() {
    tableBody.querySelectorAll("[data-practice-row]").forEach((input) => {
      const index = Number(input.dataset.practiceRow);
      if (practice.tableRows[index]) practice.tableRows[index].userAnswer = input.value.trim();
    });
  }

  function submitTable() {
    if (practice.tableSubmitted) return;

    syncTableAnswers();
    let exactMatches = 0;

    for (const row of practice.tableRows) {
      const correct = row.blank === "word" ? row.item.primaryText : row.item.meaning;
      row.exact = isExact(row.userAnswer, correct);
      if (row.exact) exactMatches += 1;
    }

    practice.tableExactMatches = exactMatches;
    practice.tableSubmitted = true;
    renderTable();
  }

  function showSetup() {
    hidePanels();
    setupPanel.hidden = false;
    setSetupError("");
  }

  function retry() {
    const collection = getVocabulary();
    if (!collection || !practice.mode) {
      showSetup();
      return;
    }

    if (practice.mode === "single") {
      practice.items = shuffle(collection.items);
      practice.index = 0;
      practice.exactMatches = 0;
      practice.answered = false;
      practice.lastAnswer = "";
      hidePanels();
      singlePanel.hidden = false;
      renderSingle();
      return;
    }

    const count = Math.min(practice.requestedCount || collection.items.length, collection.items.length);
    buildTableRound(collection, count);
    hidePanels();
    tablePanel.hidden = false;
    renderTable();
  }

  practiceButton.addEventListener("click", openPractice);

  document.querySelectorAll('input[name="practiceType"]').forEach((radio) => {
    radio.addEventListener("change", syncTypeOptions);
  });

  allCheckbox.addEventListener("change", syncCountMode);
  countInput.addEventListener("input", () => setSetupError(""));
  startButton.addEventListener("click", startFromSetup);

  singleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitSingle();
  });

  singleNextButton.addEventListener("click", nextSingle);

  tableBody.addEventListener("input", (event) => {
    const input = event.target.closest("[data-practice-row]");
    if (!input) return;
    const index = Number(input.dataset.practiceRow);
    if (practice.tableRows[index]) practice.tableRows[index].userAnswer = input.value;
  });

  tableSubmitButton.addEventListener("click", () => {
    if (practice.tableSubmitted) retry();
    else submitTable();
  });

  backButton.addEventListener("click", showSetup);
  setupAgainButton.addEventListener("click", showSetup);
  retryButton.addEventListener("click", retry);

  updatePracticeButton();
})();