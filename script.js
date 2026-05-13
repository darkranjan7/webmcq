const progressKey = "mcq_progress_v1";
const settingsKey = "mcq_settings_v1";

const defaultSettings = {
  theme: "light",
  fontSize: 16,
  fontFamily: "IBM Plex Sans",
  colors: {},
};

const state = {
  questions: [],
  currentIndex: 0,
  progress: loadProgress(),
  settings: loadSettings(),
};

const elements = {
  questionList: document.getElementById("question-list"),
  progressCount: document.getElementById("progress-count"),
  markedCount: document.getElementById("marked-count"),
  progressBar: document.getElementById("progress-bar-fill"),
  questionCounter: document.getElementById("question-counter"),
  questionStatus: document.getElementById("question-status"),
  prevQuestion: document.getElementById("prev-question"),
  nextQuestion: document.getElementById("next-question"),
  resetProgress: document.getElementById("reset-progress"),
  errorMessage: document.getElementById("error-message"),
  menuToggle: document.getElementById("menu-toggle"),
  themeToggle: document.getElementById("theme-toggle"),
  customizeToggle: document.getElementById("customize-toggle"),
  customizePanel: document.getElementById("customize-panel"),
  customizeClose: document.getElementById("customize-close"),
  panelBackdrop: document.getElementById("panel-backdrop"),
  navPanel: document.getElementById("nav-panel"),
  navClose: document.getElementById("nav-close"),
  navGrid: document.getElementById("nav-grid"),
  accentColor: document.getElementById("accent-color"),
  backgroundColor: document.getElementById("background-color"),
  surfaceColor: document.getElementById("surface-color"),
  textColor: document.getElementById("text-color"),
  fontSize: document.getElementById("font-size"),
  fontSizeValue: document.getElementById("font-size-value"),
  fontFamily: document.getElementById("font-family"),
  resetStyle: document.getElementById("reset-style"),
};

const panelState = {
  open: null,
};

applySettings(state.settings, true);
syncControls();
setupEventHandlers();
loadQuestions();

function loadQuestions() {
  fetch("questions.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Unable to load questions");
      }
      return response.json();
    })
    .then((data) => {
      state.questions = Array.isArray(data) ? data : [];
      state.currentIndex = clampIndex(state.progress.lastIndex || 0);
      state.progress.lastIndex = state.currentIndex;
      renderCurrentQuestion();
      renderNavigator();
      updateProgressUI();
    })
    .catch(() => {
      elements.errorMessage.textContent =
        "Unable to load questions. Open this folder with a local server.";
      elements.errorMessage.hidden = false;
    });
}

function renderCurrentQuestion() {
  elements.questionList.innerHTML = "";

  if (!state.questions.length) {
    updateNavUI();
    return;
  }

  const question = state.questions[state.currentIndex];
  const card = buildQuestionCard(question, state.currentIndex);
  elements.questionList.appendChild(card);
  updateQuestionCard(question.id);
  updateNavUI();
}

function buildQuestionCard(question, index) {
  const card = document.createElement("article");
  card.className = "question-card";
  card.dataset.id = question.id;

  const header = document.createElement("div");
  header.className = "question-header";

  const meta = document.createElement("div");
  meta.className = "question-meta";

  const number = document.createElement("span");
  number.className = "question-number";
  number.textContent = `Q${index + 1}`;

  meta.append(number);

  const actions = document.createElement("div");
  actions.className = "question-actions";

  const markButton = document.createElement("button");
  markButton.className = "mark-button";
  markButton.type = "button";
  markButton.setAttribute("aria-label", "Mark question");
  markButton.innerHTML =
    "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z\" fill=\"currentColor\"/></svg><span class=\"mark-label\">Mark</span>";

  actions.append(markButton);
  header.append(meta, actions);

  const title = document.createElement("h2");
  title.className = "question-title";
  title.textContent = question.question;

  const options = document.createElement("div");
  options.className = "options";

  const optionKeys = Object.keys(question.options || {}).sort();
  optionKeys.forEach((key) => {
    const button = document.createElement("button");
    button.className = "option-button";
    button.type = "button";
    button.dataset.option = key;

    const optionKey = document.createElement("span");
    optionKey.className = "option-key";
    optionKey.textContent = key.toUpperCase();

    const optionText = document.createElement("span");
    optionText.className = "option-text";
    optionText.textContent = question.options[key];

    button.append(optionKey, optionText);
    options.appendChild(button);
  });

  const feedback = document.createElement("p");
  feedback.className = "feedback";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");

  card.append(header, title, options, feedback);
  return card;
}

