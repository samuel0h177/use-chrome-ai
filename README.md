# use-chrome-ai

Vue + Vite demo of Chrome’s [Prompt API](https://developer.chrome.com/docs/ai/prompt-api). The chatbot talks to **Gemini Nano on-device** via `window.LanguageModel`. The inspector on the side logs the real calls: `availability()`, `create()`, `promptStreaming()`, and `destroy()`.

## Requirements

- Chrome **148+** (desktop: Windows, macOS 13+, Linux, or Chromebook Plus)
- Enough disk (~22 GB free on the profile volume) and hardware (GPU with >4 GB VRAM, or 16 GB RAM + 4 cores)
- Flag: `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled** (or Enabled multilingual)
- Confirm the model at `chrome://on-device-internals`

`create()` needs a user gesture. Use **Create session** or send a message.

## Run

```bash
npm install
npm run dev
```

Open the local URL in Chrome (not another browser). First session may download Gemini Nano; progress is shown in the status bar and inspector.

## What the demo calls

1. `LanguageModel.availability({ expectedInputs, expectedOutputs })`
2. `LanguageModel.create({ initialPrompts, expectedInputs, expectedOutputs, monitor })`
3. `session.promptStreaming(userText, { signal })`
4. `session.contextUsage` / `session.contextWindow`
5. `session.destroy()` when you tear the session down
