/**
 * Vocabulary Marathon - 例文で学ぶ英検単熟語EX
 * 英検大問1形式 空所補充４択
 */
'use strict';

// ====== State ======
const state = {
  quizData: {},       // { ex2: [...], pre1: [...] }
  grade: null,        // 'ex2' | 'pre1'
  type: 'all',        // 'all' | 'word' | 'idiom'
  wordIdStart: null,  // 単語ID開始
  wordIdEnd: null,    // 単語ID終了
  idiomIdStart: null, // 熟語ID開始
  idiomIdEnd: null,   // 熟語ID終了
  questions: [],      // current quiz questions
  current: 0,
  correct: 0,
  wrong: 0,
  mistakes: [],       // { question, yourAnswer }
  answered: false,
  hintStage: 0,       // 0: no hint, 1: sentence JP shown, 2: choice JP shown
  todayAnswered: 0,   // 今日の解答数
};

// ====== DOM Helpers ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const on = (el, ev, fn) => { if (el) el.addEventListener(ev, fn); };

// ====== Unlock System (disabled - always full version) ======
function isUnlocked() { return true; }

// ====== Marathon Progress Tracking ======
const CLEARED_KEY = 'vocab_ex_quiz_cleared';
const STATS_KEY = 'vocab_ex_quiz_stats';

function getClearedSet(grade) {
  try {
    const raw = localStorage.getItem(CLEARED_KEY + '_' + grade);
    if (raw) return new Set(JSON.parse(raw));
  } catch(e) {}
  return new Set();
}

function saveClearedSet(grade, s) {
  try { localStorage.setItem(CLEARED_KEY + '_' + grade, JSON.stringify([...s])); } catch(e) {}
}

function markCleared(grade, questionId) {
  const s = getClearedSet(grade);
  s.add(questionId);
  saveClearedSet(grade, s);
}