function updateQuestionCard(questionId) {
  const card = elements.questionList.querySelector(
    `.question-card[data-id="${questionId}"]`
  );
  if (!card) {
    return;
  }

  const question = state.questions.find((item) => item.id === questionId);
  if (!question) {
    return;
  }

  const answer = getAnswerState(questionId);
  const revealed = answer.status === "correct" || answer.wrongSelections.length > 0;

  const isMarked = Boolean(state.progress.marked[questionId]);

  card.classList.toggle("marked", isMarked);
  card.classList.toggle("is-correct", answer.status === "correct");

  const markButton = card.querySelector(".mark-button");
  markButton.setAttribute("aria-pressed", String(isMarked));
  const markLabel = markButton.querySelector(".mark-label");
  if (markLabel) {
    markLabel.textContent = isMarked ? "Marked" : "Mark";
  }

  const optionButtons = card.querySelectorAll(".option-button");
  optionButtons.forEach((button) => {
    const optionKey = button.dataset.option;
    button.classList.remove("correct", "wrong");
    button.disabled = answer.status === "correct";

    if (revealed && optionKey === question.correct_answer) {
      button.classList.add("correct");
    }

    if (answer.wrongSelections.includes(optionKey)) {
      button.classList.add("wrong");
    }
  });

  const feedback = card.querySelector(".feedback");
  if (answer.status === "correct") {
    feedback.textContent = answer.wrongSelections.length
      ? "Correct after retry."
      : "Correct on first try.";
  } else if (revealed) {
    feedback.textContent = "Not quite. Try another option.";
  } else {
    feedback.textContent = "";
  }
}

function updateProgressUI() {
  const total = state.questions.length;
  const correctCount = Object.values(state.progress.answers).filter(
    (answer) => answer.status === "correct"
  ).length;
  const markedCount = Object.keys(state.progress.marked).length;

  elements.progressCount.textContent = `${correctCount}/${total} Correct`;
  elements.markedCount.textContent = `${markedCount} Marked`;
  const percent = total ? Math.round((correctCount / total) * 100) : 0;
  elements.progressBar.style.width = `${percent}%`;
}

function getQuestionStatus(questionId) {
  const answer = getAnswerState(questionId);

  if (answer.status === "correct") {
    if (answer.wrongSelections.length === 0) {
      return { label: "Correct", className: "status-correct" };
    }
    return { label: "Not correct on first try", className: "status-retry" };
  }

  if (answer.wrongSelections.length > 0) {
    return { label: "Attempted", className: "status-attempt" };
  }

  return { label: "Not attempted", className: "" };
}

function updateNavUI() {
  const total = state.questions.length;
  const hasQuestions = total > 0;

  elements.prevQuestion.disabled = !hasQuestions || state.currentIndex === 0;
  elements.nextQuestion.disabled =
    !hasQuestions || state.currentIndex === total - 1;

  if (!hasQuestions) {
    elements.questionCounter.textContent = "Question 0 of 0";
    elements.questionStatus.textContent = "";
    elements.questionStatus.className = "status-pill";
    return;
  }

  elements.questionCounter.textContent = `Question ${
    state.currentIndex + 1
  } of ${total}`;
  const status = getQuestionStatus(state.questions[state.currentIndex].id);
  elements.questionStatus.textContent = status.label;
  elements.questionStatus.className = `status-pill ${status.className}`;
}

function renderNavigator() {
  elements.navGrid.innerHTML = "";
  state.questions.forEach((question, index) => {
    const status = getQuestionStatus(question.id);
    const button = document.createElement("button");
    button.className = `nav-button ${status.className}`.trim();
    button.type = "button";
    button.dataset.index = index;
    button.textContent = index + 1;

    if (index === state.currentIndex) {
      button.classList.add("is-current");
    }

    if (state.progress.marked[question.id]) {
      button.classList.add("is-marked");
    }

    elements.navGrid.appendChild(button);
  });
}

function setCurrentIndex(index) {
  const bounded = clampIndex(index);
  state.currentIndex = bounded;
  state.progress.lastIndex = bounded;
  saveProgress();
  renderCurrentQuestion();
  renderNavigator();
}

function clampIndex(index) {
  if (!state.questions.length) {
    return 0;
  }

  return Math.min(Math.max(index, 0), state.questions.length - 1);
}

function handleOptionClick(questionId, optionKey) {
  const question = state.questions.find((item) => item.id === questionId);
  if (!question) {
    return;
  }

  const answer = getAnswerState(questionId);
  if (answer.status === "correct") {
    return;
  }

  if (optionKey === question.correct_answer) {
    answer.status = "correct";
  } else if (!answer.wrongSelections.includes(optionKey)) {
    answer.wrongSelections.push(optionKey);
  }

  state.progress.answers[questionId] = answer;
  saveProgress();
  updateQuestionCard(questionId);
  updateProgressUI();
  renderNavigator();
  updateNavUI();
}

