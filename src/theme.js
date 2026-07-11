import chalk from 'chalk'
import os from 'node:os'

// Ember — warm coral/amber accents on neutral dark chrome. See CLAUDE.md §2.
export const color = {
  accent: '#ff9f6b',
  amber: '#ffd27f',
  user: '#d7d3cd',
  dim: '#8a8580',
  faint: '#5c5854',
  border: '#4a443f',
  ok: '#98c379',
  err: '#e06c75',
  warn: '#e5c07b',
  code: '#61afef',
}

export const t = {
  accent: chalk.hex(color.accent),
  amber: chalk.hex(color.amber),
  user: chalk.hex(color.user),
  dim: chalk.hex(color.dim),
  faint: chalk.hex(color.faint),
  ok: chalk.hex(color.ok),
  err: chalk.hex(color.err),
  warn: chalk.hex(color.warn),
  code: chalk.hex(color.code),
  bold: chalk.bold,
}

export const LOGO = '▲'
export const WORDMARK = `${LOGO}  M A N I X`
export const GLYPH = {
  user: '❯',
  assistant: '⏺',
  tool: '●',
  info: '○',
  error: '✗',
}
export const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** chalk styler for a color t (0-1) of the way from hexA to hexB. */
export function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const [r, g, bl] = a.map((av, i) => Math.round(av + (b[i] - av) * t))
  return chalk.rgb(r, g, bl)
}

/** Interpolate accent → amber across a string (banner gradient). */
export function gradient(text) {
  const chars = [...text]
  return chars
    .map((ch, i) => lerpColor(color.accent, color.amber, chars.length > 1 ? i / (chars.length - 1) : 0)(ch))
    .join('')
}

/** Full-width horizontal rule, sized to the terminal (minus `pad` columns). */
export function hr(pad = 0) {
  return '─'.repeat(Math.max(10, (process.stdout.columns || 80) - pad))
}

// The ▲ brand mark, blown up into pixel art. Two-char-wide "pixels" keep it
// roughly square in a terminal's tall/narrow character cells.
export const MASCOT = ['...#...', '..###..', '.#####.', '#######']

/** Replace the home directory prefix with ~ for compact display. */
export function shortenPath(p) {
  const home = os.homedir()
  return p === home ? '~' : p.startsWith(home + '/') ? '~' + p.slice(home.length) : p
}

export const TIPS = [
  'Tip: /model swaps the model mid-conversation — try a free one to explore.',
  'Tip: /init teaches Manix about this repo so it needs less hand-holding.',
  'Tip: Esc interrupts a running turn · Ctrl+C twice quits.',
  'Tip: drop a SKILL.md under .manix/skills/ to teach Manix a new playbook.',
  'Tip: /resume brings back any previous session in this project.',
  'Tip: --yolo auto-approves every tool call — use with care.',
]

export function randomTip() {
  return TIPS[Math.floor(Math.random() * TIPS.length)]
}
