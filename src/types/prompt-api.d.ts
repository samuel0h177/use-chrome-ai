type LanguageModelAvailability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available'

type LanguageModelMessageRole = 'system' | 'user' | 'assistant'

interface LanguageModelMessage {
  role: LanguageModelMessageRole
  content: string
  prefix?: boolean
}

interface LanguageModelExpected {
  type: 'text' | 'image' | 'audio'
  languages?: string[]
}

interface LanguageModelCreateOptions {
  initialPrompts?: LanguageModelMessage[]
  expectedInputs?: LanguageModelExpected[]
  expectedOutputs?: LanguageModelExpected[]
  temperature?: number
  topK?: number
  signal?: AbortSignal
  monitor?: (monitor: EventTarget) => void
}

interface LanguageModelPromptOptions {
  signal?: AbortSignal
  responseConstraint?: object
}

interface LanguageModel {
  readonly contextUsage: number
  readonly contextWindow: number
  prompt(input: string | LanguageModelMessage[], options?: LanguageModelPromptOptions): Promise<string>
  promptStreaming(
    input: string | LanguageModelMessage[],
    options?: LanguageModelPromptOptions,
  ): ReadableStream<string>
  append(input: LanguageModelMessage[]): Promise<void>
  clone(options?: { signal?: AbortSignal }): Promise<LanguageModel>
  destroy(): void
  addEventListener(type: 'contextoverflow', listener: () => void): void
}

interface LanguageModelConstructor {
  availability(options?: LanguageModelCreateOptions): Promise<LanguageModelAvailability>
  create(options?: LanguageModelCreateOptions): Promise<LanguageModel>
  params?(): Promise<{
    defaultTopK: number
    maxTopK: number
    defaultTemperature: number
    maxTemperature: number
  }>
}

interface Window {
  LanguageModel?: LanguageModelConstructor
}

interface DownloadProgressEvent extends Event {
  loaded: number
}
