# ▲ Manix

A fast, beautiful terminal coding agent powered by [OpenRouter](https://openrouter.ai) —
any model (Claude, GPT, Gemini, DeepSeek, free models), one key. Hand-written agent loop,
no frameworks.

```bash
npm install -g manix     # or: npx manix
cd your-project
manix
```

First run asks for your OpenRouter API key (get one at [openrouter.ai/keys](https://openrouter.ai/keys)) —
or `export OPENROUTER_API_KEY=...`.

## What it does

```
❯ fix the failing test in src/auth.test.js
  ● Bash(npm test)
  ● Read(src/auth.js)
  ● Edit(src/auth.js)          ← asks permission, shows the diff
  ⏺ Fixed — the token expiry check was inverted. Tests pass.
```

- **Agentic loop** — streams responses, reads/writes/edits files, runs shell commands,
  greps the repo, keeps going until the task is done.
- **Safe by default** — mutating actions ask permission (yes / always this session / no).
  `--yolo` to live dangerously.
- **Any model** — `/model` opens a live picker with context windows and $/M pricing.
- **Sessions** — every conversation is saved; `manix --continue` or `/resume`.
- **Rewind** — `/rewind` jumps back to any earlier message: reverts the file edits it made,
  trims the chat, and drops the message back in the composer to redo.
- **MANIX.md** — project memory auto-loaded each session; generate with `/init`.
- **Skills** — drop a `SKILL.md` playbook in `~/.manix/skills/<name>/` or `.manix/skills/<name>/`;
  the agent loads it when relevant, or invoke directly with `/<name>`.
- **MCP** — add servers to `~/.manix/mcp.json` or `.manix/mcp.json`:
  ```json
  { "mcpServers": { "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] } } }
  ```
- **Cost tracking** — `/cost` shows session spend and remaining OpenRouter credits.

## Commands

| Command | | Flags | |
|---|---|---|---|
| `/help` | commands & shortcuts | `manix "task"` | start with a prompt |
| `/model [id]` | switch model | `-p, --print` | non-interactive mode |
| `/resume` | resume a session | `-m, --model <id>` | model for this run |
| `/rewind` | revert to a past message | `-c, --continue` | resume last session |
| `/compact` | summarize history | `-r, --resume [id]` | pick a session |
| `/cost` | usage + credits | `--yolo` | auto-approve tools |
| `/mcp` `/skills` | status / list | `-v` `-h` | version / help |
| `/init` | generate MANIX.md | `echo task \| manix` | pipe a prompt |
| `/clear` `/yolo` `/exit` | | | |

Shortcuts: **Esc** interrupt · **↑/↓** history · **Tab** complete · **Ctrl+C** twice to quit.

## Skills format

```markdown
---
name: commit
description: Write conventional commits from the staged diff
---
Steps: run `git diff --staged`, group changes, write a conventional commit message…
```

## Development

```bash
npm install && npm test      # build + offline smoke tests
npm run dev                  # build & run locally
```

Plain JavaScript (ESM) + JSX via esbuild. Ink 5 TUI. Raw-fetch OpenRouter client with a
hand-rolled SSE parser — see [CLAUDE.md](CLAUDE.md) for the full architecture.
