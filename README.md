# JS Output Practice

An interactive, mobile-friendly web app for daily JavaScript output-based interview practice — built from two PDFs (330 questions + answer key), with **topic-wise accuracy tracking** and **progress saved locally**.

---

## What It Does

- **330 JavaScript questions** across **11 topics**, each tagged by difficulty
  (`Core output` · `Concept combination` · `Tricky / edge case` · `Real interview` · `Boss / follow-up`)
- **Practice by topic** — pick from the sidebar, work through the 30 questions in that topic
- **Self-graded flow** — predict the output, reveal the answer + explanation, mark yourself:
  - ✅ **Got it** — correct
  - 🤔 **Partial** — mostly right
  - ❌ **Missed** — wrong
- **Topic-wise accuracy** — every topic shows `X/Y correct · Z% · N/M attempted` with a progress bar
- **Three modes**
  - `Practice` — sequential through the current topic
  - `Review` — only questions you marked Missed or Partial
  - `Random` — shuffled mix
- **Streak + daily count** — nudges you to keep going
- **Export / Import progress** as JSON
- **Works offline** after first load (data is a static JSON file)
- **Mobile-first responsive** — off-canvas drawer, sticky header, tap-friendly buttons

---

## Tech Stack

- **Vanilla HTML / CSS / JavaScript** — no frameworks
- **Prism.js** (CDN) — syntax highlighting for code snippets
- **localStorage** — all progress stays on the device
- **Node + pdf-parse** — one-time script to extract questions from the PDFs into JSON

---

## Project Structure
