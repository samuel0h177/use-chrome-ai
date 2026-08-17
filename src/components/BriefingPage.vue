<script setup lang="ts">
const FLAG_URL = 'chrome://flags/#prompt-api-for-gemini-nano'
const DOCS_URL = 'https://developer.chrome.com/docs/ai/prompt-api'

defineProps<{
  copiedUrl: string | null
}>()

defineEmits<{
  copyUrl: [url: string]
}>()
</script>

<template>
  <section class="panel briefing">
    <header class="panel-head">
      <span>◆ BRIEFING : PROMPT API</span>
      <span>FILE 01 / OVERVIEW</span>
    </header>

    <div class="briefing-scroll">
      <article class="brief">
        <h2>01  WHAT IT IS</h2>
        <p>
          The <strong>Prompt API</strong> lets a web page talk to a foundation language model that
          ships with Chrome — <strong>Gemini Nano</strong> — running on the user's device. No
          cloud endpoint, no API key: prompts stay local after the model weights are downloaded.
        </p>
        <p>
          You reach it through <code>window.LanguageModel</code>. A session holds conversation
          context until you destroy it or the context window fills.
        </p>
        <pre class="snippet">const availability = await LanguageModel.availability()
const session = await LanguageModel.create()
const reply = await session.prompt('Hello')</pre>
      </article>

      <article class="brief">
        <h2>02  WHY IT MATTERS</h2>
        <ul>
          <li><span class="tag">LOCAL</span> Inference happens in the browser; good for private text.</li>
          <li><span class="tag">ZERO SERVER</span> No backend required for a basic chat or rewrite tool.</li>
          <li><span class="tag">NATIVE</span> Same surface as other Chrome built-in AI APIs (Summarizer, Writer…).</li>
        </ul>
        <p>
          Hardware and OS gates apply (desktop Chrome, free disk for the model, GPU/RAM floors).
          Enable the flag
          <button type="button" class="copy-link" @click="$emit('copyUrl', FLAG_URL)">
            {{ copiedUrl === FLAG_URL ? 'copied!' : FLAG_URL }}
          </button>
          and inspect downloads at <code>chrome://on-device-internals</code>.
        </p>
      </article>

      <article class="brief">
        <h2>03  CORE FLOW</h2>
        <ol class="flow">
          <li><code>availability()</code> — can this device run the model with your options?</li>
          <li><code>create()</code> — open a session (may download Nano; needs a user gesture).</li>
          <li><code>prompt()</code> / <code>promptStreaming()</code> — send text, get a reply.</li>
          <li><code>destroy()</code> — free the session when you are done.</li>
        </ol>
      </article>

      <article class="brief">
        <h2>04  KEY FUNCTIONS</h2>

        <div class="fn">
          <h3>LanguageModel.availability(options?)</h3>
          <p>
            Returns <code>"unavailable"</code>, <code>"downloadable"</code>,
            <code>"downloading"</code>, or <code>"available"</code>. Pass the same
            <code>expectedInputs</code> / <code>expectedOutputs</code> you plan to use in
            <code>create()</code> so the check matches the session.
          </p>
          <pre class="snippet">await LanguageModel.availability({
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
})</pre>
        </div>

        <div class="fn">
          <h3>LanguageModel.create(options?)</h3>
          <p>
            Builds a session. Optional: <code>initialPrompts</code> (system / prior turns),
            language + modality expectations, <code>signal</code> to abort, and
            <code>monitor</code> for download progress. First call on an origin may pull the
            model; show progress to the user.
          </p>
          <pre class="snippet">const session = await LanguageModel.create({
  initialPrompts: [
    { role: 'system', content: 'You are a concise assistant.' },
  ],
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(e.loaded) // 0 → 1
    })
  },
})</pre>
        </div>

        <div class="fn">
          <h3>session.prompt(input, options?)</h3>
          <p>
            One-shot reply when the full string is ready. Good for short answers. Pass
            <code>signal</code> to cancel, or <code>responseConstraint</code> (JSON Schema) for
            structured output.
          </p>
          <pre class="snippet">const text = await session.prompt('Summarize this in one line.')</pre>
        </div>

        <div class="fn">
          <h3>session.promptStreaming(input, options?)</h3>
          <p>
            Returns a <code>ReadableStream</code> of chunks. Prefer this for longer replies so
            the UI can update as tokens arrive. This demo uses streaming for the chat pane.
          </p>
          <pre class="snippet">const stream = session.promptStreaming('Write a short poem.')
for await (const chunk of stream) {
  // append chunk to the UI
}</pre>
        </div>

        <div class="fn">
          <h3>session.contextUsage / session.contextWindow</h3>
          <p>
            Token budget for the live session. Older user/assistant pairs can be dropped on
            overflow; the system prompt is kept. Listen for <code>contextoverflow</code> to warn
            the user.
          </p>
          <pre class="snippet">console.log(`${session.contextUsage}/${session.contextWindow}`)
session.addEventListener('contextoverflow', () => {
  console.log('older turns were evicted')
})</pre>
        </div>

        <div class="fn">
          <h3>session.destroy() · session.clone() · session.append()</h3>
          <p>
            <code>destroy()</code> aborts work and releases the session.
            <code>clone()</code> forks context without redoing setup.
            <code>append()</code> adds context ahead of the next prompt (useful with multimodal
            prep).
          </p>
        </div>
      </article>

      <article class="brief">
        <h2>05  HOW THIS DEMO MAPS</h2>
        <ul>
          <li>Status bar → <code>availability()</code> + download monitor from <code>create()</code></li>
          <li>Chat pane → <code>promptStreaming()</code> into one shared session</li>
          <li>Sysop log → live trace of those native calls</li>
        </ul>
        <p>
          Full docs:
          <a :href="DOCS_URL" target="_blank" rel="noopener noreferrer">{{ DOCS_URL }}</a>
        </p>
      </article>
    </div>
  </section>
</template>
