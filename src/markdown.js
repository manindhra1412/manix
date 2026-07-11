import chalk from 'chalk'
import { t, color } from './theme.js'

const codeBg = chalk.bgHex('#1e2030')
const codeText = chalk.hex(color.code).bgHex('#1e2030')
const gutterCol = chalk.hex(color.border).bgHex('#1e2030')
const labelCol = chalk.hex(color.faint)
const termWidth = () => Math.min(process.stdout.columns || 80, 120)

/** Tiny terminal markdown renderer: fences, headings, lists, bold, inline code, links. */
export function renderMarkdown(md) {
  const out = []
  let inCode = false
  let lang = ''
  for (const line of String(md).split('\n')) {
    const fence = line.match(/^\s*```(\S*)/)
    if (fence) {
      inCode = !inCode
      lang = fence[1] || ''
      if (inCode) {
        const label = lang ? ` ${lang} ` : ' code '
        out.push(labelCol('  ╭─') + labelCol(label) + labelCol('─'.repeat(Math.max(2, termWidth() - label.length - 6))))
      } else {
        out.push(labelCol('  ╰' + '─'.repeat(termWidth() - 3)))
      }
      continue
    }
    if (inCode) {
      const padded = ' ' + line + ' '.repeat(Math.max(0, termWidth() - line.length - 3))
      out.push(gutterCol('  │') + codeText(padded))
      continue
    }
    out.push(renderLine(line))
  }
  if (inCode) out.push(labelCol('  ╰' + '─'.repeat(termWidth() - 3))) // unterminated fence while streaming
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
