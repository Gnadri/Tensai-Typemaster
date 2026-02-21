const QUIZ_FOCUS_STORAGE_KEY = 'tensai-note.quiz-focus.v1';

const STORAGE_KEY_CANDIDATES = [
  QUIZ_FOCUS_STORAGE_KEY,
  `@${QUIZ_FOCUS_STORAGE_KEY}`,
  `@AsyncStorage:${QUIZ_FOCUS_STORAGE_KEY}`,
  `@react-native-async-storage:${QUIZ_FOCUS_STORAGE_KEY}`,
];

const JLPT_DATASET = [
  { kana: '日', answers: ['nichi', 'jitsu', 'hi', 'bi'], meanings: ['day', 'sun'] },
  { kana: '人', answers: ['jin', 'nin', 'hito'], meanings: ['person', 'human'] },
  { kana: '年', answers: ['nen', 'toshi'], meanings: ['year'] },
  { kana: '本', answers: ['hon', 'moto'], meanings: ['book'] },
  { kana: '学', answers: ['gaku', 'manabu'], meanings: ['study', 'learn'] },
  { kana: '生', answers: ['sei', 'shou', 'i', 'u', 'nama'], meanings: ['life', 'birth'] },
  { kana: '時', answers: ['ji', 'toki'], meanings: ['time', 'hour'] },
  { kana: '見', answers: ['ken', 'mi', 'miru'], meanings: ['see', 'look'] },
  { kana: '行', answers: ['kou', 'gyou', 'i', 'yu', 'okona'], meanings: ['go'] },
  { kana: '語', answers: ['go', 'kata', 'kataru'], meanings: ['language', 'word'] },
  { kana: '読', answers: ['doku', 'toku', 'yomu'], meanings: ['read'] },
  { kana: '書', answers: ['sho', 'kaku'], meanings: ['write'] },
];

