import fs from 'node:fs'
import path from 'node:path'
import { MANIX_DIR } from './config.js'

/** Load project memory: ~/.manix/MANIX.md (global) + ./MANIX.md (project). */
export function loadContextFiles(cwd) {
  const candidates = [path.join(MANIX_DIR, 'MANIX.md'), path.join(cwd, 'MANIX.md')]
  const out = []
  for (const p of candidates) {
    try {
      const content = fs.readFileSync(p, 'utf8').trim()
      if (content) out.push({ path: p, content: content.slice(0, 20_000) })
    } catch {}
  }
  return out
}
