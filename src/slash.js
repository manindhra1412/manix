/** Slash command metadata. Execution lives in ui/App.js / print mode. */
export function slashCommands(skills = []) {
  const base = [
    { name: 'help', desc: 'Show commands and shortcuts' },
    { name: 'model', desc: 'Switch model — picker, or /model <id>' },
    { name: 'resume', desc: 'Resume a previous session' },
    { name: 'rewind', desc: 'Pick a past turn and revert all file changes since then' },
    { name: 'clear', desc: 'Start a fresh conversation' },
    { name: 'compact', desc: 'Summarize history to free context' },
    { name: 'cost', desc: 'Session usage + OpenRouter credits' },
    { name: 'mcp', desc: 'MCP server status' },
    { name: 'skills', desc: 'List available skills' },
    { name: 'init', desc: 'Generate MANIX.md for this project' },
    { name: 'yolo', desc: 'Toggle auto-approve for all tools' },
    { name: 'exit', desc: 'Quit Manix' },
  ]
  const skillCmds = skills.map((s) => ({ name: s.name, desc: `(skill) ${s.description}`, skill: s }))
  return [...base, ...skillCmds]
}

export function helpText(commands) {
  const rows = commands.map((c) => `  /${c.name.padEnd(12)} ${c.desc}`)
  return [
    'Commands:',
    ...rows,
    '',
    'Shortcuts: Esc interrupt · ↑/↓ history · Tab complete · Ctrl+C twice to quit',
    'Flags: manix "task" · -p print mode · --model <id> · --continue · --resume · --yolo',
  ].join('\n')
}