function getStats(grade) {
  try {
    const raw = localStorage.getItem(STATS_KEY + '_' + grade);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { totalAttempts: 0, correctAttempts: 0 };
}

function saveStats(grade, stats) {
  try { localStorage.setItem(STATS_KEY + '_' + grade, JSON.stringify(stats)); } catch(e) {}
}

function recordStats(grade, isCorrect) {
  const stats = getStats(grade);
  stats.totalAttempts++;
  if (isCorrect) stats.correctAttempts++;
  saveStats(grade, stats);
}

// ====== Streak (連続トレーニング) ======
const STREAK_KEY = 'vocab_ex_quiz_streak';
const MILESTONES = [20, 40, 60, 80, 100, 150, 200, 365];
const MIN_ANSWERS_FOR_STREAK = 10; // 1日最低10問解答で連続記録

// ====== Mistake History (永続保存) ======
const MISTAKES_KEY = 'vocab_ex_quiz_mistakes';

function getMistakeHistory() {
  try {
    const raw = localStorage.getItem(MISTAKES_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return []; // [{ id, grade, section, sentence, answer, answer_translation, date }]
}

function saveMistakeHistory(arr) {
  try {
    // 最大500件に制限
    const trimmed = arr.slice(-500);
    localStorage.setItem(MISTAKES_KEY, JSON.stringify(trimmed));
  } catch(e) {}
}

function addMistakeToHistory(q, grade) {
  const history = getMistakeHistory();
  // 同じIDが既にあればスキップ（重複回避）
  if (history.some(h => h.id === q.id)) return;
  history.push({
    id: q.id,
    grade: grade,
    section: q.section || '',
    sentence: q.sentence,
    sentence_ja: q.sentence_ja || '',
    answer: q.answer,
    answer_translation: q.answer_translation || '',
    choices: q.choices,
    type: q.type || 'word',
    tier: q.tier || 1,
    page: q.page || '',
    audioHash: q.audioHash || null,
    date: getTodayStr(),
  });
  saveMistakeHistory(history);
}

function removeMistakeFromHistory(id) {
  const history = getMistakeHistory();
  saveMistakeHistory(history.filter(h => h.id !== id));
}

function getMistakeSummary() {
  const history = getMistakeHistory();
  const summary = {}; // { g1: { section: count, ... }, g2: ... }
  history.forEach(h => {
    if (!summary[h.grade]) summary[h.grade] = {};
    const sec = h.section || 'other';
    summary[h.grade][sec] = (summary[h.grade][sec] || 0) + 1;
  });
  return { total: history.length, byGrade: summary };
}

function getStreakData() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { streak: 0, lastDate: null, totalDays: 0, shownMilestones: [] };
}

function saveStreakData(data) {
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(data)); } catch(e) {}
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function checkStreak() {
  const data = getStreakData();
  const today = getTodayStr();
  
  if (data.lastDate === today) return data; // already trained today
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
  
  if (data.lastDate === yesterdayStr) {
    // streak continues
    return data;
  } else if (data.lastDate && data.lastDate !== today) {
    // streak broken
    data.streak = 0;
    saveStreakData(data);
  }
  return data;
}

function recordTraining() {
  const data = getStreakData();
  const today = getTodayStr();
  
  if (data.lastDate === today) return data; // already counted
  
  // 今日の累計解答数が10問未満なら記録しない
  if (state.todayAnswered < MIN_ANSWERS_FOR_STREAK) return data;
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
  
  if (data.lastDate === yesterdayStr) {
    data.streak++;
  } else {
    data.streak = 1;
  }
  data.lastDate = today;
  data.totalDays = (data.totalDays || 0) + 1;
  if (!data.shownMilestones) data.shownMilestones = [];
  
  saveStreakData(data);
  return data;
}

// 解答するたびにカウンタを増やし、10問到達時にストリーク記録
function trackAnswer() {
  state.todayAnswered++;
  if (state.todayAnswered === MIN_ANSWERS_FOR_STREAK) {
    const sd = recordTraining();
    renderStreakBadge();
    return sd;
  }
  return null;
}

function renderStreakBadge() {
  const badge = $('#streakBadge');
  if (!badge) return;
  
  const data = checkStreak();
  const streak = data.streak;
  const today = getTodayStr();
  const trainedToday = data.lastDate === today;
  
  if (streak === 0 && !trainedToday) {
    badge.innerHTML = `
      <div class="streak-content">
        <span class="streak-icon">🌱</span>
        <span class="streak-text">今日からトレーニングを始めよう！</span>
      </div>`;
  } else {
    const flame = streak >= 30 ? '🔥🔥🔥' : streak >= 10 ? '🔥🔥' : streak >= 3 ? '🔥' : '✨';
    badge.innerHTML = `
      <div class="streak-content">
        <span class="streak-icon">${flame}</span>
        <div class="streak-info">
          <span class="streak-days">連続 <strong>${streak}</strong> 日継続中！</span>
          ${trainedToday ? '<span class="streak-done">✅ 今日のトレーニング完了</span>' : '<span class="streak-todo">📌 今日まだトレーニングしていません</span>'}
        </div>
      </div>
      <div class="streak-total">累計 ${data.totalDays || streak} 日</div>`;
  }
}

function checkMilestone(streakData) {
  const streak = streakData.streak;
  const shown = streakData.shownMilestones || [];
  
  for (const m of MILESTONES) {
    if (streak >= m && !shown.includes(m)) {
      streakData.shownMilestones.push(m);
      saveStreakData(streakData);
      showCelebrationModal(m, streak);
      return;
    }
  }
}

function showCelebrationModal(milestone, streak) {
  const modal = document.createElement('div');
  modal.className = 'celebration-overlay';
  modal.id = 'celebrationModal';
  
  const emoji = milestone >= 100 ? '👑' : milestone >= 60 ? '🏆' : milestone >= 40 ? '🎖️' : '🥇';
  const title = milestone >= 100 ? '伝説の努力家！' : milestone >= 60 ? '素晴らしい継続力！' : milestone >= 40 ? '驚異的な集中力！' : 'すごい！よく頑張った！';
  
  modal.innerHTML = `
    <div class="celebration-modal slide-up">
      <div class="celebration-confetti">🎊</div>
      <div class="celebration-emoji">${emoji}</div>
      <h2 class="celebration-title">🎉 ${milestone}日連続達成！ 🎉</h2>
      <p class="celebration-subtitle">${title}</p>
      <div class="celebration-streak">
        <div class="celebration-days">${streak}</div>
        <div class="celebration-label">日連続トレーニング</div>
      </div>
      <div class="celebration-reward">
        📸 このスクリーンショットを保存して<br>
        教室で先生に見せると<br>
        <strong>✨ 素敵なプレゼント ✨</strong>がもらえるよ！
      </div>
      <div class="celebration-date">${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      <div class="celebration-name">🏃 Vocabulary Marathon</div>
      <button class="celebration-close" onclick="closeCelebration()">閉じる</button>
    </div>`;
  
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
}

function closeCelebration() {
  const modal = $('#celebrationModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
}

// ====== Data Loading ======
async function loadData() {
  const files = ['ex2_quiz.json', 'pre1_quiz.json'];
  for (const f of files) {
    const key = f.replace('_quiz.json', '');
    try {
      const res = await fetch(f);
      state.quizData[key] = await res.json();
    } catch (e) {
      console.warn(`Failed to load ${f}:`, e);
      state.quizData[key] = [];
    }
  }
}

// ====== ページ番号・ランク抽出 ======
function extractPageNum(pageStr) {
  if (!pageStr) return null;
  const m = pageStr.match(/[pr]\.(\d+)/);
  return m ? parseInt(m[1]) : null;
}

// ====== セクションソート（教科書ページ順）======
function sortSectionsByPage(data) {
  // 各セクションの最小ページ番号を計算
  const minPages = {};
  data.forEach(q => {
    const s = q.section;
    if (!s) return;
    const pn = extractPageNum(q.page);
    if (pn !== null) {
      minPages[s] = Math.min(minPages[s] || 9999, pn);
    }
  });
  // ページ番号順でソート
  return (a, b) => (minPages[a] || 9999) - (minPages[b] || 9999);
}

// ====== セクションラベル ======
function sectionLabel(s) {
  // すでに「単語 1-100」のようにフォーマットされているのでそのまま返す
  if (/^\d+/.test(s)) return 'Program ' + s; // fallback
  return s;
}

// ====== Setup Screen ======
function initSetup() {
  const grades = [
    { key: 'ex2', label: '英検2級', icon: '📘' },
    { key: 'pre1', label: '英検準1級', icon: '📙' },
  ];

  const gradeBtns = $('#gradeBtns');
  gradeBtns.innerHTML = grades.map(g => {
    const count = (state.quizData[g.key] || []).length;
    return `<button class="grade-btn" data-grade="${g.key}">
      ${g.icon} ${g.label}
      <span class="count">${count}問</span>
    </button>`;
  }).join('');

  gradeBtns.querySelectorAll('.grade-btn').forEach(btn => {
    on(btn, 'click', () => {
      gradeBtns.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.grade = btn.dataset.grade;
      state.wordIdStart = null;
      state.wordIdEnd = null;
      state.idiomIdStart = null;
      state.idiomIdEnd = null;
      ['#wordIdStart','#wordIdEnd','#idiomIdStart','#idiomIdEnd'].forEach(s => { const e = $(s); if(e) e.value = ''; });
      renderMarathonProgress();
      updateIdRangeInfo();
      updateSummary();
    });
  });

  // Config change listeners
  on($('#questionCount'), 'change', updateSummary);

  // Word ID range listeners
  on($('#wordIdStart'), 'input', () => {
    const v = $('#wordIdStart').value.trim();
    state.wordIdStart = v ? parseInt(v) : null;
    updateSummary();
  });
  on($('#wordIdEnd'), 'input', () => {
    const v = $('#wordIdEnd').value.trim();
    state.wordIdEnd = v ? parseInt(v) : null;
    updateSummary();
  });

  // Idiom ID range listeners
  on($('#idiomIdStart'), 'input', () => {
    const v = $('#idiomIdStart').value.trim();
    state.idiomIdStart = v ? parseInt(v) : null;
    updateSummary();
  });
  on($('#idiomIdEnd'), 'input', () => {
    const v = $('#idiomIdEnd').value.trim();
    state.idiomIdEnd = v ? parseInt(v) : null;
    updateSummary();
  });

  // Start button
  on($('#startBtn'), 'click', startQuiz);
  on($('#nextBtn'), 'click', nextQuestion);

  // ミス復習ボタン更新
  updateMistakeBtn();
}

// ====== Marathon Progress Bars ======
function renderMarathonProgress() {
  const container = $('#marathonProgress');
  if (!container) return;
  if (!state.grade) {
    container.innerHTML = '';
    return;
  }

  const allQs = state.quizData[state.grade] || [];
  const totalCount = allQs.length;
  const cleared = getClearedSet(state.grade);
  const clearedCount = [...cleared].filter(id => allQs.some(q => q.id === id)).length;
  const clearPct = totalCount > 0 ? Math.round((clearedCount / totalCount) * 100) : 0;

  const stats = getStats(state.grade);
  const accPct = stats.totalAttempts > 0 ? Math.round((stats.correctAttempts / stats.totalAttempts) * 100) : 0;

  // Word / Idiom breakdown
  const wordQs = allQs.filter(q => q.type === 'word');
  const idiomQs = allQs.filter(q => q.type === 'idiom');
  const wordCleared = [...cleared].filter(id => wordQs.some(q => q.id === id)).length;
  const idiomCleared = [...cleared].filter(id => idiomQs.some(q => q.id === id)).length;

  container.innerHTML = `
    <div class="marathon-bar-group">
      <div class="marathon-label">
        <span>🏃 マラソン達成率</span>
        <span class="marathon-value">${clearedCount} / ${totalCount} (${clearPct}%)</span>
      </div>
      <div class="marathon-track">
        <div class="marathon-fill marathon-fill-clear" style="width:${clearPct}%"></div>
      </div>
      <div class="marathon-breakdown">
        <span>📖 単語 ${wordCleared}/${wordQs.length}</span>
        <span>📝 熟語 ${idiomCleared}/${idiomQs.length}</span>
      </div>
    </div>
    <div class="marathon-bar-group">
      <div class="marathon-label">
        <span>🎯 累計正答率</span>
        <span class="marathon-value">${stats.totalAttempts > 0 ? accPct + '%' : '--'} (${stats.correctAttempts}/${stats.totalAttempts})</span>
      </div>
      <div class="marathon-track">
        <div class="marathon-fill marathon-fill-acc" style="width:${accPct}%"></div>
      </div>
    </div>
  `;
}

function updateIdRangeInfo() {
  const wordInfo = $('#wordRangeInfo');
  const idiomInfo = $('#idiomRangeInfo');
  if (!wordInfo || !idiomInfo) return;

  if (!state.grade) {
    wordInfo.textContent = '';
    idiomInfo.textContent = '';
    return;
  }

  const allQs = state.quizData[state.grade] || [];

  // Word range
  const wordQs = allQs.filter(q => q.type === 'word');
  const wordRanks = wordQs.map(q => extractPageNum(q.page)).filter(n => n !== null);
  if (wordRanks.length > 0) {
    wordInfo.textContent = `(#${Math.min(...wordRanks)}〜#${Math.max(...wordRanks)})`;
  } else {
    wordInfo.textContent = '';
  }

  // Idiom range
  const idiomQs = allQs.filter(q => q.type === 'idiom');
  const idiomRanks = idiomQs.map(q => extractPageNum(q.page)).filter(n => n !== null);
  if (idiomRanks.length > 0) {
    idiomInfo.textContent = `(#${Math.min(...idiomRanks)}〜#${Math.max(...idiomRanks)})`;
  } else {
    idiomInfo.textContent = '';
  }
}

function getFilteredQuestions() {
  if (!state.grade) return [];
  let qs = state.quizData[state.grade] || [];

  // Separate filtering by word and idiom ID ranges
  const hasWordRange = state.wordIdStart !== null || state.wordIdEnd !== null;
  const hasIdiomRange = state.idiomIdStart !== null || state.idiomIdEnd !== null;

  if (hasWordRange || hasIdiomRange) {
    qs = qs.filter(q => {
      const rn = extractPageNum(q.page);
      if (rn === null) return false;
      if (q.type === 'word' && hasWordRange) {
        if (state.wordIdStart !== null && rn < state.wordIdStart) return false;
        if (state.wordIdEnd !== null && rn > state.wordIdEnd) return false;
        return true;
      }
      if (q.type === 'idiom' && hasIdiomRange) {
        if (state.idiomIdStart !== null && rn < state.idiomIdStart) return false;
        if (state.idiomIdEnd !== null && rn > state.idiomIdEnd) return false;
        return true;
      }
      // If only one range is set, exclude the other type
      if (hasWordRange && !hasIdiomRange && q.type === 'idiom') return false;
      if (hasIdiomRange && !hasWordRange && q.type === 'word') return false;
      return true;
    });
  }

  return qs;
}

function updateSummary() {
  const filtered = getFilteredQuestions();
  const matchCount = filtered.length;
  let pickCount = parseInt($('#questionCount').value) || matchCount;
  if (pickCount === 0 || pickCount > matchCount) pickCount = matchCount;

  $('#matchCount').textContent = matchCount;
  $('#pickCount').textContent = pickCount;
  $('#startBtn').disabled = matchCount === 0;
}

// ====== Quiz Logic ======
function startQuiz() {
  const filtered = getFilteredQuestions();
  let count = parseInt($('#questionCount').value) || filtered.length;
  if (count === 0 || count > filtered.length) count = filtered.length;

  const order = $('#questionOrder').value;
  let questions = [...filtered];

  if (order === 'random') {
    // Fisher-Yates shuffle
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
  }

  questions = questions.slice(0, count);

  // Shuffle choices for each question
  questions.forEach(q => {
    q._shuffledChoices = [...q.choices].sort(() => Math.random() - 0.5);
  });

  state.questions = questions;
  state.current = 0;
  state.correct = 0;
  state.wrong = 0;
  state.mistakes = [];
  state.answered = false;

  showScreen('quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.current];
  if (!q) return;

  state.answered = false;
  state.hintStage = 0;
  const total = state.questions.length;

  // Progress
  $('#progressFill').style.width = `${(state.current / total) * 100}%`;

  // Score bar
  const answered = state.correct + state.wrong;
  const accuracy = answered > 0 ? Math.round((state.correct / answered) * 100) : 0;
  $('#correctCount').textContent = state.correct;
  $('#wrongCount').textContent = state.wrong;
  $('#accuracy').textContent = `${accuracy}%`;

  // Question header
  const typeLabel = q.type === 'idiom' ? 'イディオム' : '単語';
  $('#questionHeader').innerHTML = `
    <span class="q-num">Q${state.current + 1} / ${total}</span>
    <span>
      ${q.type === 'idiom' ? `<span class="type-badge">${typeLabel}</span>` : `<span class="type-badge" style="background:#4a90e2;color:#fff">${typeLabel}</span>`}
    </span>
  `;

  // Sentence (日本語訳は非表示)
  const sentenceHtml = q.sentence.replace(/\(\s*\)/g, '<span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>');
  let cardHtml = `
    <div class="sentence-en">${sentenceHtml}</div>
    <div class="sentence-ja" id="sentenceJa" style="display:none">${q.sentence_ja}</div>
  `;

  // Idiom hint
  if (q.type === 'idiom' && q.idiom) {
    const idiomDisplay = q.idiom.replace(q.answer, '(    )');
    cardHtml += `
      <div class="idiom-hint">
        💡 イディオム: <span class="idiom-word">${idiomDisplay}</span>
        → ${q.idiom_translation || q.answer_translation}
      </div>
    `;
  }

  const sentenceCard = $('#sentenceCard');
  sentenceCard.innerHTML = cardHtml;
  sentenceCard.classList.add('fade-in');

  // Choices（日本語訳は非表示）
  const choicesEl = $('#choices');
  const choices = q._shuffledChoices;
  choicesEl.innerHTML = choices.map((c, i) => {
    const jpText = c.translation ? `<div class="choice-jp" style="display:none">${c.translation}</div>` : '';
    return `<button class="choice-btn fade-in" data-idx="${i}" style="animation-delay: ${i * 0.05}s">
      <span class="choice-num">${i + 1}</span>
      <div class="choice-text">
        ${c.word}
        ${jpText}
      </div>
    </button>`;
  }).join('');

  choicesEl.querySelectorAll('.choice-btn').forEach(btn => {
    on(btn, 'click', () => handleAnswer(parseInt(btn.dataset.idx)));
  });

  // Hint button
  updateHintButton();

  // Hide next btn
  $('#nextBtn').style.display = 'none';
}

function updateHintButton() {
  const hintBtn = $('#hintBtn');
  if (!hintBtn) return;

  if (state.hintStage === 0) {
    hintBtn.textContent = '💡 ヒント①：例文の日本語訳';
    hintBtn.style.display = 'block';
    hintBtn.className = 'hint-btn';
  } else if (state.hintStage === 1) {
    hintBtn.textContent = '💡 ヒント②：選択肢の日本語訳';
    hintBtn.style.display = 'block';
    hintBtn.className = 'hint-btn hint-stage2';
  } else {
    hintBtn.style.display = 'none';
  }
}

function showHint() {
  if (state.answered) return;

  state.hintStage++;

  if (state.hintStage === 1) {
    // 第1段階: 例文の日本語訳を表示
    const ja = $('#sentenceJa');
    if (ja) {
      ja.style.display = 'block';
      ja.classList.add('fade-in');
    }
  } else if (state.hintStage >= 2) {
    // 第2段階: 選択肢の日本語訳を表示
    $$('.choice-jp').forEach(el => {
      el.style.display = 'block';
      el.classList.add('fade-in');
    });
  }

  updateHintButton();
}

function handleAnswer(idx) {
  if (state.answered) return;
  state.answered = true;

  const q = state.questions[state.current];
  const choices = q._shuffledChoices;
  const selected = choices[idx];
  const isCorrect = selected.correct;

  if (isCorrect) {
    state.correct++;
    // 正解した場合、ミス履歴から削除 & クリア記録
    removeMistakeFromHistory(q.id);
    markCleared(state.grade, q.id);
  } else {
    state.wrong++;
    state.mistakes.push({
      question: q,
      yourAnswer: selected.word,
    });
    // ミス履歴に永続保存
    addMistakeToHistory(q, state.grade);
  }
  
  // 統計記録
  recordStats(state.grade, isCorrect);

  // 解答数トラッキング
  trackAnswer();

  // Visual feedback
  const btns = $$('.choice-btn');
  btns.forEach((btn, i) => {
    btn.classList.add('answered');
    if (choices[i].correct) {
      btn.classList.add('correct');
      if (isCorrect) btn.classList.add('pop');
    } else if (i === idx) {
      btn.classList.add('wrong', 'shake');
    } else {
      btn.classList.add('dimmed');
    }
  });

  // 回答後: 全ての日本語訳を表示
  const ja = $('#sentenceJa');
  if (ja) ja.style.display = 'block';
  $$('.choice-jp').forEach(el => { el.style.display = 'block'; });
  // ヒントボタンを非表示
  const hintBtn = $('#hintBtn');
  if (hintBtn) hintBtn.style.display = 'none';

  // Update blank with answer
  const blank = $('#sentenceCard').querySelector('.blank');
  if (blank) {
    blank.textContent = q.answer;
    blank.style.borderColor = isCorrect ? 'var(--success)' : 'var(--danger)';
    blank.style.color = isCorrect ? 'var(--success)' : 'var(--danger)';
  }

  // Update score bar
  const answered = state.correct + state.wrong;
  const accuracy = answered > 0 ? Math.round((state.correct / answered) * 100) : 0;
  $('#correctCount').textContent = state.correct;
  $('#wrongCount').textContent = state.wrong;
  $('#accuracy').textContent = `${accuracy}%`;

  // Show next button
  const nextBtn = $('#nextBtn');
  if (state.current < state.questions.length - 1) {
    nextBtn.textContent = '次の問題 →';
  } else {
    nextBtn.textContent = '結果を見る 🏆';
  }
  nextBtn.style.display = 'block';
  nextBtn.classList.add('fade-in');

  // 音声再生
  playAnswerAudio(q);
}

// ====== Audio Playback ======
let currentAudio = null;

function playAnswerAudio(q) {
  // rank from page field (r.123 -> 123)
  const rank = extractPageNum(q.page);
  if (!rank) return;
  
  const subdir = q.type === 'idiom' ? 'idiom' : 'tango';
  const url = `audio/${subdir}/${rank}_example.mp3`;
  
  // スピーカーボタンを追加
  const card = $('#sentenceCard');
  if (card && !card.querySelector('.audio-btn')) {
    const btn = document.createElement('button');
    btn.className = 'audio-btn fade-in';
    btn.innerHTML = '🔊';
    btn.title = '音声を再生';
    btn.onclick = () => playAudioFile(url);
    card.appendChild(btn);
  }
  
  // 自動再生
  setTimeout(() => playAudioFile(url), 300);
}

function playAudioFile(url) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  currentAudio = new Audio(url);
  currentAudio.play().catch(() => {
    // autoplay blocked - user can tap the speaker button
  });
}

function nextQuestion() {
  state.current++;
  if (state.current >= state.questions.length) {
    showResult();
  } else {
    renderQuestion();
  }
}

// ====== Result Screen ======
function showResult() {
  showScreen('result');

  // ストリーク記録（10問以上解答済みなら）
  const streakData = recordTraining();

  const total = state.questions.length;
  const correct = state.correct;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  let message = '';
  let messageStyle = '';
  if (accuracy === 100) {
    message = '🏆 パーフェクト！完璧です！';
    messageStyle = 'background: var(--success-glow); color: var(--success);';
  } else if (accuracy >= 80) {
    message = '🌟 素晴らしい！よく頑張りました！';
    messageStyle = 'background: var(--primary-glow); color: var(--primary-light);';
  } else if (accuracy >= 60) {
    message = '💪 いい調子！もう少し頑張ろう！';
    messageStyle = 'background: var(--warning-glow); color: var(--warning);';
  } else {
    message = '📚 復習してもう一度挑戦しよう！';
    messageStyle = 'background: var(--danger-glow); color: var(--danger);';
  }

  const gradeLabel = { ex2: '英検2級', pre1: '英検準1級' }[state.grade] || '';

  let mistakesHtml = '';
  if (state.mistakes.length > 0) {
    mistakesHtml = `
      <div class="mistakes-section">
        <h3>❌ 間違えた問題 (${state.mistakes.length}問)</h3>
        ${state.mistakes.map(m => {
          const sentenceHighlighted = m.question.sentence.replace(
            /\(\s*\)/g,
            `<strong style="color:var(--success)">${m.question.answer}</strong>`
          );
          return `<div class="mistake-item">
            <div class="mistake-sentence">${sentenceHighlighted}</div>
            <div class="mistake-answer">✅ ${m.question.answer}${m.question.answer_translation ? ` (${m.question.answer_translation})` : ''}</div>
            <div class="mistake-yours">あなたの回答: ${m.yourAnswer}</div>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  $('#resultScreen').innerHTML = `
    <div class="header">
      <h1>🏃 Vocabulary Marathon</h1>
      <p>${gradeLabel} · 例文で学ぶ英検単熟語EX</p>
    </div>
    <div class="result-card slide-up">
      <div class="result-score">${accuracy}%</div>
      <div class="result-label">正答率</div>
      <div class="result-message" style="${messageStyle}">${message}</div>
      <div class="result-stats">
        <div class="result-stat s-correct">
          <div class="value">${correct}</div>
          <div class="label">正解</div>
        </div>
        <div class="result-stat s-wrong">
          <div class="value">${state.wrong}</div>
          <div class="label">不正解</div>
        </div>
        <div class="result-stat s-total">
          <div class="value">${total}</div>
          <div class="label">問題数</div>
        </div>
      </div>
      <div class="result-actions">
        <button class="retry-btn" onclick="retryQuiz()">🔄 もう一度</button>
        ${state.mistakes.length > 0 ? '<button class="retry-mistakes-btn" onclick="retryMistakes()">📝 間違えた問題だけ</button>' : ''}
        <button class="home-btn" onclick="goHome()">🏠 ホームへ</button>
      </div>
      ${mistakesHtml}
    </div>
  `;

  // ストリークバッジ更新&マイルストーンチェック
  renderStreakBadge();
  setTimeout(() => checkMilestone(streakData), 800);
}

function retryQuiz() {
  startQuiz();
}

function retryMistakes() {
  if (state.mistakes.length === 0) return;

  // ミスした問題だけでクイズを構成
  const questions = state.mistakes.map(m => m.question);

  // シャッフル
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  // 選択肢も再シャッフル
  questions.forEach(q => {
    q._shuffledChoices = [...q.choices].sort(() => Math.random() - 0.5);
  });

  state.questions = questions;
  state.current = 0;
  state.correct = 0;
  state.wrong = 0;
  state.mistakes = [];
  state.answered = false;

  showScreen('quiz');
  renderQuestion();
}

function goHome() {
  showScreen('setup');
  updateMistakeBtn();
  renderMarathonProgress();
}

// ====== Help Manual ======
function showHelp() {
  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';
  overlay.id = 'helpModal';
  overlay.innerHTML = `
    <div class="help-modal slide-up">
      <div class="help-header">
        <h2>📖 使い方ガイド</h2>
        <button class="help-close-x" onclick="closeHelp()">×</button>
      </div>
      <div class="help-body">
        <div class="help-section">
          <h3>🎯 クイズの始め方</h3>
          <ol>
            <li><strong>級を選択</strong>：英検2級・準1級から選ぶ</li>
            <li><strong>出題範囲を絞る</strong>（任意）：「単語 1-100」などセクションをタップして選択</li>
            <li><strong>単語ID指定</strong>（任意）：単語の番号で範囲を指定（例: 1 〜 200）</li>
            <li><strong>クイズ開始</strong>をタップ！</li>
          </ol>
        </div>

        <div class="help-section">
          <h3>❓ クイズ画面の操作</h3>
          <ul>
            <li><strong>4つの選択肢</strong>から正しい答えを選ぶ</li>
            <li><strong>💡 ヒントボタン</strong>をタップすると：
              <br>① 例文の日本語訳が表示
              <br>② 選択肢の日本語訳が表示</li>
            <li><strong>🔊 スピーカー</strong>：解答後に例文の音声を再生</li>
            <li><strong>🏠</strong>：ホームに戻る</li>
          </ul>
        </div>

        <div class="help-section">
          <h3>📊 結果画面</h3>
          <ul>
            <li><strong>🔄 もう一度</strong>：同じ設定で再チャレンジ</li>
            <li><strong>📝 間違えた問題だけ</strong>：ミスした問題だけで復習</li>
            <li><strong>🏠 ホームへ</strong>：設定画面に戻る</li>
          </ul>
        </div>

        <div class="help-section">
          <h3>🔥 連続トレーニング</h3>
          <p>毎日<strong>10問以上</strong>解答すると連続日数がカウントされます。</p>
          <ul>
            <li><strong>20日・40日・60日...</strong> 達成でお祝い画面が出ます！</li>
            <li>📸 スクリーンショットを保存して先生に見せると<strong>プレゼント</strong>がもらえます！</li>
          </ul>
        </div>
      </div>
      <button class="help-close-btn" onclick="closeHelp()">閉じる</button>
    </div>`;
  
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
}

function closeHelp() {
  const modal = $('#helpModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
}

// ====== Mistake Review Modal ======
function showMistakeReviewModal() {
  const history = getMistakeHistory();
  if (history.length === 0) {
    alert('ミスした問題はまだありません。\nクイズを始めましょう！');
    return;
  }

  const gradeLabels = { ex2: '📘 英検2級', pre1: '📙 英検準1級' };

  // Group mistakes by grade, then by 100-word ID range
  const grouped = {};
  history.forEach(h => {
    if (!grouped[h.grade]) grouped[h.grade] = {};
    const rank = extractPageNum(h.page);
    const rangeStart = rank ? Math.floor((rank - 1) / 100) * 100 + 1 : 0;
    const rangeEnd = rangeStart + 99;
    const typeLabel = h.type === 'idiom' ? '熟語' : '単語';
    const rangeKey = `${typeLabel} #${rangeStart}-${rangeEnd}`;
    if (!grouped[h.grade][rangeKey]) grouped[h.grade][rangeKey] = { count: 0, start: rangeStart };
    grouped[h.grade][rangeKey].count++;
  });

  let categoriesHtml = '';
  for (const [grade, ranges] of Object.entries(grouped)) {
    const gradeTotal = Object.values(ranges).reduce((s, v) => s + v.count, 0);
    categoriesHtml += `
      <div class="mr-grade">
        <label class="mr-grade-label">
          <input type="checkbox" class="mr-grade-cb" data-grade="${grade}" checked>
          ${gradeLabels[grade] || grade} <span class="mr-count">${gradeTotal}問</span>
        </label>
        <div class="mr-sections" data-grade="${grade}">`;

    // Sort ranges by start number
    const sortedRanges = Object.entries(ranges).sort((a, b) => a[1].start - b[1].start);

    for (const [rangeKey, info] of sortedRanges) {
      categoriesHtml += `
        <label class="mr-section-label">
          <input type="checkbox" class="mr-range-cb" data-grade="${grade}" data-range="${rangeKey}" checked>
          ${rangeKey} <span class="mr-count">${info.count}</span>
        </label>`;
    }
    categoriesHtml += '</div></div>';
  }

  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';
  overlay.id = 'mistakeReviewModal';
  overlay.innerHTML = `
    <div class="help-modal slide-up">
      <div class="help-header">
        <h2>📝 ミスした問題を復習</h2>
        <button class="help-close-x" onclick="closeMistakeReview()">×</button>
      </div>
      <div class="help-body">
        <div class="mr-total">累計 <strong>${history.length}</strong> 問のミス履歴</div>
        <p class="mr-desc">復習したい範囲を選んでください：</p>
        ${categoriesHtml}
      </div>
      <div class="mr-actions">
        <button class="help-close-btn" style="background:var(--success);" onclick="startMistakeReviewFromModal()">🚀 復習スタート</button>
        <button class="mr-clear-btn" onclick="if(confirm('ミス履歴を全て削除しますか？')){localStorage.removeItem('${MISTAKES_KEY}');closeMistakeReview();updateMistakeBtn();}">🗑️ 履歴をクリア</button>
      </div>
    </div>`;
  
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  // 級チェックボックスの連動
  overlay.querySelectorAll('.mr-grade-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const grade = cb.dataset.grade;
      const checked = cb.checked;
      overlay.querySelectorAll(`.mr-range-cb[data-grade="${grade}"]`).forEach(s => s.checked = checked);
    });
  });
}

function closeMistakeReview() {
  const modal = $('#mistakeReviewModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
}

function startMistakeReviewFromModal() {
  const modal = $('#mistakeReviewModal');
  if (!modal) return;

  // 選択された範囲を収集
  const selectedRanges = new Set();
  modal.querySelectorAll('.mr-range-cb:checked').forEach(cb => {
    selectedRanges.add(`${cb.dataset.grade}:${cb.dataset.range}`);
  });

  const history = getMistakeHistory();
  const filtered = history.filter(h => {
    const rank = extractPageNum(h.page);
    const rangeStart = rank ? Math.floor((rank - 1) / 100) * 100 + 1 : 0;
    const rangeEnd = rangeStart + 99;
    const typeLabel = h.type === 'idiom' ? '熟語' : '単語';
    const rangeKey = `${typeLabel} #${rangeStart}-${rangeEnd}`;
    return selectedRanges.has(`${h.grade}:${rangeKey}`);
  });

  if (filtered.length === 0) {
    alert('選択された範囲にミス問題がありません。');
    return;
  }

  closeMistakeReview();

  // シャッフル
  const questions = [...filtered];
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  // 選択肢シャッフル
  questions.forEach(q => {
    q._shuffledChoices = [...q.choices].sort(() => Math.random() - 0.5);
  });

  // ステートセット
  state.grade = filtered[0].grade;
  state.questions = questions;
  state.current = 0;
  state.correct = 0;
  state.wrong = 0;
  state.mistakes = [];
  state.answered = false;

  showScreen('quiz');
  renderQuestion();
}

function updateMistakeBtn() {
  const btn = $('#mistakeReviewBtn');
  if (!btn) return;
  const count = getMistakeHistory().length;
  if (count > 0) {
    btn.textContent = `📝 ミスした問題を復習 (${count}問)`;
    btn.style.display = 'block';
  } else {
    btn.style.display = 'none';
  }
}

// ====== Unlock System UI (disabled - always full) ======

function showUnlockModal() {
  if (isUnlocked()) {
    // 既にアンロック済み → FREE版に戻すオプション付き
    const overlay = document.createElement('div');
    overlay.className = 'help-overlay';
    overlay.id = 'unlockModal';
    overlay.innerHTML = `
      <div class="help-modal slide-up">
        <div class="help-header">
          <h2>🔓 UNLIMITED</h2>
          <button class="help-close-x" onclick="closeUnlockModal()">×</button>
        </div>
        <div class="help-body" style="text-align:center;padding:1.5rem">
          <div style="font-size:2.5rem;margin-bottom:0.5rem">🎉</div>
          <p style="font-size:0.85rem;font-weight:700;color:var(--text-main)">全セクション解放済み！</p>
          <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem">すべての問題にアクセスできます</p>
          <div style="margin-top:1rem;border-top:1px solid rgba(100,120,150,0.1);padding-top:0.8rem">
            <p style="font-size:0.7rem;color:var(--text-dim)">FREE版に戻す場合はパスワードを入力</p>
            <div class="unlock-input-wrap" style="margin-top:0.4rem">
              <input type="password" id="relockInput" class="unlock-input" placeholder="パスワード" autocomplete="off" style="font-size:0.85rem">
            </div>
            <button class="mr-clear-btn" style="margin-top:0.4rem" onclick="attemptRelock()">🔒 FREE版に戻す</button>
          </div>
        </div>
        <button class="help-close-btn" onclick="closeUnlockModal()">閉じる</button>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';
  overlay.id = 'unlockModal';
  overlay.innerHTML = `
    <div class="help-modal slide-up">
      <div class="help-header">
        <h2>🔐 全セクション解放</h2>
        <button class="help-close-x" onclick="closeUnlockModal()">×</button>
      </div>
      <div class="help-body">
        <div style="text-align:center;padding:0.5rem 0">
          <div style="font-size:2rem;margin-bottom:0.5rem">🔒</div>
          <p style="font-size:0.82rem;color:var(--text-main);font-weight:600">現在 FREE版：Program 1 のみ利用可能</p>
          <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem">パスワードを入力して全セクションを解放しましょう</p>
        </div>
        <div class="unlock-input-wrap">
          <input type="password" id="unlockInput" class="unlock-input" placeholder="パスワードを入力" autocomplete="off">
          <div class="unlock-error" id="unlockError" style="display:none">❌ パスワードが違います</div>
        </div>
      </div>
      <button class="help-close-btn" style="background:var(--primary);" onclick="attemptUnlock()">🔓 解放する</button>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  // Enter キーでも解放
  setTimeout(() => {
    const input = $('#unlockInput');
    if (input) {
      input.focus();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') attemptUnlock();
      });
    }
  }, 400);
}

function attemptUnlock() {
  const input = $('#unlockInput');
  const error = $('#unlockError');
  if (!input) return;

  if (input.value === UNLOCK_PASSWORD) {
    setUnlocked(true);
    closeUnlockModal();
    renderUnlockBadge();
    renderSectionChips();
    updateSummary();
    showWelcomeUnlock();
  } else {
    if (error) {
      error.style.display = 'block';
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
    }
  }
}

function closeUnlockModal() {
  const modal = $('#unlockModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
}

function attemptRelock() {
  const input = $('#relockInput');
  if (!input) return;
  if (input.value === UNLOCK_PASSWORD) {
    setUnlocked(false);
    state.selectedSections = ['1']; // Program 1のみに戻す
    closeUnlockModal();
    renderUnlockBadge();
    renderSectionChips();
    updateSummary();
  } else {
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 400);
  }
}

function showWelcomeUnlock() {
  // クラッカーパーティクル生成
  const container = document.createElement('div');
  container.className = 'confetti-container';
  container.id = 'confettiContainer';
  
  const colors = ['#FF6B6B','#4ECDC4','#45B7D1','#F9CA24','#6C5CE7','#FD79A8','#00B894','#E17055'];
  for (let i = 0; i < 60; i++) {
    const particle = document.createElement('div');
    particle.className = 'confetti-particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    particle.style.animationDelay = Math.random() * 0.5 + 's';
    particle.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    const size = 6 + Math.random() * 6;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    if (Math.random() > 0.5) particle.style.borderRadius = '50%';
    container.appendChild(particle);
  }
  document.body.appendChild(container);

  // Welcome モーダル
  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';
  overlay.id = 'welcomeUnlockModal';
  overlay.innerHTML = `
    <div class="help-modal slide-up" style="text-align:center">
      <div class="help-body" style="padding:2rem 1.5rem">
        <div style="font-size:3rem;margin-bottom:0.5rem">🎊🎉🎊</div>
        <h2 style="font-size:1.2rem;font-weight:800;color:var(--text-main);margin-bottom:0.5rem">Welcome to UNLIMITED!</h2>
        <p style="font-size:0.85rem;color:var(--success);font-weight:700;margin-bottom:0.3rem">✅ 全セクション解放完了！</p>
        <p style="font-size:0.78rem;color:var(--text-muted);line-height:1.5">
          すべての学年・全セクションの問題に<br>
          アクセスできるようになりました！<br>
          たくさん練習して英語力を伸ばそう 💪
        </p>
        <div style="margin-top:1rem;padding:0.6rem;background:rgba(92,107,192,0.06);border-radius:var(--radius-md)">
          <span style="font-size:1.5rem">🔓</span>
          <div style="font-size:0.7rem;color:var(--primary);font-weight:700;margin-top:0.2rem">UNLIMITED EDITION</div>
        </div>
      </div>
      <button class="help-close-btn" onclick="closeWelcomeUnlock()">始めよう！ 🚀</button>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  // 3秒後に紙吹雪を消す
  setTimeout(() => {
    const c = $('#confettiContainer');
    if (c) c.remove();
  }, 4000);
}

function closeWelcomeUnlock() {
  const modal = $('#welcomeUnlockModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
}

// ====== Screen Management ======
function showScreen(name) {
  $('#setupScreen').style.display = name === 'setup' ? 'block' : 'none';
  $('#quizScreen').style.display = name === 'quiz' ? 'block' : 'none';
  $('#resultScreen').style.display = name === 'result' ? 'block' : 'none';
  window.scrollTo(0, 0);
}

// ====== Init ======
async function init() {
  // Show loading
  $('#app').innerHTML = `
    <div class="header">
      <h1>🏃 Vocabulary Marathon</h1>
      <p>データを読み込んでいます...</p>
    </div>
    <div class="loading">
      <div class="spinner"></div>
      読み込み中...
    </div>
  `;

  await loadData();

  // Restore HTML
  $('#app').innerHTML = `
    <div class="setup-screen" id="setupScreen">
      <div class="header">
        <h1>🏃 Vocabulary Marathon</h1>
        <p>例文で学ぶ英検単熟語EX · 4択空所補充</p>
        <div class="header-actions">
          <button class="help-btn" onclick="showHelp()">❓ 使い方</button>
        </div>
      </div>
      <div class="streak-badge" id="streakBadge"></div>
      <div class="setup-card">
        <h2>📚 級を選択</h2>
        <div class="grade-btns" id="gradeBtns"></div>

        <div class="marathon-progress" id="marathonProgress"></div>

        <h2>📖 出題範囲</h2>
        <div class="id-range-group">
          <div class="id-range-row">
            <label class="id-range-label">📘 単語 ID <span class="id-range-info" id="wordRangeInfo"></span></label>
            <div class="id-range-inputs">
              <input type="number" id="wordIdStart" placeholder="開始" min="1" max="2000">
              <span class="id-range-sep">〜</span>
              <input type="number" id="wordIdEnd" placeholder="終了" min="1" max="2000">
            </div>
          </div>
          <div class="id-range-row">
            <label class="id-range-label">📙 熟語 ID <span class="id-range-info" id="idiomRangeInfo"></span></label>
            <div class="id-range-inputs">
              <input type="number" id="idiomIdStart" placeholder="開始" min="1" max="2000">
              <span class="id-range-sep">〜</span>
              <input type="number" id="idiomIdEnd" placeholder="終了" min="1" max="2000">
            </div>
          </div>
          <div class="id-range-hint">※ 空欄なら全範囲が対象になります</div>
        </div>

        <h2>⚙️ 出題設定</h2>
        <div class="config-row">
          <div class="config-item">
            <label>📦 問題数</label>
            <select id="questionCount">
              <option value="10">10問</option>
              <option value="20" selected>20問</option>
              <option value="30">30問</option>
              <option value="50">50問</option>
              <option value="0">全問</option>
            </select>
          </div>
          <div class="config-item">
            <label>🔀 出題順</label>
            <select id="questionOrder">
              <option value="random" selected>ランダム</option>
              <option value="sequential">順番通り</option>
            </select>
          </div>
        </div>

        <div class="summary-badge" id="summaryBadge">
          <div class="stat">📝 対象: <strong id="matchCount">0</strong>問</div>
          <div class="stat">🎯 出題: <strong id="pickCount">0</strong>問</div>
        </div>
        <button class="start-btn" id="startBtn" disabled>🚀 クイズ開始</button>
        <button class="mistake-review-home-btn" id="mistakeReviewBtn" onclick="showMistakeReviewModal()">📝 ミスした問題を復習</button>
      </div>
    </div>
    <div class="quiz-screen" id="quizScreen">
      <div class="score-bar" id="scoreBar">
        <button class="quiz-home-btn" onclick="goHome()" title="ホームに戻る">🏠</button>
        <span>⭕ <span class="correct-count" id="correctCount">0</span></span>
        <span class="accuracy" id="accuracy">0%</span>
        <span>❌ <span class="wrong-count" id="wrongCount">0</span></span>
      </div>
      <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
      <div class="question-header" id="questionHeader"></div>
      <div class="sentence-card" id="sentenceCard"></div>
      <div class="choices" id="choices"></div>
      <button class="hint-btn" id="hintBtn" onclick="showHint()">💡 ヒント①：例文の日本語訳</button>
      <button class="next-btn" id="nextBtn">次の問題 →</button>
    </div>
    <div class="result-screen" id="resultScreen"></div>
  `;

  initSetup();
  renderStreakBadge();
  showScreen('setup');
}

// Stubs for removed unlock functions
function showUnlockModal() {}
function closeUnlockModal() {}
function renderUnlockBadge() {}

document.addEventListener('DOMContentLoaded', init);
