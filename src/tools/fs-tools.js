import fs from 'node:fs'
import path from 'node:path'
import { t } from '../theme.js'

const rel = (cwd, p) => path.resolve(cwd, p)
const short = (s, n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export const readFileTool = {
  name: 'read_file',
  safe: true,
  description:
    'Read a text file. Returns numbered lines. Use offset (1-based) and limit for large files.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path (relative to cwd or absolute)' },
      offset: { type: 'integer', description: '1-based line to start from' },
      limit: { type: 'integer', description: 'Max lines to return (default/cap 2000)' },
    },
    required: ['path'],
  },
  describe: (a) => `Read(${a.path})`,
  async run(a, ctx) {
    const p = rel(ctx.cwd, a.path)
    const lines = fs.readFileSync(p, 'utf8').split('\n')
    const off = Math.max(1, a.offset || 1)
    const lim = Math.min(a.limit || 2000, 2000)
    const slice = lines.slice(off - 1, off - 1 + lim)
    const body = slice.map((l, i) => `${String(off + i).padStart(5)}→${l.slice(0, 500)}`).join('\n')
    const more = off - 1 + lim < lines.length ? `\n… (${lines.length} lines total)` : ''
    return body + more
  },
}

export const writeFileTool = {
  name: 'write_file',
  safe: false,
  description: 'Create or overwrite a file with the given content. Creates parent directories.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['path', 'content'],
  },
  describe: (a) => `Write(${a.path})`,
  preview(a) {
    const lines = String(a.content ?? '').split('\n')
    const shown = lines.slice(0, 12).map((l) => t.ok('+ ' + short(l, 76)))
    if (lines.length > 12) shown.push(t.dim(`  … +${lines.length - 12} more lines`))
    return shown
  },
  async run(a, ctx) {
    const p = rel(ctx.cwd, a.path)
    const existed = fs.existsSync(p)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, a.content)
    return `${existed ? 'Overwrote' : 'Created'} ${a.path} (${Buffer.byteLength(a.content)} bytes)`
  },
}

export const editFileTool = {
  name: 'edit_file',
  safe: false,
  description:
    'Replace an exact string in a file. old_string must match exactly and be unique unless replace_all is true. Read the file first.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      old_string: { type: 'string', description: 'Exact text to replace (include enough context to be unique)' },
      new_string: { type: 'string' },
      replace_all: { type: 'boolean' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  describe: (a) => `Edit(${a.path})`,
  preview(a) {
    const olds = String(a.old_string ?? '').split('\n').slice(0, 8)
    const news = String(a.new_string ?? '').split('\n').slice(0, 8)
    return [
      ...olds.map((l) => t.err('- ' + short(l, 76))),
      ...news.map((l) => t.ok('+ ' + short(l, 76))),
    ]
  },
  async run(a, ctx) {
    const p = rel(ctx.cwd, a.path)
    const src = fs.readFileSync(p, 'utf8')
    const count = src.split(a.old_string).length - 1
    if (count === 0) throw new Error('old_string not found in file — read the file and retry with exact text')
    if (count > 1 && !a.replace_all)
      throw new Error(`old_string matches ${count} times — add surrounding context or set replace_all`)
    const next = a.replace_all
      ? src.split(a.old_string).join(a.new_string)
      : src.replace(a.old_string, a.new_string)
    fs.writeFileSync(p, next)
    return `Edited ${a.path} (${a.replace_all ? count : 1} replacement${count > 1 && a.replace_all ? 's' : ''})`
  },
}

export const listDirTool = {
  name: 'list_dir',
  safe: true,
  description: 'List directory entries. Directories get a trailing slash.',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string', description: 'Defaults to cwd' } },
  },
  describe: (a) => `List(${a.path || '.'})`,
  async run(a, ctx) {
    const p = rel(ctx.cwd, a.path || '.')
    const entries = fs.readdirSync(p, { withFileTypes: true })
    entries.sort((x, y) => (y.isDirectory() - x.isDirectory()) || x.name.localeCompare(y.name))
    const rows = entries.slice(0, 200).map((e) => (e.isDirectory() ? e.name + '/' : e.name))
    if (entries.length > 200) rows.push(`… +${entries.length - 200} more`)
    return rows.join('\n') || '(empty)'
  },
}

export const fsTools = [readFileTool, writeFileTool, editFileTool, listDirTool]
