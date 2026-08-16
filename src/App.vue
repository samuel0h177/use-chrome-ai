<script setup lang="ts">
import ApiTrace from './components/ApiTrace.vue'
import ChatPanel from './components/ChatPanel.vue'
import { computed, ref } from 'vue'
import { useChromeLlm } from './composables/useChromeLlm'

const {
  availability,
  downloadProgress,
  contextUsage,
  contextWindow,
  messages,
  apiCalls,
  busy,
  statusNote,
  ready,
  checkAvailability,
  createSession,
  sendPrompt,
  stopPrompt,
  destroySession,
  clearChat,
  clearTrace,
} = useChromeLlm()

const progressLabel = computed(() => {
  if (downloadProgress.value == null) return null
  return `${Math.round(downloadProgress.value * 100)}%`
})

const FLAG_URL = 'chrome://flags/#prompt-api-for-gemini-nano'
const INTERNALS_URL = 'chrome://on-device-internals'
const copiedUrl = ref<string | null>(null)
let copyReset: ReturnType<typeof setTimeout> | undefined

async function copyChromeUrl(url: string) {
  await navigator.clipboard.writeText(url)
  copiedUrl.value = url
  clearTimeout(copyReset)
  copyReset = setTimeout(() => {
    copiedUrl.value = null
  }, 1600)
}
</script>

<template>
  <div class="crt">
    <header class="banner">
      <pre class="ansi">
 █▄ █ ▄▀█ █▄ █ █▀█  █▄▄ █▄▄ █▀    ∙  NODE 01  ∙  GEMINI NANO  ∙  2400-8-N-1
 █ ▀█ █▀█ █ ▀█ █▄█  █▄█ █▄█ ▄█    use-chrome-ai  //  Prompt API  //  LOCAL
      </pre>
      <p class="lede">
        On-device chat via window.LanguageModel — no cloud hop. First create() may download the model.
        Enable
        <button type="button" class="copy-link" @click="copyChromeUrl(FLAG_URL)">
          {{ copiedUrl === FLAG_URL ? 'copied!' : FLAG_URL }}
        </button>
        then check
        <button type="button" class="copy-link" @click="copyChromeUrl(INTERNALS_URL)">
          {{ copiedUrl === INTERNALS_URL ? 'copied!' : INTERNALS_URL }}
        </button>
        (click to copy, paste into the omnibox).
      </p>
    </header>

    <aside class="status">
      <div class="status-row">
        <span>AVAIL:</span>
        <strong class="hi">{{ availability }}</strong>
        <template v-if="progressLabel">
          <span>DL:</span>
          <strong class="hi">{{ progressLabel }}</strong>
        </template>
        <span>NODE:</span>
        <strong :class="ready ? 'ok' : 'dim'">{{ ready ? 'ONLINE' : 'OFFLINE' }}</strong>
      </div>
      <p class="note">{{ statusNote }}</p>
      <nav class="toolbar">
        <button type="button" class="ghost" @click="checkAvailability()">[R] Recheck</button>
        <button type="button" :disabled="busy" @click="createSession()">[C] Create</button>
        <button type="button" class="ghost" :disabled="!ready" @click="destroySession()">[D] Destroy</button>
        <button type="button" class="ghost" @click="clearChat()">[X] Reset</button>
      </nav>
    </aside>

    <main class="workspace">
      <ChatPanel :messages="messages" :busy="busy" :ready="ready" @send="sendPrompt" @stop="stopPrompt" />
      <ApiTrace
        :calls="apiCalls"
        :context-usage="contextUsage"
        :context-window="contextWindow"
        @clear="clearTrace"
      />
    </main>
  </div>
</template>
