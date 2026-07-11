# Manix — Terminal Coding Agent

Manix is a real, end-to-end terminal coding agent in the spirit of Claude Code, Pi, and
OpenCode — powered by **OpenRouter**, so any model (Claude, GPT, Gemini, DeepSeek, free
models) works through one API key. This file is the living plan + engineering guide.

## 1. Vision & principles

- **Real agent, not a chat wrapper**: streaming agentic loop with tool use — read/write/edit
  files, run shell commands, search the repo — until the task is done.
- **Hand-written core, no frameworks**: no LangChain/AI-SDK/agent libs, not even the openai
  SDK — raw `fetch` + hand-parsed SSE. The loop is ours, inspired by Claude Code & Pi.
- **Terminal-first polish**: beautiful Ink TUI, calm Ember theme, readable for hours.
- **Safe by default**: read-only tools run freely; anything that mutates (write/edit/bash/MCP)
  asks permission (once / always-this-session / no). `--yolo` opts out.
- **Model-agnostic**: hot-swap any OpenRouter model mid-session with `/model`; live pricing
  and context-window data; per-session cost tracking.
- **Extensible**: MCP servers add tools; Skills (markdown playbooks) add expertise;
  MANIX.md adds project memory.

## 2. Design theme — “Ember”

Warm coral/amber accents on neutral dark chrome. Calm, professional, no neon noise.

| Token    | Hex       | Used for                                  |
|----------|-----------|-------------------------------------------|
| accent   | `#ff9f6b` | logo ▲, prompts ❯, bullets ⏺/●, selection |
| amber    | `#ffd27f` | gradient end of banner/logo               |
| user     | `#d7d3cd` | user message text                         |
| dim      | `#8a8580` | secondary text, summaries, hints          |
| faint    | `#5c5854` | chrome, code-fence rails                  |
| border   | `#4a443f` | box borders (rounded)                     |
| ok       | `#98c379` | success, diff +                           |
| err      | `#e06c75` | errors, diff −                            |
| warn     | `#e5c07b` | permission prompts, warnings              |
| code     | `#61afef` | inline code, fenced code                  |

Glyph language: `▲` logo · `❯` user/input prompt · `⏺` assistant · `●` tool call ·
`○` info · `✗` error · braille spinner `⠋⠙⠹…`. Banner text uses an accent→amber gradient.

## 3. Tech stack

| Layer        | Choice                                     | Why                                          |
|--------------|--------------------------------------------|----------------------------------------------|
| Language     | **Plain JavaScript (ESM)** + JSX           | User choice; JSX compiled by esbuild          |
| Runtime      | Node.js ≥ 20                               | fetch, AbortController, streams built in      |
| TUI          | **Ink 5 + React 18**                       | Same approach as Claude Code/Gemini CLI       |
| LLM          | **OpenRouter, raw `fetch` + hand-rolled SSE** | No SDK; full control of streaming/tool deltas |
| MCP          | `@modelcontextprotocol/sdk` (stdio client) | Official protocol client                      |
| Search       | `rg` if installed, JS fallback; `fast-glob`| Fast grep/glob tools                          |
| Styling      | `chalk` 5                                  | Theme colors, gradient                        |
| Build        | esbuild (transpile JSX only, no bundling)  | `src/**.js` → `dist/**.js`, deps stay in npm  |

Dependencies (5 runtime + 1 dev): ink, react, chalk, fast-glob, @modelcontextprotocol/sdk;
esbuild. **No agent frameworks, no LLM SDKs.** No TypeScript; JSDoc where helpful.

## 4. Architecture

```
bin/manix.js            #!/usr/bin/env node → imports dist/cli.js
scripts/build.mjs       esbuild transpile (loader js→jsx), src → dist
scripts/smoke.mjs       offline smoke tests (tools, config, sessions, skills, markdown, SSE)
src/
  cli.js                arg parsing, mode select (interactive TUI vs -p print), wiring
  print.js              non-TTY / -p mode: agent loop with plain console output
  agent.js              THE agent loop: stream → tool calls → permissions → results → repeat
  openrouter.js         raw fetch client: streamChat (SSE parser, tool-call delta
                        accumulation), models list, credits, key validation
  prompts.js            system prompt builder (identity, cwd, MANIX.md, skills list)
  permissions.js        ask / always-per-session / yolo logic
  sessions.js           JSONL sessions in ~/.manix/sessions, list/load/resume
  config.js             ~/.manix/config.json (0600), env override OPENROUTER_API_KEY
  skills.js             SKILL.md loader (frontmatter) + `skill` tool for the model
  manixmd.js            MANIX.md loader + /init prompt
  mcp.js                McpManager: connect stdio servers, expose mcp__srv__tool tools
  markdown.js           small ANSI markdown renderer (fences, bold, lists, headings)
  theme.js              Ember palette + gradient()
  slash.js              slash command metadata (+dynamic skill commands)
  tools/
    index.js            registry, OpenAI-format schema conversion
    fs-tools.js         read_file, write_file, edit_file (unique-match), list_dir
    search.js           glob_files, grep_search (rg → JS fallback)
    bash.js             shell exec, timeout, output truncation
  ui/
    App.js              state machine: onboard → ready; items log via <Static>
    Onboarding.js       first-run API-key capture (masked, validated, saved)
    LogItem.js          renders banner/user/assistant/tool/info/error items
    InputBox.js         line editor: cursor, history, slash menu, hotkeys
    PermissionPrompt.js y / a / n selector with diff/command preview
    Picker.js           generic filterable list (models, sessions)
    SpinnerLine.js      activity + elapsed + esc hint
    Footer.js           model · context % · cost · yolo · cwd
```

