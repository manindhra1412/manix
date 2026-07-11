import { t } from './theme.js'

/** Tiny terminal markdown renderer: fences, headings, lists, bold, inline code, links. */
export function renderMarkdown(md) {
  const out = []
  let inCode = false
  for (const line of String(md).split('\n')) {
    const fence = line.match(/^\s*```(\S*)/)
    if (fence) {
      inCode = !inCode
      out.push(inCode ? t.faint('┌╴' + (fence[1] || 'code')) : t.faint('└╴'))
      continue
    }
    if (inCode) {
      out.push(t.faint('│ ') + t.code(line))
      continue
    }
    out.push(renderLine(line))
  }
  if (inCode) out.push(t.faint('└╴')) // unterminated fence while streaming
  return out.join('\n')
}

function renderLine(line) {
  let m
  if ((m = line.match(/^#{1,6}\s+(.*)$/))) return t.accent.bold(inline(m[1]))
  if ((m = line.match(/^(\s*)[-*]\s+(.*)$/))) return m[1] + t.accent('•') + ' ' + inline(m[2])
  if ((m = line.match(/^(\s*)(\d+)\.\s+(.*)$/))) return m[1] + t.accent(m[2] + '.') + ' ' + inline(m[3])
  if (/^\s*>\s?/.test(line)) return t.dim('│ ' + line.replace(/^\s*>\s?/, ''))
  if (/^\s*([-*_])\s?(\1\s?){2,}$/.test(line)) return t.faint('─'.repeat(40))
  return inline(line)
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, (_, c) => t.code(c))
    .replace(/\*\*([^*]+)\*\*/g, (_, b) => t.bold(b))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) => txt + ' ' + t.faint(`(${url})`))
}
