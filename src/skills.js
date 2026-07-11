import fs from 'node:fs'
import path from 'node:path'
import { MANIX_DIR } from './config.js'

/**
 * Skills are markdown playbooks: <dir>/<name>/SKILL.md with frontmatter
 * (name:, description:). Project skills (.manix/skills) override global (~/.manix/skills).
 */
export function loadSkills(cwd) {
  const dirs = [path.join(MANIX_DIR, 'skills'), path.join(cwd, '.manix', 'skills')]
  const byName = new Map()
  for (const dir of dirs) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const file = path.join(dir, e.name, 'SKILL.md')
      let src
      try {
        src = fs.readFileSync(file, 'utf8')
      } catch {
        continue
      }
      const { meta, body } = parseFrontmatter(src)
      const name = (meta.name || e.name).toLowerCase().replace(/\s+/g, '-')
      byName.set(name, {
        name,
        description: meta.description || '(no description)',
        body,
        dir: path.join(dir, e.name),
      })
    }
  }
  return [...byName.values()]
}

export function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { meta: {}, body: src }
  const meta = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (kv) meta[kv[1]] = kv[2].trim()
  }
  return { meta, body: src.slice(m[0].length) }
}

/** The `skill` tool — lets the model pull a playbook into context on demand. */
export function skillTool(skills) {
  return {
    name: 'skill',
    safe: true,
    description:
      'Load a skill (expert playbook) by name and follow its instructions. Available: ' +
      (skills.map((s) => s.name).join(', ') || 'none'),
    parameters: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
    describe: (a) => `Skill(${a.name})`,
    async run(a) {
      const s = skills.find((x) => x.name === String(a.name).toLowerCase())
      if (!s) return `No skill named "${a.name}". Available: ${skills.map((x) => x.name).join(', ')}`
      return `# Skill: ${s.name}\n(files for this skill live in ${s.dir})\n\n${s.body}`
    },
  }
}
