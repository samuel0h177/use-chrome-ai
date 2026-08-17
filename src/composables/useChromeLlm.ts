import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'

export type ApiCallStatus = 'pending' | 'ok' | 'error'

export interface ApiCall {
  id: number
  at: string
  method: string
  status: ApiCallStatus
  request: unknown
  response?: unknown
  durationMs?: number
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

//const SYSTEM_PROMPT =
//  'You are a concise on-device assistant running as Gemini Nano inside Chrome. Keep answers helpful and relatively short unless the user asks for more.'
const SYSTEM_PROMPT = 'You are a smart and robotic assistant. Answer questions in a very flat and short manner. Use 90s BBS slang and terminology.'
const SESSION_OPTIONS = {
  expectedInputs: [{ type: 'text' as const, languages: ['en'] }],
  expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
  initialPrompts: [{ role: 'system' as const, content: SYSTEM_PROMPT }],
}

function languageModel(): LanguageModelConstructor | undefined {
  return window.LanguageModel
}

function nowStamp() {
  return new Date().toLocaleTimeString(undefined, { hour12: false, fractionalSecondDigits: 3 })
}

function serializeError(error: unknown) {
  if (error instanceof DOMException) {
    return { name: error.name, message: error.message }
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }
  return String(error)
}

/** Chrome has shipped both cumulative and delta streaming chunks. */
function mergeStreamChunk(assembled: string, chunk: string) {
  if (!assembled) return chunk
  if (chunk.startsWith(assembled)) return chunk
  return assembled + chunk
}

export function useChromeLlm() {
  const availability = ref<LanguageModelAvailability | 'unsupported' | 'checking'>('checking')
  const downloadProgress = ref<number | null>(null)
  const session = shallowRef<LanguageModel | null>(null)
  const contextUsage = ref(0)
  const contextWindow = ref(0)
  const messages = ref<ChatMessage[]>([])
  const apiCalls = ref<ApiCall[]>([])
  const busy = ref(false)
  const statusNote = ref('')

  let nextCallId = 1
  let nextMessageId = 1
  let promptController: AbortController | null = null

  const supported = computed(() => availability.value !== 'unsupported')
  const ready = computed(() => session.value != null)

  function syncQuota() {
    const current = session.value
    if (!current) {
      contextUsage.value = 0
      contextWindow.value = 0
      return
    }
    contextUsage.value = current.contextUsage
    contextWindow.value = current.contextWindow
  }

  function startCall(method: string, request: unknown): ApiCall {
    const call: ApiCall = {
      id: nextCallId++,
      at: nowStamp(),
      method,
      status: 'pending',
      request,
    }
    apiCalls.value = [call, ...apiCalls.value]
    return call
  }

  function finishCall(call: ApiCall, status: ApiCallStatus, started: number, response?: unknown) {
    call.status = status
    call.durationMs = Math.round(performance.now() - started)
    call.response = response
  }

  async function checkAvailability() {
    const api = languageModel()
    if (!api) {
      availability.value = 'unsupported'
      statusNote.value =
        'LanguageModel is missing. Use Chrome 148+ and enable chrome://flags/#prompt-api-for-gemini-nano.'
      return
    }

    const call = startCall('LanguageModel.availability()', SESSION_OPTIONS)
    const started = performance.now()
    try {
      const result = await api.availability(SESSION_OPTIONS)
      availability.value = result
      finishCall(call, 'ok', started, result)
      if (result === 'unavailable') {
        statusNote.value = 'This device cannot run the on-device model (check disk, RAM/GPU, and OS).'
      } else if (result === 'downloadable' || result === 'downloading') {
        statusNote.value = 'The Gemini Nano weights still need to download. Start a session to begin.'
      } else {
        statusNote.value = 'Model is ready. Start a session, then chat.'
      }
    } catch (error) {
      availability.value = 'unavailable'
      finishCall(call, 'error', started, serializeError(error))
      statusNote.value = 'availability() failed. See the API trace for details.'
    }
  }

  async function createSession() {
    const api = languageModel()
    if (!api) return

    busy.value = true
    downloadProgress.value = null
    const createPayload = {
      ...SESSION_OPTIONS,
      monitor: '(monitor) => monitor.addEventListener("downloadprogress", …)',
    }
    const call = startCall('LanguageModel.create()', createPayload)
    const started = performance.now()

    try {
      const next = await api.create({
        ...SESSION_OPTIONS,
        monitor(monitor) {
          monitor.addEventListener('downloadprogress', (event) => {
            const progress = event as DownloadProgressEvent
            downloadProgress.value = progress.loaded
          })
        },
      })

      session.value?.destroy()
      session.value = next
      next.addEventListener('contextoverflow', () => {
        statusNote.value = 'Context overflow: older turns were dropped so the new prompt could fit.'
        const overflow = startCall('session "contextoverflow"', null)
        finishCall(overflow, 'ok', performance.now(), 'older conversation turns were evicted')
        syncQuota()
      })
      syncQuota()
      availability.value = 'available'
      downloadProgress.value = 1
      finishCall(call, 'ok', started, {
        contextUsage: next.contextUsage,
        contextWindow: next.contextWindow,
      })
      statusNote.value = 'Session created. Prompts now reuse this conversation context.'
    } catch (error) {
      finishCall(call, 'error', started, serializeError(error))
      statusNote.value = 'create() failed. A user gesture is required, and the model may still be downloading.'
    } finally {
      busy.value = false
    }
  }

  async function sendPrompt(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy.value) return

    if (!session.value) {
      await createSession()
    }
    const current = session.value
    if (!current) return

    const userMessage: ChatMessage = { id: nextMessageId++, role: 'user', content: trimmed }
    const assistantMessage: ChatMessage = {
      id: nextMessageId++,
      role: 'assistant',
      content: '',
      streaming: true,
    }
    messages.value = [...messages.value, userMessage, assistantMessage]

    busy.value = true
    promptController = new AbortController()
    const call = startCall('session.promptStreaming()', {
      input: trimmed,
      options: { signal: 'AbortSignal' },
    })
    const started = performance.now()

    try {
      const stream = current.promptStreaming(trimmed, { signal: promptController.signal })
      let assembled = ''
      for await (const chunk of stream) {
        assembled = mergeStreamChunk(assembled, chunk)
        assistantMessage.content = assembled
      }
      assistantMessage.streaming = false
      syncQuota()
      finishCall(call, 'ok', started, {
        text: assembled,
        contextUsage: current.contextUsage,
        contextWindow: current.contextWindow,
      })
    } catch (error) {
      assistantMessage.streaming = false
      if (!assistantMessage.content) {
        assistantMessage.content = 'The prompt did not complete. Check the API trace.'
      }
      finishCall(call, 'error', started, serializeError(error))
    } finally {
      promptController = null
      busy.value = false
    }
  }

  function stopPrompt() {
    promptController?.abort()
  }

  function destroySession() {
    const current = session.value
    if (!current) return
    const call = startCall('session.destroy()', null)
    const started = performance.now()
    current.destroy()
    session.value = null
    syncQuota()
    finishCall(call, 'ok', started, 'session released')
    statusNote.value = 'Session destroyed. Create a new one to chat again.'
  }

  function clearChat() {
    messages.value = []
  }

  function clearTrace() {
    apiCalls.value = []
  }

  void checkAvailability()

  onBeforeUnmount(() => {
    session.value?.destroy()
  })

  return {
    availability,
    downloadProgress,
    contextUsage,
    contextWindow,
    messages,
    apiCalls,
    busy,
    statusNote,
    supported,
    ready,
    checkAvailability,
    createSession,
    sendPrompt,
    stopPrompt,
    destroySession,
    clearChat,
    clearTrace,
    SYSTEM_PROMPT,
  }
}
