import { exec } from 'node:child_process'
import { t } from '../theme.js'

const short = (s, n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export const bashTool = {
  name: 'bash',
  safe: false,
  description:
    'Run a shell command in the working directory. Non-interactive only. Returns stdout+stderr (truncated).',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string' },
      timeout_ms: { type: 'integer', description: 'Max runtime (default 120000, cap 600000)' },
    },
    required: ['command'],
  },
  describe: (a) => `Bash(${short(String(a.command || ''))})`,
  preview: (a) => String(a.command || '').split('\n').slice(0, 8).map((l) => t.warn('$ ' + l)),
  run(a, ctx) {
    return new Promise((resolve) => {
      exec(
        a.command,
        {
          cwd: ctx.cwd,
          timeout: Math.min(a.timeout_ms || 120_000, 600_000),
          maxBuffer: 10 * 1024 * 1024,
          env: process.env,
        },
        (err, stdout, stderr) => {
          let out = [stdout, stderr].map((s) => String(s).trim()).filter(Boolean).join('\n')
          if (out.length > 30_000) out = out.slice(0, 15_000) + '\n… [output truncated] …\n' + out.slice(-10_000)
          if (err?.killed) return resolve(`Command timed out.\n${out}`)
          if (err && typeof err.code === 'number') return resolve(`Exit code ${err.code}\n${out}`)
          if (err && !out) return resolve(`Error: ${err.message}`)
          resolve(out || '(no output)')
        },
      )
    })
  },
}
