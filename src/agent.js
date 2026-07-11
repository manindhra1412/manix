import { streamChat, fetchModels, cachedModels } from './openrouter.js'
import { systemPrompt, COMPACT_PROMPT } from './prompts.js'
import { builtinTools, toOpenAI } from './tools/index.js'
import { skillTool } from './skills.js'
import { appendMessage, createSession } from './sessions.js'

/**
 * The hand-written agentic loop (see CLAUDE.md §4). UI-agnostic: talks to the
 * outside world only through `handlers`:
 *   onTextDelta(d) · onAssistantDone(text) · onToolStart({display}) ·
 *   onToolEnd({display, ok, summary}) · onInfo(msg) · onError(msg) ·
 *   onStats(stats) · requestPermission({display, preview}) → 'once'|'always'|'no'
 */
export class Agent {
  constructor({ config, cwd, permissions, mcp, skills, contextFiles, handlers }) {
    this.apiKey = config.apiKey
    this.model = config.model
    this.cwd = cwd
    this.permissions = permissions
    this.mcp = mcp
    this.skills = skills || []
    this.contextFiles = contextFiles || []
    this.h = handlers || {}
    this.messages = []
    this.session = null
    this.usage = { prompt: 0, completion: 0, cost: 0, requests: 0 }
    this.contextLength = 128_000
    this.ac = null
    // Warm the models cache (pricing + context window) in the background.
    fetchModels(this.apiKey).then(() => this.refreshModelInfo()).catch(() => {})
  }

  refreshModelInfo() {
    const m = (cachedModels() || []).find((x) => x.id === this.model)
    if (m?.context_length) this.contextLength = m.context_length
    this.h.onStats?.(this.stats())
  }

  setModel(id) {
    this.model = id
    this.refreshModelInfo()
  }

  get busy() {
    return this.ac !== null
  }

  pushMessage(msg) {
    if (!this.session) this.session = createSession(this.cwd, this.model)
    this.messages.push(msg)
    appendMessage(this.session, msg)
  }

  resumeFrom(loaded) {
    this.messages = loaded.messages
    this.session = { id: loaded.meta.id, file: loaded.file }
  }

  reset() {
    this.messages = []
    this.session = null
  }

  buildTools() {
    return [...builtinTools(), skillTool(this.skills), ...(this.mcp?.getTools() || [])]
  }

  estimateTokens() {
    return Math.round((JSON.stringify(this.messages).length + 4000) / 4)
  }

  stats() {
    return { ...this.usage, tokens: this.estimateTokens(), contextLength: this.contextLength }
  }

  trackUsage(usage) {
    if (!usage) return
    this.usage.prompt += usage.prompt_tokens || 0
    this.usage.completion += usage.completion_tokens || 0
    this.usage.requests += 1
    if (typeof usage.cost === 'number') {
      this.usage.cost += usage.cost // OpenRouter returns real cost with usage.include
    } else {
      const m = (cachedModels() || []).find((x) => x.id === this.model)
      if (m?.pricing) {
        this.usage.cost +=
          (usage.prompt_tokens || 0) * parseFloat(m.pricing.prompt || 0) +
          (usage.completion_tokens || 0) * parseFloat(m.pricing.completion || 0)
      }
    }
    this.h.onStats?.(this.stats())
  }

  abort() {
    this.ac?.abort()
  }

  async send(text) {
    this.pushMessage({ role: 'user', content: text })
    await this.run()
  }

  async run() {
    this.ac = new AbortController()
    const tools = this.buildTools()
    const toolSchemas = tools.map(toOpenAI)
    try {
      for (let turn = 0; turn < 40; turn++) {
        const sys = {
          role: 'system',
          content: systemPrompt({
            cwd: this.cwd,
            model: this.model,
            contextFiles: this.contextFiles,
            skills: this.skills,
          }),
        }
        const res = await streamChat({
          apiKey: this.apiKey,
          model: this.model,
          messages: [sys, ...this.messages],
          tools: toolSchemas,
          signal: this.ac.signal,
          onText: this.h.onTextDelta,
        })
        this.trackUsage(res.usage)
        const assistant = { role: 'assistant', content: res.content || null }
        if (res.toolCalls.length) assistant.tool_calls = res.toolCalls
        this.pushMessage(assistant)
        this.h.onAssistantDone?.(res.content)
        if (!res.toolCalls.length) return

        for (const tc of res.toolCalls) {
          const result = await this.execTool(tools, tc)
          this.pushMessage({
            role: 'tool',
            tool_call_id: tc.id,
            content: result.length > 60_000 ? result.slice(0, 60_000) + '\n…[truncated]' : result,
          })
        }
        if (this.estimateTokens() > this.contextLength * 0.8) {
          this.h.onInfo?.('Context above 80% — run /compact to summarize and free space.')
        }
      }
      this.h.onInfo?.('Stopped after 40 tool turns — send a message to continue.')
    } catch (err) {
      if (err?.name === 'AbortError' || this.ac?.signal.aborted) {
        this.h.onInfo?.('Interrupted.')
      } else {
        this.h.onError?.(err?.message || String(err))
      }
    } finally {
      this.ac = null
    }
  }

  async execTool(tools, tc) {
    const name = tc.function?.name || ''
    const tool = tools.find((t) => t.name === name)
    if (!tool) {
      this.h.onToolEnd?.({ display: name, ok: false, summary: 'unknown tool' })
      return `Error: unknown tool "${name}"`
    }
    let args
    try {
      args = JSON.parse(tc.function.arguments || '{}')
    } catch {
      this.h.onToolEnd?.({ display: name, ok: false, summary: 'bad arguments' })
      return 'Error: tool arguments were not valid JSON'
    }
    const display = tool.describe ? tool.describe(args) : name
    if (this.ac.signal.aborted) return 'Interrupted by user before execution.'

    const ask = this.h.requestPermission
      ? () => this.h.requestPermission({ display, preview: tool.preview?.(args) || null })
      : null
    const allowed = await this.permissions.check(tool, ask)
    if (!allowed) {
      this.h.onToolEnd?.({ display, ok: false, summary: 'permission denied' })
      return 'The user denied permission for this action. Do not retry it; ask or take another approach.'
    }

    this.h.onToolStart?.({ display })
    try {
      const out = String(await tool.run(args, { cwd: this.cwd }))
      this.h.onToolEnd?.({ display, ok: true, summary: summarize(out) })
      return out
    } catch (err) {
      this.h.onToolEnd?.({ display, ok: false, summary: err.message })
      return `Error: ${err.message}`
    }
  }

  /** Replace history with a model-written summary; starts a new session file. */
  async compact() {
    this.ac = new AbortController()
    try {
      const res = await streamChat({
        apiKey: this.apiKey,
        model: this.model,
        messages: [...this.messages, { role: 'user', content: COMPACT_PROMPT }],
        signal: this.ac.signal,
      })
      this.messages = [
        { role: 'user', content: '[Earlier conversation was compacted. Summary:]\n\n' + res.content },
        { role: 'assistant', content: 'Got it — continuing from that summary.' },
      ]
      this.session = createSession(this.cwd, this.model)
      for (const m of this.messages) appendMessage(this.session, m)
      this.h.onStats?.(this.stats())
    } finally {
      this.ac = null
    }
  }
}

function summarize(out) {
  const lines = String(out).split('\n').filter((l) => l.trim())
  const shown = lines.slice(0, 3).map((l) => (l.length > 100 ? l.slice(0, 99) + '…' : l))
  if (lines.length > 3) shown.push(`… +${lines.length - 3} lines`)
  return shown.join('\n')
}
