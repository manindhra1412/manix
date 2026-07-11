import fs from 'node:fs'
import { loadConfig } from './config.js'
import { loadSkills } from './skills.js'
import { loadContextFiles } from './manixmd.js'
import { loadMcpConfigs, McpManager } from './mcp.js'
import { gradient, t, LOGO } from './theme.js'

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') args.help = true
    else if (a === '-v' || a === '--version') args.version = true
    else if (a === '-p' || a === '--print') args.print = true
    else if (a === '-m' || a === '--model') args.model = argv[++i]
    else if (a === '-c' || a === '--continue') args.resume = 'last'
    else if (a === '-r' || a === '--resume') {
      const next = argv[i + 1]
      if (next && !next.startsWith('-')) args.resume = argv[++i]
      else args.resume = 'pick'
    } else if (a === '--yolo') args.yolo = true
    else args._.push(a)
  }
  return args
}

function usage() {
  return `${gradient(`${LOGO} Manix`)} ${t.dim(`v${pkg.version} — terminal coding agent powered by OpenRouter`)}

${t.bold('Usage')}
  manix [prompt]            interactive TUI (optional starting prompt)
  manix -p "task"           print mode (no TUI); assistant text → stdout
  echo "task" | manix       pipe a prompt

${t.bold('Flags')}
  -m, --model <id>    OpenRouter model for this run
  -c, --continue      resume the most recent session
  -r, --resume [id]   pick (or load) a previous session
      --yolo          auto-approve all tools (careful!)
  -p, --print         non-interactive print mode
  -v, --version       print version
  -h, --help          this help

${t.bold('Files')}
  config    ~/.manix/config.json         sessions  ~/.manix/sessions/
  MCP       ~/.manix/mcp.json · .manix/mcp.json
  skills    ~/.manix/skills/<name>/SKILL.md · .manix/skills/<name>/SKILL.md
  memory    ./MANIX.md (generate with /init)`
}

const args = parseArgs(process.argv.slice(2))
if (args.version) {
  console.log(pkg.version)
  process.exit(0)
}
if (args.help) {
  console.log(usage())
  process.exit(0)
}

const cwd = process.cwd()
const config = loadConfig()
if (args.model) config.model = args.model

let prompt = args._.join(' ').trim()

// Piped stdin → print mode.
if (!process.stdin.isTTY && !args.print) {
  const stdin = fs.readFileSync(0, 'utf8').trim()
  if (stdin) {
    prompt = [prompt, stdin].filter(Boolean).join('\n\n')
    args.print = true
  }
}

const skills = loadSkills(cwd)
const contextFiles = loadContextFiles(cwd)
const mcp = new McpManager()
const mcpConfigs = loadMcpConfigs(cwd)

if (args.print) {
  if (!config.apiKey) {
    console.error('No API key. Run `manix` once interactively, or set OPENROUTER_API_KEY.')
    process.exit(1)
  }
  if (!prompt) {
    console.error('No prompt. Usage: manix -p "task"')
    process.exit(1)
  }
  mcp.start(mcpConfigs)
  if (Object.keys(mcpConfigs).length) await waitForMcp(mcp, 5000)
  const { runPrint } = await import('./print.js')
  await runPrint({ config, cwd, prompt, yolo: !!args.yolo, mcp, skills, contextFiles })
  await mcp.closeAll()
  process.exit(process.exitCode || 0)
}

if (!process.stdout.isTTY) {
  console.error('Interactive mode needs a TTY. Use -p "task" for print mode.')
  process.exit(1)
}

mcp.start(mcpConfigs)

const { render } = await import('ink')
const { default: App } = await import('./ui/App.js')

const instance = render(
  <App
    config={config}
    cwd={cwd}
    version={pkg.version}
    mcp={mcp}
    skills={skills}
    contextFiles={contextFiles}
    initialPrompt={prompt || null}
    resumeTarget={args.resume || null}
    yolo={!!args.yolo}
  />,
  { exitOnCtrlC: false },
)
await instance.waitUntilExit()
await mcp.closeAll()
process.exit(0)

async function waitForMcp(manager, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (manager.status().every((s) => s.status !== 'connecting')) return
    await new Promise((r) => setTimeout(r, 100))
  }
}
