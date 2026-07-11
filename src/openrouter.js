// OpenRouter client — raw fetch + hand-rolled SSE. No SDK.
// Base URL is read per call so tests can point it at a local server.
const base = () => process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
const HEADERS = {
  'HTTP-Referer': 'https://github.com/manindhra/manix',
  'X-Title': 'Manix',
}

function authHeaders(apiKey) {
  return { ...HEADERS, ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) }
}

/**
 * Stream a chat completion. Emits text deltas via onText, accumulates tool-call
 * fragments by index. Returns { content, toolCalls, usage, finish }.
 */
export async function streamChat({ apiKey, model, messages, tools, signal, onText }) {
  const res = await fetch(`${base()}/chat/completions`, {
    method: 'POST',
    headers: { ...authHeaders(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      ...(tools?.length ? { tools, tool_choice: 'auto' } : {}),
      stream: true,
      usage: { include: true },
    }),
    signal,
  })
  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.error?.message || JSON.stringify(j)
    } catch {}
    throw new Error(`OpenRouter ${res.status}: ${detail || res.statusText}`)
  }

  const decoder = new TextDecoder()
  let buf = ''
  let content = ''
  let usage = null
  let finish = null
  const toolCalls = []

  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true })
    let nl
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trimEnd()
      buf = buf.slice(nl + 1)
      if (!line || line.startsWith(':')) continue // SSE comments / keepalives
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') continue
      let json
      try {
        json = JSON.parse(data)
      } catch {
        continue
      }
      if (json.error) throw new Error(json.error.message || 'OpenRouter stream error')
      if (json.usage) usage = json.usage
      const choice = json.choices?.[0]
      if (!choice) continue
      if (choice.finish_reason) finish = choice.finish_reason
      const d = choice.delta || {}
      if (d.content) {
        content += d.content
        onText?.(d.content)
      }
      for (const tc of d.tool_calls || []) {
        const i = tc.index ?? 0
        if (!toolCalls[i]) toolCalls[i] = { id: '', type: 'function', function: { name: '', arguments: '' } }
        if (tc.id) toolCalls[i].id = tc.id
        if (tc.function?.name) toolCalls[i].function.name += tc.function.name
        if (tc.function?.arguments) toolCalls[i].function.arguments += tc.function.arguments
      }
    }
  }
  return { content, toolCalls: toolCalls.filter(Boolean), usage, finish }
}

let modelCache = null

/** GET /models — cached per process. Each: { id, name, context_length, pricing } */
export async function fetchModels(apiKey, force = false) {
  if (modelCache && !force) return modelCache
  const res = await fetch(`${base()}/models`, { headers: authHeaders(apiKey) })
  if (!res.ok) throw new Error(`OpenRouter /models: ${res.status}`)
  modelCache = (await res.json()).data ?? []
  return modelCache
}

export function cachedModels() {
  return modelCache
}

/** { total_credits, total_usage } or null. */
export async function getCredits(apiKey) {
  try {
    const res = await fetch(`${base()}/credits`, { headers: authHeaders(apiKey) })
    if (!res.ok) return null
    return (await res.json()).data ?? null
  } catch {
    return null
  }
}

export async function validateKey(apiKey) {
  try {
    const res = await fetch(`${base()}/key`, { headers: authHeaders(apiKey) })
    return res.ok
  } catch {
    return false
  }
}
