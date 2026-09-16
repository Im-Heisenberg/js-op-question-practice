// ---------- Heuristic code formatter ----------
// Not a full parser — just enough to clean up PDF-extracted snippets.
// In app.js, replace your formatCode() with this:
function formatCode(src) {
  if (!src) return "";
  // `js_beautify` is exposed on the global object by the CDN script
  return js_beautify(src, {
    indent_size: 2,
    space_in_empty_paren: true, // Optional: adds a space in `()`
    preserve_newlines: true,    // Keeps your intended line breaks
    max_preserve_newlines: 2,   // Limits excessive blank lines
  });
}
const FORMAT_CACHE = new Map();
function getFormatted(code) {
  if (!FORMAT_CACHE.has(code)) FORMAT_CACHE.set(code, formatCode(code));
  return FORMAT_CACHE.get(code);
}
// ---------- Mobile drawer ----------
const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("backdrop");
const menuToggle = document.getElementById("menuToggle");
const closeSidebar = document.getElementById("closeSidebar");

function openDrawer() {
  sidebar.classList.add("open");
  backdrop.classList.add("show");
}
function closeDrawer() {
  sidebar.classList.remove("open");
  backdrop.classList.remove("show");
}
menuToggle.addEventListener("click", openDrawer);
closeSidebar.addEventListener("click", closeDrawer);
backdrop.addEventListener("click", closeDrawer);
const STORAGE_KEY = "jsPractice.v1";
let QUESTIONS = [];
let state = {
  progress: {},        // { "Q01-01": { status: "correct"|"partial"|"missed", attempts, lastSeen } }
  streak: { current: 0, lastDate: null },
  todayCount: 0,
  todayDate: null,
};
let currentTopic = null;
let currentQueue = [];
let currentIdx = 0;
let currentMode = "practice";

// ---------- Persistence ----------
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch { }
  rollToday();
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function today() { return new Date().toISOString().slice(0, 10); }
function rollToday() {
  const t = today();
  if (state.todayDate !== t) {
    state.todayDate = t;
    state.todayCount = 0;
  }
  // streak logic
  if (state.streak.lastDate) {
    const last = new Date(state.streak.lastDate);
    const now = new Date(t);
    const diff = Math.round((now - last) / 86400000);
    if (diff > 1) state.streak.current = 0;
  }
  save();
}
function markPracticed() {
  rollToday();
  state.todayCount += 1;
  const t = today();
  if (state.streak.lastDate !== t) {
    const last = state.streak.lastDate;
    if (last) {
      const diff = Math.round((new Date(t) - new Date(last)) / 86400000);
      state.streak.current = diff === 1 ? state.streak.current + 1 : 1;
    } else {
      state.streak.current = 1;
    }
    state.streak.lastDate = t;
  }
  save();
  renderHeader();
}

// ---------- Stats ----------
function topicStats(topicId) {
  const qs = QUESTIONS.filter(q => q.topicId === topicId);
  let correct = 0, partial = 0, missed = 0, attempted = 0;
  for (const q of qs) {
    const p = state.progress[q.id];
    if (!p) continue;
    attempted++;
    if (p.status === "correct") correct++;
    else if (p.status === "partial") partial++;
    else if (p.status === "missed") missed++;
  }
  const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
  return { total: qs.length, correct, partial, missed, attempted, accuracy };
}

// ---------- Render ----------
function renderHeader() {
  document.getElementById("streak").textContent = `🔥 ${state.streak.current}`;
  document.getElementById("todayCount").textContent = `Today: ${state.todayCount}`;
}

function renderTopics() {
  const el = document.getElementById("topics");
  const topics = [...new Set(QUESTIONS.map(q => q.topicId))].sort();
  el.innerHTML = topics.map(tid => {
    const topic = QUESTIONS.find(q => q.topicId === tid).topic;
    const s = topicStats(tid);
    const pct = s.total ? Math.round((s.attempted / s.total) * 100) : 0;
    return `
      <div class="topic-item ${tid === currentTopic ? "active" : ""}" data-topic="${tid}">
        <div class="topic-title">${tid}. ${topic}</div>
        <div class="topic-meta">
          <span>${s.correct}/${s.attempted || 0} correct</span>
          <span>${s.accuracy}%</span>
        </div>
        <div class="topic-bar"><div style="width:${pct}%"></div></div>
        <div class="topic-meta"><span>${s.attempted}/${s.total} attempted</span></div>
      </div>
    `;
  }).join("");

  el.querySelectorAll(".topic-item").forEach(node => {
    node.addEventListener("click", () => {
      currentTopic = node.dataset.topic;
      buildQueue();
      renderTopics();
      renderQuestion();
      // Auto-close drawer on mobile
      if (window.innerWidth <= 768) closeDrawer();
    });
  });
}

function buildQueue() {
  let pool = QUESTIONS.filter(q => q.topicId === currentTopic);
  if (currentMode === "review") {
    pool = QUESTIONS.filter(q => state.progress[q.id]?.status === "missed" || state.progress[q.id]?.status === "partial");
    if (currentTopic) pool = pool.filter(q => q.topicId === currentTopic);
  } else if (currentMode === "random") {
    pool = [...pool].sort(() => Math.random() - 0.5);
  }
  currentQueue = pool;
  currentIdx = 0;
}