function toggleMark(questionId) {
  if (state.progress.marked[questionId]) {
    delete state.progress.marked[questionId];
  } else {
    state.progress.marked[questionId] = true;
  }

  saveProgress();
  updateQuestionCard(questionId);
  updateProgressUI();
  renderNavigator();
  updateNavUI();
}

function resetProgress() {
  if (!state.questions.length) {
    return;
  }

  const confirmed = window.confirm("Reset all saved progress and marks?");
  if (!confirmed) {
    return;
  }

  state.progress = {
    answers: {},
    marked: {},
    lastIndex: 0,
  };
  state.currentIndex = 0;
  saveProgress();
  renderCurrentQuestion();
  renderNavigator();
  updateProgressUI();
}

function setupEventHandlers() {
  elements.questionList.addEventListener("click", (event) => {
    const optionButton = event.target.closest(".option-button");
    if (optionButton) {
      const card = optionButton.closest(".question-card");
      handleOptionClick(card.dataset.id, optionButton.dataset.option);
      return;
    }

    const markButton = event.target.closest(".mark-button");
    if (markButton) {
      const card = markButton.closest(".question-card");
      toggleMark(card.dataset.id);
    }
  });

  elements.resetProgress.addEventListener("click", resetProgress);

  elements.prevQuestion.addEventListener("click", () =>
    setCurrentIndex(state.currentIndex - 1)
  );
  elements.nextQuestion.addEventListener("click", () =>
    setCurrentIndex(state.currentIndex + 1)
  );

  elements.navGrid.addEventListener("click", (event) => {
    const navButton = event.target.closest(".nav-button");
    if (!navButton) {
      return;
    }
    setCurrentIndex(Number(navButton.dataset.index));
    setPanelState("nav", false);
  });

  elements.themeToggle.addEventListener("click", () => {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    applyTheme(state.settings.theme);
    saveSettings();
    syncControls();
  });

  elements.customizeToggle.addEventListener("click", () =>
    setPanelState("customize", panelState.open !== "customize")
  );
  elements.customizeClose.addEventListener("click", () =>
    setPanelState("customize", false)
  );

  elements.menuToggle.addEventListener("click", () =>
    setPanelState("nav", panelState.open !== "nav")
  );
  elements.navClose.addEventListener("click", () => setPanelState("nav", false));

  elements.panelBackdrop.addEventListener("click", () => {
    if (panelState.open) {
      setPanelState(panelState.open, false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panelState.open) {
      setPanelState(panelState.open, false);
    }
  });

  elements.accentColor.addEventListener("input", () =>
    updateColor("accent", elements.accentColor.value)
  );
  elements.backgroundColor.addEventListener("input", () =>
    updateColor("background", elements.backgroundColor.value)
  );
  elements.surfaceColor.addEventListener("input", () =>
    updateColor("surface", elements.surfaceColor.value)
  );
  elements.textColor.addEventListener("input", () =>
    updateColor("text", elements.textColor.value)
  );

  elements.fontSize.addEventListener("input", () => {
    const value = Number(elements.fontSize.value);
    elements.fontSizeValue.textContent = `${value}px`;
    state.settings.fontSize = value;
    document.documentElement.style.setProperty("--font-size-base", `${value}px`);
    saveSettings();
  });

  elements.fontFamily.addEventListener("change", () => {
    state.settings.fontFamily = elements.fontFamily.value;
    document.documentElement.style.setProperty(
      "--font-body",
      `"${elements.fontFamily.value}"`
    );
    saveSettings();
  });

  elements.resetStyle.addEventListener("click", () => {
    state.settings.colors = {};
    state.settings.fontSize = defaultSettings.fontSize;
    state.settings.fontFamily = defaultSettings.fontFamily;
    applySettings(state.settings, true);
    syncControls();
    saveSettings();
  });
}

function setPanelState(panelName, isOpen) {
  if (isOpen) {
    panelState.open = panelName;
  } else if (panelState.open === panelName) {
    panelState.open = null;
  }

  const panels = {
    customize: elements.customizePanel,
    nav: elements.navPanel,
  };

  Object.entries(panels).forEach(([key, panel]) => {
    const isActive = panelState.open === key;
    panel.classList.toggle("open", isActive);
    panel.setAttribute("aria-hidden", String(!isActive));
  });

  const showBackdrop = Boolean(panelState.open);
  elements.panelBackdrop.classList.toggle("show", showBackdrop);
  elements.panelBackdrop.setAttribute("aria-hidden", String(!showBackdrop));

  elements.customizeToggle.setAttribute(
    "aria-expanded",
    String(panelState.open === "customize")
  );
  elements.menuToggle.setAttribute(
    "aria-expanded",
    String(panelState.open === "nav")
  );
}

function updateColor(key, value) {
  if (!state.settings.colors) {
    state.settings.colors = {};
  }
  state.settings.colors[key] = value;

  const variableMap = {
    accent: "--accent",
    background: "--bg",
    surface: "--surface",
    text: "--text",
  };

  document.documentElement.style.setProperty(variableMap[key], value);
  saveSettings();
}

function applySettings(settings, resetStyles) {
  const resolvedSettings = { ...defaultSettings, ...settings };
  applyTheme(resolvedSettings.theme);

  if (resolvedSettings.fontSize) {
    document.documentElement.style.setProperty(
      "--font-size-base",
      `${resolvedSettings.fontSize}px`
    );
  } else if (resetStyles) {
    document.documentElement.style.removeProperty("--font-size-base");
  }

  if (resolvedSettings.fontFamily) {
    document.documentElement.style.setProperty(
      "--font-body",
      `"${resolvedSettings.fontFamily}"`
    );
  } else if (resetStyles) {
    document.documentElement.style.removeProperty("--font-body");
  }

  const colorMap = {
    accent: "--accent",
    background: "--bg",
    surface: "--surface",
    text: "--text",
  };

  Object.entries(colorMap).forEach(([key, variable]) => {
    const value = resolvedSettings.colors?.[key];
    if (value) {
      document.documentElement.style.setProperty(variable, value);
    } else if (resetStyles) {
      document.documentElement.style.removeProperty(variable);
    }
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  elements.themeToggle.setAttribute(
    "aria-pressed",
    String(theme === "dark")
  );
}

function loadProgress() {
  try {
    const stored = JSON.parse(localStorage.getItem(progressKey));
    return {
      answers: stored?.answers && typeof stored.answers === "object" ? stored.answers : {},
      marked: stored?.marked && typeof stored.marked === "object" ? stored.marked : {},
      lastIndex: Number.isInteger(stored?.lastIndex) ? stored.lastIndex : 0,
    };
  } catch (error) {
    return { answers: {}, marked: {}, lastIndex: 0 };
  }
}

function saveProgress() {
  localStorage.setItem(progressKey, JSON.stringify(state.progress));
}

function loadSettings() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const base = { ...defaultSettings, theme: prefersDark ? "dark" : "light" };

  try {
    const stored = JSON.parse(localStorage.getItem(settingsKey));
    if (!stored) {
      return base;
    }

    return {
      ...base,
      ...stored,
      colors: {
        ...base.colors,
        ...stored.colors,
      },
    };
  } catch (error) {
    return base;
  }
}

function saveSettings() {
  localStorage.setItem(settingsKey, JSON.stringify(state.settings));
}

function getAnswerState(questionId) {
  const existing = state.progress.answers[questionId];
  if (!existing) {
    return { status: "unanswered", wrongSelections: [] };
  }

  return {
    status: existing.status || "unanswered",
    wrongSelections: Array.isArray(existing.wrongSelections)
      ? existing.wrongSelections
      : [],
  };
}

function syncControls() {
  const computed = getComputedStyle(document.documentElement);
  elements.accentColor.value = resolveColorInput(
    state.settings.colors?.accent || computed.getPropertyValue("--accent")
  );
  elements.backgroundColor.value = resolveColorInput(
    state.settings.colors?.background || computed.getPropertyValue("--bg")
  );
  elements.surfaceColor.value = resolveColorInput(
    state.settings.colors?.surface || computed.getPropertyValue("--surface")
  );
  elements.textColor.value = resolveColorInput(
    state.settings.colors?.text || computed.getPropertyValue("--text")
  );

  const fontSizeValue = parseInt(
    computed.getPropertyValue("--font-size-base"),
    10
  );
  elements.fontSize.value = fontSizeValue;
  elements.fontSizeValue.textContent = `${fontSizeValue}px`;
  elements.fontFamily.value = state.settings.fontFamily;
}

function resolveColorInput(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) {
    return trimmed;
  }

  const match = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return "#ffffff";
  }

  const [red, green, blue] = match.slice(1, 4).map((part) =>
    parseInt(part, 10)
  );

  return (
    "#" +
    [red, green, blue]
      .map((part) => part.toString(16).padStart(2, "0"))
      .join("")
  );
}
