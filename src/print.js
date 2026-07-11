import { Agent } from './agent.js'
import { Permissions } from './permissions.js'
import { t, GLYPH } from './theme.js'

/**
 * Print mode: assistant text → stdout, status → stderr.
 * Mutating tools are auto-denied unless --yolo.
 */
export async function runPrint({ config, cwd, prompt, yolo, mcp, skills, contextFiles }) {
  const permissions = new Permissions({ yolo })
  let failed = false
  const agent = new Agent({
    config,
    cwd,
    permissions,
    mcp,
    skills,
    contextFiles,
    handlers: {
      onTextDelta: (d) => process.stdout.write(d),
      onAssistantDone: (text) => {
        if (text) process.stdout.write('\n')
      },
      onToolStart: ({ display }) => process.stderr.write(t.dim(`${GLYPH.tool} ${display}\n`)),
      onToolEnd: ({ display, ok, summary }) => {
        if (!ok) process.stderr.write(t.err(`${GLYPH.error} ${display}: ${summary}\n`))
      },
      onInfo: (m) => process.stderr.write(t.dim(`${GLYPH.info} ${m}\n`)),
      onError: (m) => {
        failed = true
        process.stderr.write(t.err(`${GLYPH.error} ${m}\n`))
      },
      requestPermission: async () => {
        process.stderr.write(
          t.warn(`${GLYPH.info} action auto-denied — use --yolo to allow writes/bash in print mode\n`),
        )
        return 'no'
      },
    },
  })

  await agent.send(prompt)
  const s = agent.stats()
  process.stderr.write(
    t.dim(`— ${s.requests} req · ${s.prompt + s.completion} tok · $${s.cost.toFixed(4)}\n`),
  )
  if (failed) process.exitCode = 1
}
