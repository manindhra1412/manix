// Offline smoke tests — no API key needed. Run after build: node scripts/smoke.mjs
import assert from 'node:assert'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

let passed = 0
const ok = (name) => {
  passed++
  console.log('  ✓', name)
}

// ── SSE test server (must set env BEFORE importing dist/openrouter.js) ──────
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream' })
  const chunks = [
    ': OPENROUTER PROCESSING\n\n',
    'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
    '\ndata: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"read_","arguments":""}}]}}]}\n\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"file","arguments":"{\\"path\\":\\"x.js\\"}"}}]}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n',
    'data: [DONE]\n\n',
  ]
  let i = 0
  const timer = setInterval(() => {
    if (i < chunks.length) res.write(chunks[i++])
    else {
      clearInterval(timer)
      res.end()
    }
  }, 2)
})
await new Promise((r) => server.listen(0, r))
process.env.OPENROUTER_BASE_URL = `http://127.0.0.1:${server.address().port}`

const { streamChat } = await import('../dist/openrouter.js')
const deltas = []
const res = await streamChat({
  apiKey: 'test',
  model: 'test/model',
  messages: [{ role: 'user', content: 'hi' }],
  onText: (d) => deltas.push(d),
})
assert.equal(res.content, 'Hello')
assert.equal(deltas.join(''), 'Hello')
assert.equal(res.toolCalls.length, 1)
assert.equal(res.toolCalls[0].id, 'call_1')
assert.equal(res.toolCalls[0].function.name, 'read_file')
assert.deepEqual(JSON.parse(res.toolCalls[0].function.arguments), { path: 'x.js' })
assert.equal(res.usage.prompt_tokens, 10)
assert.equal(res.finish, 'tool_calls')
server.close()
ok('SSE stream parsing (text deltas, split tool-call fragments, usage, comments)')

// ── tools ────────────────────────────────────────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manix-smoke-'))
const ctx = { cwd: tmp }
const { readFileTool, writeFileTool, editFileTool, listDirTool } = await import(
  '../dist/tools/fs-tools.js'
)
const { globTool, grepTool } = await import('../dist/tools/search.js')
const { bashTool } = await import('../dist/tools/bash.js')

await writeFileTool.run({ path: 'a/hello.js', content: 'const x = 1\nconsole.log(x)\n' }, ctx)
assert((await readFileTool.run({ path: 'a/hello.js' }, ctx)).includes('console.log'))
ok('write_file + read_file')

await editFileTool.run({ path: 'a/hello.js', old_string: 'const x = 1', new_string: 'const x = 2' }, ctx)
assert((await readFileTool.run({ path: 'a/hello.js' }, ctx)).includes('const x = 2'))
await assert.rejects(
  editFileTool.run({ path: 'a/hello.js', old_string: 'nope', new_string: 'x' }, ctx),
  /not found/,
)
ok('edit_file (replace + not-found rejection)')

assert((await listDirTool.run({}, ctx)).includes('a/'))
assert((await globTool.run({ pattern: '**/*.js' }, ctx)).includes('a/hello.js'))
ok('list_dir + glob_files')

const grep = await grepTool.run({ pattern: 'console\\.log' }, ctx)
assert(grep.includes('hello.js'), `grep output: ${grep}`)
ok('grep_search')

assert((await bashTool.run({ command: 'echo manix-ok' }, ctx)).includes('manix-ok'))
assert((await bashTool.run({ command: 'exit 3' }, ctx)).includes('Exit code 3'))
ok('bash (output + exit codes)')

// ── markdown / skills / permissions / slash ─────────────────────────────────
const { renderMarkdown } = await import('../dist/markdown.js')
const md = renderMarkdown('# Title\n- item\n`code`\n```js\nlet y\n```\n**bold**')
assert(md.includes('Title') && md.includes('item') && md.includes('let y'))
ok('markdown renderer')

const { parseFrontmatter } = await import('../dist/skills.js')
const fm = parseFrontmatter('---\nname: commit\ndescription: writes commits\n---\nBody here')
assert.equal(fm.meta.name, 'commit')
assert(fm.body.includes('Body here'))
ok('skill frontmatter parsing')

