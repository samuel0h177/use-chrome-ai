<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { ChatMessage } from '../composables/useChromeLlm'

const props = defineProps<{
  messages: ChatMessage[]
  busy: boolean
  ready: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
  stop: []
}>()

const draft = ref('')
const scroller = ref<HTMLElement | null>(null)

watch(
  () => props.messages.map((message) => message.content).join('\n'),
  async () => {
    await nextTick()
    if (scroller.value) {
      scroller.value.scrollTop = scroller.value.scrollHeight
    }
  },
)

function submit() {
  const text = draft.value
  if (!text.trim() || props.busy) return
  emit('send', text)
  draft.value = ''
}
</script>

<template>
  <section class="panel chat">
    <header class="panel-head">
      <span>◆ MESSAGE BASE : CHAT</span>
      <span class="pill" :data-live="ready">{{ ready ? '● CARRIER' : '○ NO CARRIER' }}</span>
    </header>

    <div ref="scroller" class="transcript">
      <p v-if="!messages.length" class="empty">
        Wait for carrier. Type a message after LanguageModel.create(). Scroll stays in this pane.
      </p>
      <article
        v-for="message in messages"
        :key="message.id"
        class="bubble"
        :data-role="message.role"
      >
        <span class="who">{{ message.role === 'user' ? '&lt;YOU&gt;' : '&lt;NANO&gt;' }}</span>
        <p>{{ message.content }}<span v-if="message.streaming" class="caret" /></p>
      </article>
    </div>

    <form class="composer" @submit.prevent="submit">
      <label class="prompt-label" for="draft">{{ busy ? 'WAIT' : 'OK' }}&gt;</label>
      <textarea
        id="draft"
        v-model="draft"
        rows="2"
        :disabled="busy"
        placeholder="enter message, then SEND"
        @keydown.enter.exact.prevent="submit"
      />
      <div class="composer-actions">
        <button v-if="busy" type="button" class="ghost" @click="emit('stop')">[S] Stop</button>
        <button type="submit" :disabled="busy || !draft.trim()">[ENTER] Send</button>
      </div>
    </form>
  </section>
</template>
