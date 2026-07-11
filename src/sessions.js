import fs from 'node:fs'
import path from 'node:path'
import { MANIX_DIR, ensureDir } from './config.js'

export const SESSIONS_DIR = path.join(MANIX_DIR, 'sessions')

export function createSession(cwd, model) {
  ensureDir(SESSIONS_DIR)
  const id =
    new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') +
    '-' +
    Math.random().toString(36).slice(2, 6)
  const file = path.join(SESSIONS_DIR, id + '.jsonl')
  appendLine(file, { type: 'meta', id, cwd, model, created: Date.now() })
  return { id, file }
}

export function appendMessage(session, message) {
  if (!session) return
  appendLine(session.file, { type: 'message', message })
}

function appendLine(file, obj) {
  fs.appendFileSync(file, JSON.stringify(obj) + '\n')
}

function parseSessionFile(file) {
  let meta = null
  const messages = []
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }
    if (obj.type === 'meta') meta = obj
    else if (obj.type === 'message') messages.push(obj.message)
  }
  if (!meta) return null
  return { meta, messages }
}

/** List sessions, newest first. Prefers sessions from `cwd`, falls back to all. */
export function listSessions(cwd) {
  let files
  try {
    files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.jsonl'))
  } catch {
    return []
  }
  const all = []
  for (const f of files) {
    const file = path.join(SESSIONS_DIR, f)
    const parsed = parseSessionFile(file)
    if (!parsed || !parsed.messages.length) continue
    const firstUser = parsed.messages.find((m) => m.role === 'user')
    all.push({
      id: parsed.meta.id,
      file,
      cwd: parsed.meta.cwd,
      created: parsed.meta.created,
      mtime: fs.statSync(file).mtimeMs,
      count: parsed.messages.length,
      title: String(firstUser?.content || '(empty)').split('\n')[0].slice(0, 64),
    })
  }
  all.sort((a, b) => b.mtime - a.mtime)
  const here = all.filter((s) => s.cwd === cwd)
  return here.length ? here : all
}

export function loadSession(idOrFile) {
  const file = idOrFile.endsWith('.jsonl') ? idOrFile : path.join(SESSIONS_DIR, idOrFile + '.jsonl')
  const parsed = parseSessionFile(file)
  return parsed ? { ...parsed, file } : null
}