const { Permissions } = await import('../dist/permissions.js')
const perms = new Permissions({})
assert.equal(await perms.check({ name: 'r', safe: true }, null), true)
assert.equal(await perms.check({ name: 'w', safe: false }, null), false)
assert.equal(await perms.check({ name: 'w', safe: false }, async () => 'always'), true)
assert.equal(await perms.check({ name: 'w', safe: false }, null), true) // remembered
assert.equal(await new Permissions({ yolo: true }).check({ name: 'w', safe: false }, null), true)
ok('permissions (safe / ask / always / yolo)')

const { slashCommands, helpText } = await import('../dist/slash.js')
const cmds = slashCommands([{ name: 'commit', description: 'd', body: 'b' }])
assert(cmds.some((c) => c.name === 'model') && cmds.some((c) => c.skill))
assert(helpText(cmds).includes('/commit'))
ok('slash commands (+dynamic skills)')

// ── sessions round-trip ──────────────────────────────────────────────────────
const { createSession, appendMessage, loadSession } = await import('../dist/sessions.js')
const session = createSession(tmp, 'test/model')
appendMessage(session, { role: 'user', content: 'smoke test message' })
appendMessage(session, { role: 'assistant', content: 'reply' })
const loaded = loadSession(session.id)
assert.equal(loaded.messages.length, 2)
assert.equal(loaded.meta.cwd, tmp)
fs.rmSync(session.file)
ok('sessions JSONL round-trip')

// ── agent loop end-to-end against a scripted fake OpenRouter ────────────────
// Turn 1: model calls write_file. Turn 2: model replies "done".
const script = [
  [
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"write_file","arguments":"{\\"path\\":\\"out.txt\\",\\"content\\":\\"agent-made\\"}"}}]}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":7,"completion_tokens":3}}\n\n',
    'data: [DONE]\n\n',
  ],
  [
    'data: {"choices":[{"delta":{"content":"done"}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":9,"completion_tokens":1}}\n\n',
    'data: [DONE]\n\n',
  ],
]
let call = 0
const agentServer = http.createServer((req, res) => {
  if (!req.url.includes('chat/completions')) {
    res.writeHead(404)
    return res.end('{}')
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream' })
  for (const c of script[Math.min(call++, script.length - 1)]) res.write(c)
  res.end()
})
await new Promise((r) => agentServer.listen(0, r))
process.env.OPENROUTER_BASE_URL = `http://127.0.0.1:${agentServer.address().port}` // base() reads this per call

const { Agent } = await import('../dist/agent.js')
const agentTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manix-agent-'))
const events = []
const agent = new Agent({
  config: { apiKey: 'test', model: 'test/model' },
  cwd: agentTmp,
  permissions: new Permissions({ yolo: true }),
  skills: [],
  contextFiles: [],
  handlers: {
    onTextDelta: (d) => events.push(['text', d]),
    onToolStart: ({ display }) => events.push(['tool', display]),
    onToolEnd: ({ ok: toolOk }) => events.push(['tool-end', toolOk]),
    onError: (m) => events.push(['error', m]),
  },
})
await agent.send('create out.txt')
assert.equal(fs.readFileSync(path.join(agentTmp, 'out.txt'), 'utf8'), 'agent-made')
assert(events.some(([k, v]) => k === 'tool' && v.includes('Write(out.txt)')))
assert(events.some(([k, v]) => k === 'text' && v === 'done'))
assert(!events.some(([k]) => k === 'error'), JSON.stringify(events))
assert.equal(agent.messages.length, 4) // user, assistant+tool_calls, tool, assistant
assert.equal(agent.usage.prompt, 16)
assert.equal(agent.usage.completion, 4)
assert.equal(call, 2)
agentServer.close()
fs.rmSync(agent.session.file)
fs.rmSync(agentTmp, { recursive: true, force: true })
ok('agent loop e2e (tool call → permission → execute → final reply)')

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${passed} smoke checks passed.`)