const normalizeRomaji = (value) =>
  `${value || ''}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z]/g, '');

const shuffleQuiz = (items) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

function createCharacterQueue(items) {
  const pool = [...items];
  let currentCycle = shuffleQuiz([...items]);
  let nextIndex = 0;

  return {
    getNext(count = 1) {
      const result = [];
      for (let i = 0; i < count; i += 1) {
        if (nextIndex >= currentCycle.length) {
          currentCycle = shuffleQuiz([...pool]);
          nextIndex = 0;
        }
        result.push(currentCycle[nextIndex]);
        nextIndex += 1;
      }
      return result;
    },
  };
}

const state = {
  readingMode: 'on_kun',
  focusItems: [],
  jlptItems: JLPT_DATASET,
  activeItems: [],
  current: null,
  timerMinutes: 1,
  remainingSeconds: 60,
  score: 0,
  running: false,
  completed: false,
  timerId: null,
  startedAt: null,
  completedAt: null,
  queue: null,
  showHints: true,
};

function getEl(id) {
  return document.getElementById(id);
}

function parseFocusItems() {
  for (const key of STORAGE_KEY_CANDIDATES) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      const items = parsed
        .map((entry) => entry?.item)
        .filter((item) => item && item.kana && Array.isArray(item.answers))
        .map((item) => ({
          kana: item.kana,
          answers: item.answers.map(normalizeRomaji).filter(Boolean),
          meanings: [],
        }))
        .filter((item) => item.answers.length > 0);
      if (items.length > 0) return items;
    } catch (_err) {
      // Keep trying fallbacks.
    }
  }
  return [];
}

function updateActiveDataset() {
  state.activeItems = state.focusItems.length > 0 ? state.focusItems : state.jlptItems;
}

function rebuildQueue() {
  updateActiveDataset();
  state.queue = createCharacterQueue(state.activeItems);
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function setStatus(message, type = '') {
  const el = getEl('mini-status');
  if (!el) return;
  el.textContent = message;
  el.className = `status${type ? ` ${type}` : ''}`;
}

function getAcceptedAnswers(item) {
  const all = (item.answers || []).map(normalizeRomaji).filter(Boolean);
  if (state.readingMode === 'onyomi_only') {
    return all[0] ? [all[0]] : [];
  }
  if (state.readingMode === 'kunyomi_only') {
    return all.length > 1 ? all.slice(1) : (all[0] ? [all[0]] : []);
  }
  if (state.readingMode === 'en_on_kun') {
    const meanings = (item.meanings || []).map(normalizeRomaji).filter(Boolean);
    return meanings.length ? meanings : all;
  }
  return all;
}

function pickNextItem() {
  if (!state.activeItems.length) {
    state.current = null;
    return null;
  }
  if (!state.queue) {
    rebuildQueue();
  }
  const [next] = state.queue.getNext(1);
  state.current = next || null;
  return state.current;
}

function finishByTime() {
  state.running = false;
  state.completed = true;
  state.completedAt = Date.now();
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  render();
}

function stopGame(reasonText = '') {
  state.running = false;
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  if (reasonText) {
    setStatus(reasonText, 'bad');
  }
  render();
}

function startGame() {
  rebuildQueue();
  if (!state.activeItems.length) {
    setStatus('No dataset available.', 'bad');
    render();
    return;
  }

  state.score = 0;
  state.remainingSeconds = state.timerMinutes * 60;
  state.running = true;
  state.completed = false;
  state.startedAt = Date.now();
  state.completedAt = null;
  setStatus('');
  pickNextItem();
  render();

  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.remainingSeconds = Math.max(0, state.remainingSeconds - 1);
    if (state.remainingSeconds === 0) {
      finishByTime();
      return;
    }
    renderTimer();
  }, 1000);
}

function renderTimer() {
  const timer = getEl('mini-timer');
  if (timer) timer.textContent = formatTimer(state.remainingSeconds);
}

function renderComplete() {
  const live = getEl('mini-live');
  const complete = getEl('mini-complete');
  const finalScore = getEl('mini-final-score');
  const finalTime = getEl('mini-final-time');
  if (!live || !complete || !finalScore || !finalTime) return;

  if (!state.completed) {
    live.style.display = '';
    complete.style.display = 'none';
    return;
  }

  live.style.display = 'none';
  complete.style.display = '';
  finalScore.textContent = `${state.score}`;
  const elapsed = state.startedAt && state.completedAt
    ? Math.max(0, Math.floor((state.completedAt - state.startedAt) / 1000))
    : state.timerMinutes * 60;
  finalTime.textContent = formatTimer(elapsed);
}

function render() {
  const mode = getEl('mini-reading-mode');
  const label = getEl('mini-label');
  const hintToggle = getEl('mini-hint-toggle');
  const kanjiCell = getEl('mini-kanji');
  const input = getEl('mini-answer');
  const score = getEl('mini-score');
  const minuteValue = getEl('minute-value');

  updateActiveDataset();
  renderComplete();

  if (mode) mode.value = state.readingMode;
  if (label) label.textContent = 'Kanji';
  if (hintToggle) hintToggle.textContent = `Hint: ${state.showHints ? 'On' : 'Off'}`;
  if (score) score.textContent = `${state.score}`;
  if (minuteValue) minuteValue.textContent = `${state.timerMinutes}`;
  renderTimer();

  if (!state.current || state.completed) {
    kanjiCell.textContent = '-';
    input.value = '';
    input.disabled = true;
    input.placeholder = state.completed ? 'Session complete' : 'Press Start';
    return;
  }

  kanjiCell.textContent = state.current.kana;
  input.disabled = !state.running;
  if (state.showHints) {
    input.placeholder = state.readingMode === 'en_on_kun' ? 'Type meaning...' : 'Type reading...';
  } else {
    input.placeholder = '';
  }
  if (state.running) input.focus();
}

function handleAnswerInput(value) {
  if (!state.running || !state.current) return;
  const normalized = normalizeRomaji(value);
  if (!normalized) return;

  const accepted = getAcceptedAnswers(state.current);
  if (!accepted.includes(normalized)) return;

  state.score += 1;
  setStatus('Correct', 'ok');
  pickNextItem();
  render();
  const input = getEl('mini-answer');
  if (input) input.value = '';
}

function openFullApp() {
  const quizUrl = chrome.runtime.getURL('quiz.html');
  chrome.tabs.create({ url: quizUrl }, () => window.close());
}

function adjustMinutes(delta) {
  if (state.running) return;
  state.timerMinutes = Math.max(1, Math.min(30, state.timerMinutes + delta));
  state.remainingSeconds = state.timerMinutes * 60;
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  state.focusItems = parseFocusItems();
  rebuildQueue();
  pickNextItem();
  render();

  const readingMode = getEl('mini-reading-mode');
  readingMode.addEventListener('change', (event) => {
    if (state.running) return;
    state.readingMode = event.target.value;
    setStatus('');
    render();
  });

  getEl('minus-minute').addEventListener('click', () => adjustMinutes(-1));
  getEl('plus-minute').addEventListener('click', () => adjustMinutes(1));
  getEl('mini-start').addEventListener('click', startGame);
  getEl('mini-stop').addEventListener('click', () => stopGame('Stopped'));
  getEl('mini-play-again').addEventListener('click', startGame);
  getEl('open-quiz').addEventListener('click', openFullApp);
  const hintToggle = getEl('mini-hint-toggle');
  if (hintToggle) {
    hintToggle.addEventListener('click', () => {
      state.showHints = !state.showHints;
      render();
    });
  }

  const input = getEl('mini-answer');
  input.addEventListener('input', (event) => handleAnswerInput(event.target.value));
});
