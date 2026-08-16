<script setup lang="ts">
import type { ApiCall } from '../composables/useChromeLlm'

defineProps<{
  calls: ApiCall[]
  contextUsage: number
  contextWindow: number
}>()

defineEmits<{
  clear: []
}>()

function pretty(value: unknown) {
  if (value === undefined) return ''
  return JSON.stringify(value, null, 2)
}
</script>

<template>
  <section class="panel trace">
    <header class="panel-head">
      <span>◆ SYSOP LOG : API</span>
      <button type="button" class="ghost" :disabled="!calls.length" @click="$emit('clear')">
        [Z] Zap
      </button>
    </header>

    <div class="quota">
      <span>CTX {{ contextUsage }}/{{ contextWindow || '?' }}</span>
    </div>

    <div class="log-wrap">
      <ol v-if="calls.length" class="log">
        <li v-for="call in calls" :key="call.id" :data-status="call.status">
          <div class="log-head">
            <code>{{ call.status === 'pending' ? '…' : call.status === 'ok' ? '+' : '!' }} {{ call.method }}</code>
            <span class="meta">
              {{ call.at }}
              <template v-if="call.durationMs != null"> {{ call.durationMs }}ms</template>
            </span>
          </div>
          <pre v-if="call.request != null">{{ pretty(call.request) }}</pre>
          <pre v-if="call.response != null" class="response">{{ pretty(call.response) }}</pre>
        </li>
      </ol>
      <p v-else class="empty">
        availability / create / promptStreaming dump here. Scroll this column only.
      </p>
    </div>
  </section>
</template>
