# use-chrome-ai

A Vue + Vite demo of Chrome’s **Prompt API**. The page talks to **Gemini Nano on the user’s device** through `window.LanguageModel` — no cloud hop, no API key, no backend.

The UI is a two-pane BBS console: chat on the left, a live inspector on the right that logs the real native calls. A briefing view explains the same API in place.

**Live demo:** [https://use-chrome-ai-production.up.railway.app](https://use-chrome-ai-production.up.railway.app)

> The hosted site loads in any browser. On-device inference only works in Chrome with the Prompt API enabled (see [Requirements](#requirements)).

---

## Chrome Prompt API

The Prompt API is one of Chrome’s [built-in AI APIs](https://developer.chrome.com/docs/ai/built-in). It exposes a **foundation language model that ships with the browser** — Gemini Nano — so a web page can prompt it like a small local LLM.

That is the whole point of this repo: show the native surface, not a wrapper around OpenAI or a server.

Official docs: [developer.chrome.com/docs/ai/prompt-api](https://developer.chrome.com/docs/ai/prompt-api)

### Why it exists

| | |
| --- | --- |
| **Local** | Inference runs on the device. Prompts and replies do not leave the machine after the model weights are downloaded. |
| **No backend** | A rewrite tool, classifier, or chat UI can ship as a static site. This demo has zero server logic. |
| **No key** | There is no vendor account. Capability is `window.LanguageModel`, or it is not. |
| **Session memory** | A session keeps conversation context until you destroy it or the window fills. |

It is **not** a cloud model. Quality and context size are Nano-scale. Hardware, OS, and Chrome version all gate whether it runs at all.

### How you reach it

The constructor lives on `window`:

```ts
const LanguageModel = window.LanguageModel
if (!LanguageModel) {
  // Not Chrome 148+, or the flag is off.
}
```

A typical happy path is three calls:

```ts
const availability = await LanguageModel.availability({
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
})

const session = await LanguageModel.create({
  initialPrompts: [
    { role: 'system', content: 'You are a concise on-device assistant.' },
  ],
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(e.loaded) // 0 → 1
    })
  },
})

const stream = session.promptStreaming('Explain availability() in one sentence.')
for await (const chunk of stream) {
  // append chunk to the UI
}

session.destroy()
```

Pass the **same** `expectedInputs` / `expectedOutputs` to `availability()` and `create()`. The check is only meaningful if it matches the session you intend to open.

### `LanguageModel.availability(options?)`

Asks: *can this origin run Nano with these options?*

| Status | Meaning |
| --- | --- |
| `"unavailable"` | This device / OS / Chrome build cannot run the model. |
| `"downloadable"` | Capable, but the weights are not on disk yet. |
| `"downloading"` | A download is already in flight. |
| `"available"` | Ready to `create()` without waiting on a download. |

If `window.LanguageModel` is missing entirely, this demo reports **`unsupported`** (not a spec status — a UI stand-in for “wrong browser”).

### `LanguageModel.create(options?)`

Opens a **session**. The session is the unit of conversation: system prompt, prior turns, token budget.

Important constraints:

- **User gesture required.** A page load cannot start `create()`. Click **[C] Create** or send a message.
- **First create may download.** On a new origin the weights can take a long time. Attach a `monitor` and listen for `downloadprogress` (`loaded` goes `0 → 1`).
- **Options you will actually use:** `initialPrompts` (system / few-shot turns), `expectedInputs` / `expectedOutputs` (modality + languages), `signal` to abort, `temperature` / `topK` if you want sampling control.

This demo always creates with English text in/out and a BBS-flavored system prompt.

### Prompting: `prompt()` vs `promptStreaming()`

Both send input into the live session. Input can be a string or a list of `{ role, content }` messages.

| Method | Returns | Use when |
| --- | --- | --- |
| `session.prompt(input, options?)` | `Promise<string>` — the full reply | Short answers, structured output, you can wait |
| `session.promptStreaming(input, options?)` | `ReadableStream<string>` of chunks | Chat UIs; paint tokens as they arrive |

Optional prompt options:

- `signal` — abort the in-flight generation (`AbortController`)
- `responseConstraint` — JSON Schema for structured output

**This demo uses `promptStreaming()` only.** Chrome has shipped both *cumulative* and *delta* chunk shapes; `useChromeLlm` merges either so the transcript does not double.

### Session lifecycle

| Member | Role |
| --- | --- |
| `session.contextUsage` | Tokens currently held in the session |
| `session.contextWindow` | Max tokens for this session |
| `"contextoverflow"` | Older user/assistant turns were dropped so a new prompt could fit. The system prompt is kept. |
| `session.append(messages)` | Push context *before* the next prompt (useful for multimodal prep) |
| `session.clone()` | Fork the current context without repeating setup / download |
| `session.destroy()` | Abort work and release the session |

When the window fills, Nano does not fail silently forever — it evicts old turns. Listen for `contextoverflow` and tell the user.

### What this demo calls

| Step | Native call | UI |
| --- | --- | --- |
| 1 | `LanguageModel.availability(options)` | Status bar **AVAIL** |
| 2 | `LanguageModel.create({ …, monitor })` | **[C] Create**, download **DL** % |
| 3 | `session.promptStreaming(text, { signal })` | Chat pane; **[S] Stop** aborts |
| 4 | `session.contextUsage` / `session.contextWindow` | Inspector **CTX** |
| 5 | `session.destroy()` | **[D] Destroy** |

The right-hand **SYSOP LOG** is not a fake console. It dumps the request payload, status, duration, and response (or serialized `DOMException`) for each of those calls.

---

## Requirements

Chrome’s on-device model is gated by browser, hardware, and a flag.

| Need | Detail |
| --- | --- |
| Browser | Chrome **148+** (desktop: Windows, macOS 13+, Linux, or Chromebook Plus) |
| Disk | Roughly **22 GB** free on the profile volume for the model weights |
| Hardware | GPU with **>4 GB VRAM**, or **16 GB RAM + 4 cores** |
| Flag | `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled** (or Enabled multilingual) |
| Internals | Confirm the model at `chrome://on-device-internals` |

Other browsers, mobile Chrome, and older desktop builds will report `unsupported` or `unavailable`. That is expected.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL in Chrome (not another browser). The first session on an origin may download Gemini Nano; progress appears in the status bar and the inspector.

```bash
npm run build    # type-check + production bundle
npm run preview  # serve dist/ locally
```

## Using the demo

1. Enable the flag and reload.
2. Confirm **AVAIL** is `available`, `downloadable`, or `downloading`. If it stays `unsupported`, you are not in a Prompt API build of Chrome.
3. Press **[C] Create** (or type a message and send). The first create may take a while while weights download.
4. Chat in the left pane. Replies stream in; **[S] Stop** aborts the current prompt.
5. Watch the right pane for request/response dumps and the **CTX** quota.
6. **[D] Destroy** releases the session. **[X] Reset** clears the transcript. **[Z] Zap** clears the log.

The **[2] Briefing** tab is the same Prompt API overview inside the app, including copy-to-clipboard for `chrome://` URLs (those cannot be opened as ordinary hyperlinks).

## Project layout

```
src/
  App.vue                      # shell, status bar, Demo / Briefing
  composables/useChromeLlm.ts  # Prompt API wrapper + inspector log
  components/ChatPanel.vue     # transcript + composer
  components/ApiTrace.vue      # sysop log
  components/BriefingPage.vue  # in-app API notes
  types/prompt-api.d.ts        # LanguageModel typings for this demo
```

There is no server. Production is a static Vite build served by Caddy.

## Deploy

The app is set up for [Railway](https://docs.railway.com/guides/vue) from GitHub:

- `Dockerfile` — Node build, then Caddy serving `dist/`
- `Caddyfile` — gzip, `/health`, SPA fallback to `index.html`

Pushes to **`master`** trigger a redeploy. The GitHub default branch is still `main` (initial commit only); Railway is pointed at `master`.

## Learn more

- [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api)
- [Built-in AI on Chrome](https://developer.chrome.com/docs/ai/built-in)
- `chrome://flags/#prompt-api-for-gemini-nano`
- `chrome://on-device-internals`
