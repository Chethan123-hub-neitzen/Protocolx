# 💬 Chat Summarizer

A modern, fast, and **100% client-side** web application for parsing and summarizing WhatsApp chats using fast Groq LLM inference (`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`).

---

## 🌟 Key Highlights

- **🔒 100% Client-Side & Local Privacy:** Uses the browser's native **HTML5 File API** (`FileReader`). Your chats are never uploaded to any intermediary servers. Only the direct, encrypted HTTPS request travels from your browser to Groq.
- **🔑 Bring Your Own Key (BYOK):** Seamless Groq API key configuration stored in your browser's `localStorage`. Also supports custom OpenAI-compatible endpoints (OpenAI, OpenRouter, Local Ollama).
- **⚡ Built for Groq Inference:** Configured with low temperature and structured JSON mode (`response_format: { type: "json_object" }`) for high speed and deterministic accuracy.
- **📱 Universal WhatsApp Parser:**
  - Supports **iOS** bracketed exports: `[DD/MM/YY, HH:MM:SS] Sender: Message`
  - Supports **Android** standard exports: `DD/MM/YYYY, HH:MM - Sender: Message`
  - Strips invisible unicode formatting artifacts (`\u200e`, `\u202f`, `\u200b`)
  - Auto-cleans WhatsApp system messages (*"Messages and calls are end-to-end encrypted"*, group changes, security notices)
  - Replaces media placeholders (`<Media omitted>`, `image omitted`) to conserve LLM tokens
  - Handles multiline messages seamlessly
- **✂️ Intelligent Context Window Slicing:** Automatically preserves token budgets by slicing the most recent messages (configurable: 1,500, 3,000, 6,000, 12,000 words or full chat), ensuring you never exceed Groq's TPM or context limits.
- **📊 Executive Dashboard Breakdown:**
  - 📌 **Executive Summary**: High-level synthesis of discussion flow and vibe.
  - ⚡ **Important Decisions**: Urgency-graded decisions (Urgent, High, Normal) with assignees and context.
  - ✅ **Action Items & Tasks**: Interactive checklist with checkboxes that strike-through when completed.
  - 📅 **Deadlines & Milestones**: Time-sensitive deliverables with status indicators.
  - 📣 **Highlighted @Mentions**: Track who was mentioned and what was requested of them.
- **🔍 Ground-Truth Verification & Timestamp Highlighting:**
  - Click **"Verify in Chat (📅 Timestamp)"** on any Decision, Action Item, @Mention, or Deadline to immediately inspect the source message.
  - Automatically highlights the matching chat line with glowing pulse animations (`highlight-flash`) and displays the **exact date and time sent** and the sender.
  - Interactive **Transcript Browser** with live search, `<mark>` keyword highlighting, participant filtering, and 1-click message copying.
  - Select any text in the summary with your mouse to trigger a floating **"Verify in Chat"** button!
- **🚀 One-Click Sample Chat:** Test immediately with an embedded sprint planning chat without needing an export file on hand.
- **📋 Export Options:** Copy as clean Markdown, export structured JSON, or print/save as PDF.

---

## 🚀 Quick Start (Running in Any Browser)

Because this is a zero-dependency, pure client-side application:

### Option 1: Double-Click (No Installation Required)
Simply double-click [`index.html`](file:///c:/Users/Chethan%20P/OneDrive/Desktop/protocol%20x/index.html) in your file explorer to open it in Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari.

### Option 2: Run a Local Development Server
If you prefer running via a local server:

```bash
# Using Node.js npx:
npx serve .

# Or using Python 3:
python -m http.server 3000
```
Then visit `http://localhost:3000`.

---

## 🔑 Getting a Free Groq API Key

1. Go to [Groq Console](https://console.groq.com/keys).
2. Sign in or create a free account.
3. Click **"Create API Key"** and copy your `gsk_...` key.
4. Open the Chat Summarizer web app, click **Settings**, paste your key, and click **Save Settings**.
5. Your key is stored securely in your browser's `localStorage` and never leaves your computer.

---

## 📱 How to Export a WhatsApp Chat

### On iPhone (iOS):
1. Open the WhatsApp chat or group you wish to summarize.
2. Tap the contact or group name at the very top.
3. Scroll down and tap **Export Chat**.
4. Select **Without Media** (this generates a `.txt` file).
5. Share or save the `_chat.txt` to your computer.

### On Android:
1. Open the WhatsApp chat or group.
2. Tap the three dots menu (**⋮**) in the top right corner.
3. Tap **More** &rarr; **Export chat**.
4. Choose **Without Media**.
5. Transfer the `.txt` export to your computer.

---

## 📂 Project Architecture

```
protocol x/
├── index.html          # Main HTML document with Tailwind CSS, Lucide icons & structure
├── css/
│   └── styles.css      # Design tokens, glassmorphism, animations & print styling
├── js/
│   ├── parser.js       # Universal WhatsApp parser, unicode sanitizer & word slicer
│   ├── api.js          # Groq & OpenAI-compatible LLM client with structured JSON schema
│   ├── sample-data.js  # Realistic embedded sample chat for immediate testing
│   └── app.js          # UI controller, File API ingestion, interactive checklist & exports
└── README.md           # Documentation and guide
```

---

## 🛡️ Privacy Guarantee

| Concern | Guarantee |
|---|---|
| Where does the `.txt` file upload? | **Nowhere.** It is read into browser memory via HTML5 `FileReader`. |
| Are chats stored on an intermediate server? | **No.** There is no backend server. The repository is 100% static client-side code. |
| Where is the API key saved? | In your browser's private `localStorage`. |
| What is sent to Groq? | Only the sliced, cleaned conversation text for summarization. |
