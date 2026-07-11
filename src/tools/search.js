import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import fg from 'fast-glob'

const IGNORE = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**']

export const globTool = {
  name: 'glob_files',
  safe: true,
  description: 'Find files by glob pattern, e.g. "src/**/*.js" or "**/*.test.*".',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string' },
      path: { type: 'string', description: 'Base directory (defaults to cwd)' },
    },
    required: ['pattern'],
  },
  describe: (a) => `Glob(${a.pattern})`,
  async run(a, ctx) {
    const files = await fg(a.pattern, {
      cwd: path.resolve(ctx.cwd, a.path || '.'),
      ignore: IGNORE,
      onlyFiles: true,
      dot: false,
      suppressErrors: true,
    })
    if (!files.length) return 'No files matched.'
    const shown = files.slice(0, 200)
    return shown.join('\n') + (files.length > 200 ? `\n… +${files.length - 200} more` : '')
  },
}

export const grepTool = {
  name: 'grep_search',
  safe: true,
  description: 'Search file contents with a regex. Returns file:line:text matches.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regular expression' },
      path: { type: 'string', description: 'Directory or file to search (defaults to cwd)' },
      include: { type: 'string', description: 'Only search files matching this glob, e.g. "*.js"' },
    },
    required: ['pattern'],
  },
  describe: (a) => `Grep(${a.pattern})`,
  async run(a, ctx) {
    const base = path.resolve(ctx.cwd, a.path || '.')
    try {
      return await rgSearch(a, base)
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err
      return jsSearch(a, base) // ripgrep not installed
    }
  },
}

function rgSearch(a, base) {
  return new Promise((resolve, reject) => {
    const args = ['-n', '--no-heading', '-S', '-m', '50', '--max-columns', '300']
    if (a.include) args.push('-g', a.include)
    args.push('--', a.pattern, base)
    execFile('rg', args, { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err && err.code === 1) return resolve('No matches.') // rg: 1 = no matches
      if (err && typeof err.code !== 'number') return reject(err)
      if (err && err.code > 1) return reject(new Error(err.message))
      const lines = stdout.trim().split('\n').slice(0, 200)
      resolve(lines.map((l) => l.replace(base + path.sep, '')).join('\n'))
    })
  })
}

async function jsSearch(a, base) {
  const re = new RegExp(a.pattern)
  const files = await fg(a.include || '**/*', {
    cwd: base,
    ignore: IGNORE,
    onlyFiles: true,
    dot: false,
    suppressErrors: true,
  })
  const out = []
  for (const f of files.slice(0, 3000)) {
    const p = path.join(base, f)
    let src
    try {
      if (fs.statSync(p).size > 512 * 1024) continue
      src = fs.readFileSync(p, 'utf8')
    } catch {
      continue
    }
    if (src.includes('\0')) continue // binary
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        out.push(`${f}:${i + 1}:${lines[i].trim().slice(0, 300)}`)
        if (out.length >= 200) return out.join('\n')
      }
    }
  }
  return out.length ? out.join('\n') : 'No matches.'
}

export const searchTools = [globTool, grepTool]