Data flow: `App` (or `print.js`) constructs an `Agent` with UI handlers
(`onTextDelta`, `onToolStart/End`, `requestPermission → Promise<'once'|'always'|'no'>`).
The agent is UI-agnostic — same core in TUI and print modes; it never imports Ink.

Message history is OpenAI-format (`user`/`assistant(+tool_calls)`/`tool`), persisted per
message to the session JSONL. System prompt is rebuilt every request (fresh MANIX.md,
skills, MCP tools).

### Agent loop (src/agent.js) — hand-written

1. push user message → for up to 40 iterations:
2. `POST /chat/completions` (stream) via fetch; SSE parser emits text deltas → UI and
   accumulates tool-call fragments by `index` (skip `: OPENROUTER PROCESSING` comments)
3. no tool calls → done. Else for each call: permission gate → execute → append `tool` result
4. abort (Esc) cancels via AbortController; dangling tool_calls get "Interrupted" results
   so history stays valid for the next turn.

Cost = usage (from final SSE chunk) × pricing from the cached `/models` list. Context
estimate = chars/4 vs `context_length`; warn at 80%; `/compact` summarizes and restarts.

## 5. Features (v1)

- Streaming agentic loop, tool use, Esc-to-interrupt, double-Ctrl-C exit
- Tools: read_file, write_file, edit_file, list_dir, glob_files, grep_search, bash, skill,
  plus all MCP tools (namespaced `mcp__server__tool`)
- Permission system with diff preview for edits, command preview for bash
- Sessions: auto-saved JSONL; `manix --continue` (last), `manix --resume` / `/resume` (picker)
- Model switcher: `/model` picker with context size + $/M pricing; persisted default
- Slash commands: /help /model /resume /clear /compact /cost /mcp /skills /init /yolo /exit
  (+ every skill becomes /skill-name)
- MANIX.md project memory (auto-loaded from cwd + ~/.manix/MANIX.md); `/init` generates it
- Skills: `~/.manix/skills/<name>/SKILL.md` and `.manix/skills/<name>/SKILL.md`
  (frontmatter `name:`/`description:`), listed in the system prompt, loadable by the model
  via the `skill` tool or by the user via `/<name>`
- MCP: `~/.manix/mcp.json` + project `.manix/mcp.json`
  `{ "mcpServers": { "name": { "command": "npx", "args": [...], "env": {} } } }`
- Cost tracking: `/cost` shows session tokens/$ and remaining OpenRouter credits
- Print mode: `manix -p "task"` or `echo task | manix` (assistant text → stdout,
  status → stderr; mutations auto-denied unless `--yolo`)

## 6. How users use Manix

```bash
npm install -g manix        # or: npx manix
cd your-project
manix                        # first run: paste OpenRouter key (openrouter.ai/keys)
```

Everyday flow:
```
❯ fix the failing test in src/auth.test.js
  ● Bash(npm test)…  ● Read(src/auth.js)…  ● Edit(src/auth.js) +4 -1   [permission: y/a/n]
  ⏺ Fixed — the token expiry check was inverted. Tests pass.
```

- `manix "prompt"` starts with a task; `manix -p "prompt"` for scripts/CI; `--model x` /
  `--yolo` / `--continue` / `--resume` flags.
- `/init` once per repo to generate MANIX.md; edit it like you would CLAUDE.md.
- Add skills by dropping `SKILL.md` folders; add MCP servers in `.manix/mcp.json`.

## 7. Deployment strategy

- **Registry**: npm package `manix` (name verified available 2026-07-11), bin `manix`.
  `files: [bin, dist, README.md]` — src not shipped; `prepublishOnly` builds.
- **Pipeline**: GitHub Actions —
  - `ci.yml`: push/PR → install, build, smoke tests (Node 20 + 22 matrix)
  - `publish.yml`: tag `v*` → build + test → `npm publish --provenance --access public`
    (needs `NPM_TOKEN` repo secret)
- **Versioning**: semver. `npm version patch|minor && git push --follow-tags` is the whole
  release. 0.x while iterating; 1.0 when the tool loop + permissions are battle-tested.
- **Later (v0.3+)**: Homebrew tap + standalone binaries, `manix update` self-check.

## 8. Development

```bash
npm install
npm run build     # esbuild src → dist
npm run dev       # build + run local manix
npm test          # offline smoke tests (no API key needed)
node bin/manix.js -p "hello" --yolo   # live e2e (needs OPENROUTER_API_KEY)
```

Conventions: ESM only; plain JS + JSX (esbuild `--loader:.js=jsx`, automatic runtime);
UI code stays in `src/ui/`, agent core must never import Ink; every user-visible string
uses the Ember theme via `theme.js` — no raw ANSI colors elsewhere.

## 9. Roadmap

- v0.2: auto-compaction, queued input while streaming, per-command bash allowlist,
  `/theme` (Neon Grid, Phosphor, Aurora), web search tool
- v0.3: Homebrew + binaries, subagents, hooks, OpenRouter provider routing preferences
- v0.4: MANIX.md auto-memory, checkpoints/undo, IDE handoff