function renderQuestion() {
  const card = document.getElementById("questionCard");
  const empty = document.getElementById("emptyState");
  const counter = document.getElementById("counter");

  if (!currentQueue.length) {
    card.style.display = "none";
    empty.style.display = "block";
    empty.textContent = currentTopic ? "No questions match this mode." : "Select a topic to begin.";
    counter.textContent = "";
    return;
  }
  card.style.display = "block";
  empty.style.display = "none";
  counter.textContent = `${currentIdx + 1} / ${currentQueue.length}`;

  const q = currentQueue[currentIdx];
  const p = state.progress[q.id];

  card.innerHTML = `
    <div class="q-head">
      <span class="q-id">${q.id}</span>
      <span class="badge">${q.difficulty}</span>
    </div>
    <div class="prompt">${q.prompt}</div>
    <div class="code-head">
      <span class="code-label">Code</span>
      <button class="format-btn" id="formatBtn" title="Reformat code">✨ Format</button>
    </div>
    <pre><code class="language-javascript" id="codeBlock">${escapeHtml(q.code)}</code></pre>
    <textarea id="userAnswer" placeholder="Your predicted output..." rows="3"></textarea>
    <div class="actions" id="actions">
      <button class="primary" id="revealBtn">Reveal answer</button>
      <button class="ghost" id="skipBtn">Skip</button>
    </div>
    <div id="revealBox"></div>
    ${p ? `<div class="status-done">Last time: ${p.status} · attempts: ${p.attempts}</div>` : ""}
  `;

  Prism.highlightAllUnder(card);
  const codeBlock = document.getElementById("codeBlock");
  const formatBtn = document.getElementById("formatBtn");
  let isFormatted = false;

  formatBtn.addEventListener("click", () => {
    isFormatted = !isFormatted;
    const nextCode = isFormatted ? getFormatted(q.code) : q.code;
    codeBlock.textContent = nextCode;
    codeBlock.className = "language-javascript";
    Prism.highlightElement(codeBlock);
    formatBtn.textContent = isFormatted ? "↩︎ Original" : "✨ Format";
    formatBtn.classList.toggle("active", isFormatted);
  });
  document.getElementById("revealBtn").addEventListener("click", reveal);
  document.getElementById("skipBtn").addEventListener("click", next);
}

function reveal() {
  const q = currentQueue[currentIdx];
  const box = document.getElementById("revealBox");
  const actions = document.getElementById("actions");
  actions.style.display = "none";

  box.innerHTML = `
    <div class="reveal">
      <h3>Answer</h3>
      <div class="answer">${escapeHtml(q.answer || "(no answer extracted)")}</div>
      <h3>Why</h3>
      <div class="why">${escapeHtml(q.why || "(no explanation extracted)")}</div>
      <div class="actions" style="margin-top:16px">
        <button class="good" data-status="correct">✅ Got it</button>
        <button class="warn" data-status="partial">🤔 Partial</button>
        <button class="bad" data-status="missed">❌ Missed</button>
      </div>
    </div>
  `;

  box.querySelectorAll("[data-status]").forEach(btn => {
    btn.addEventListener("click", () => {
      recordAnswer(q.id, btn.dataset.status);
      next();
    });
  });
}

function recordAnswer(id, status) {
  const p = state.progress[id] || { attempts: 0 };
  p.status = status;
  p.attempts = (p.attempts || 0) + 1;
  p.lastSeen = Date.now();
  state.progress[id] = p;
  save();
  markPracticed();
  renderTopics();
}

function next() {
  currentIdx++;
  if (currentIdx >= currentQueue.length) {
    // wrap or stop
    currentIdx = 0;
  }
  renderQuestion();
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---------- Mode bar ----------
document.querySelectorAll(".mode").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.mode;
    buildQueue();
    renderQuestion();
  });
});

// ---------- Export / Import / Reset ----------
document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `js-practice-progress-${today()}.json`;
  a.click();
});
document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFile").click();
});
document.getElementById("importFile").addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      state = { ...state, ...imported };
      save();
      renderHeader(); renderTopics(); renderQuestion();
      alert("Imported ✅");
    } catch { alert("Bad file"); }
  };
  reader.readAsText(f);
});
document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("Erase all progress?")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

// ---------- Boot ----------
async function boot() {
  const res = await fetch("questions.json");
  if (!res.ok) {
    document.body.innerHTML = "<p style='padding:40px;font-family:sans-serif'>❌ Could not load <code>../data/questions.json</code>. Run the extractor first and serve from a local server.</p>";
    return;
  }
  QUESTIONS = await res.json();
  load();
  renderHeader();
  renderTopics();
  // auto-select first topic
  const first = QUESTIONS[0];
  if (first) { currentTopic = first.topicId; buildQueue(); renderTopics(); renderQuestion(); }
}
boot();