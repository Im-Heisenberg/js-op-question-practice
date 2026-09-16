const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");

const TOPIC_MAP = {
  "01": "Scope & Execution Context",
  "02": "Hoisting & TDZ",
  "03": "Closures",
  "04": "this",
  "05": "call / apply / bind",
  "06": "new & Constructor Functions",
  "07": "Prototypes & Prototype Chain",
  "08": "Promises",
  "09": "Event Loop & Microtasks",
  "10": "Array Methods",
  "11": "sort() & Comparators",
};

function clean(s) {
  if (!s) return "";
  return s.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function isGarbage(text) {
  const stripped = text.replace(/\s+/g, "");
  if (stripped.length < 20) return false;
  const nonDigits = stripped.replace(/[0-9]/g, "");
  return nonDigits.length / stripped.length < 0.15;
}

async function extractQuestions(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const data = await pdf(buf);
  const raw = data.text;

  const qIdRegex = /Q(\d{2})\s*-\s*(\d{2})/g;
  const matches = [];
  let m;
  while ((m = qIdRegex.exec(raw)) !== null) {
    matches.push({ topicId: m[1], num: m[2], index: m.index });
  }

  const seen = new Set();
  const results = [];

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const id = `Q${cur.topicId}-${cur.num}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const start = cur.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    const chunk = raw.slice(start, end);

    if (isGarbage(chunk)) {
      console.warn(`⚠️  Skipping garbled block for ${id}`);
      continue;
    }

    const cleaned = clean(chunk);
    let body = cleaned.replace(/^Q\d{2}\s*-\s*\d{2}/, "").trim();

    const collapsed = body.replace(/\s+/g, " ").toLowerCase();
    let difficulty = "Core output";
    if (collapsed.includes("boss / follow")) difficulty = "Boss / follow-up";
    else if (collapsed.includes("real interview")) difficulty = "Real interview";
    else if (collapsed.includes("tricky / edge case")) difficulty = "Tricky / edge case";
    else if (collapsed.includes("concept combination")) difficulty = "Concept combination";

    body = body
      .replace(/Core output/gi, "")
      .replace(/Concept combination/gi, "")
      .replace(/Tricky \/ edge case/gi, "")
      .replace(/Real interview/gi, "")
      .replace(/Boss \/ follow- up/gi, "")
      .replace(/Boss \/ follow-up/gi, "")
      .trim();

    let prompt = "What is the output?";
    const promptMatch = body.match(/(What (is|happens|does)[^?\n]*\?)/i);
    if (promptMatch) prompt = promptMatch[1].trim();

    let code = body;
    if (promptMatch) code = code.replace(promptMatch[1], "").trim();

    code = code
      .split(/My answer \/ output:/i)[0]
      .split(/My reasoning:/i)[0]
      .split(/→?\s*Open Answer Key/i)[0]
      .split(/Back to Questions/i)[0]
      .trim();

    results.push({
      id,
      topicId: cur.topicId,
      topic: TOPIC_MAP[cur.topicId] || "Unknown",
      difficulty,
      prompt,
      code,
      answer: "",
      why: "",
    });
  }
  return results;
}

async function extractAnswers(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const data = await pdf(buf);
  const raw = data.text;

  const qIdRegex = /Q(\d{2})\s*-\s*(\d{2})/g;
  const matches = [];
  let m;
  while ((m = qIdRegex.exec(raw)) !== null) {
    matches.push({ topicId: m[1], num: m[2], index: m.index });
  }

  const seen = new Set();
  const answers = {};

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const id = `Q${cur.topicId}-${cur.num}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const start = cur.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    const chunk = raw.slice(start, end);

    if (isGarbage(chunk)) continue;

    const cleaned = clean(chunk);
    const body = cleaned.split(/←?\s*Back to Questions/i)[0];

    const ansMatch = body.match(/Answer:\s*([\s\S]*?)(?:\n\s*Why:|$)/i);
    const whyMatch = body.match(/Why:\s*([\s\S]*?)$/i);

    answers[id] = {
      answer: ansMatch ? clean(ansMatch[1]) : "",
      why: whyMatch ? clean(whyMatch[1]) : "",
    };
  }
  return answers;
}

async function main() {
  const questionsPath = path.join(__dirname, "questions.pdf");
  const answersPath = path.join(__dirname, "answer-key.pdf");

  console.log("📖 Parsing questions PDF...");
  const questions = await extractQuestions(questionsPath);
  console.log(`   → extracted ${questions.length} questions`);

  console.log("📖 Parsing answer key PDF...");
  const answers = await extractAnswers(answersPath);
  console.log(`   → extracted ${Object.keys(answers).length} answers`);

  let missing = 0;
  for (const q of questions) {
    if (answers[q.id]) {
      q.answer = answers[q.id].answer;
      q.why = answers[q.id].why;
    } else {
      missing++;
      console.warn(`⚠️  No answer for ${q.id}`);
    }
  }

  const outDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "questions.json"), JSON.stringify(questions, null, 2));

  const byTopic = {};
  for (const q of questions) byTopic[q.topic] = (byTopic[q.topic] || 0) + 1;

  console.log("\n✅ Done.");
  console.log(`   Total: ${questions.length}  Missing answers: ${missing}`);
  console.log("\n   Per topic:");
  for (const [t, c] of Object.entries(byTopic)) console.log(`     ${t.padEnd(38)} ${c}`);
}

main().catch((e) => { console.error("❌ Failed:", e); process.exit(1); });