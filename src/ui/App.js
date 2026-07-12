import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Static, Text, useApp, useInput } from 'ink'
import { Agent } from '../agent.js'
import { Permissions } from '../permissions.js'
import { fetchModels, getCredits } from '../openrouter.js'
import { saveConfig } from '../config.js'
import { listSessions, loadSession } from '../sessions.js'
import { slashCommands, helpText } from '../slash.js'
import { INIT_PROMPT } from '../prompts.js'
import { color, GLYPH, randomTip, shortenPath } from '../theme.js'
import { renderMarkdown } from '../markdown.js'
import LogItem from './LogItem.js'
import InputBox from './InputBox.js'
import PermissionPrompt from './PermissionPrompt.js'
import Picker from './Picker.js'
import SpinnerLine from './SpinnerLine.js'
import Footer from './Footer.js'
import Onboarding from './Onboarding.js'

export default function App({
  config,
  cwd,
  version,
  mcp,
  skills,
  contextFiles,
  initialPrompt,
  resumeTarget,
  yolo,
  screen,
}) {
  const { exit } = useApp()
  const [ready, setReady] = useState(!!config.apiKey)
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [activity, setActivity] = useState(null)
  const [permission, setPermission] = useState(null)
  const [overlay, setOverlay] = useState(null)
  const [stats, setStats] = useState({
    tokens: 0,
    contextLength: 128000,
    cost: 0,
    prompt: 0,
    completion: 0,
    requests: 0,
  })
  const [model, setModelState] = useState(config.model)
  const [yoloOn, setYoloOn] = useState(!!yolo)
  const [exitHint, setExitHint] = useState(false)
  // { text, seq } — seq bumps on every rewind so useEffect always fires
  const [prefill, setPrefill] = useState({ text: '', seq: 0 })
  // Bumped to force <Static> to remount and repaint only the kept items (rewind).
  const [staticKey, setStaticKey] = useState(0)

  const keyRef = useRef(0)
  const agentRef = useRef(null)
  const permsRef = useRef(null)
  const streamRef = useRef('')
  const flushTimer = useRef(null)
  const historyRef = useRef([])

  const push = useCallback((item) => {
    setItems((prev) => [...prev, { ...item, key: keyRef.current++ }])
  }, [])

  const commands = slashCommands(skills)

  function doResume(fileOrId) {
    const loaded = loadSession(fileOrId)
    if (!loaded) return push({ kind: 'error', text: 'Could not load session.' })
    agentRef.current.resumeFrom(loaded)
    push({
      kind: 'info',
      text: `Resumed session ${loaded.meta.id} (${loaded.messages.length} messages).`,
    })
    const lastAssistant = [...loaded.messages].reverse().find((m) => m.role === 'assistant' && m.content)
    if (lastAssistant) push({ kind: 'assistant', text: lastAssistant.content })
    setStats(agentRef.current.stats())
  }

  function runPrompt(text, displayText = text) {
    // keyRef.current is the key the user item is about to receive — capture it
    // before pushing so rewind can trim everything from this message onward.
    const watermark = keyRef.current
    push({ kind: 'user', text: displayText })
    setBusy(true)
    agentRef.current.send(text, watermark, displayText).finally(() => {
      setBusy(false)
      setActivity(null)
    })
  }

  function applyModel(id) {
    setModelState(id)
    agentRef.current.setModel(id)
    saveConfig({ model: id })
    push({ kind: 'info', text: `Model → ${id}` })
  }

  async function cleanup() {
    try {
      await mcp.closeAll()
    } catch {}
  }

  async function handleSlash(raw) {
    const [cmdName, ...rest] = raw.slice(1).split(' ')
    const args = rest.join(' ').trim()
    const cmd = commands.find((c) => c.name === cmdName.toLowerCase())
    if (!cmd) return push({ kind: 'error', text: `Unknown command /${cmdName} — try /help` })
    if (cmd.skill) {
      return runPrompt(
        `Use the "${cmd.skill.name}" skill below to handle this request.\n\n${cmd.skill.body}\n\n---\nUser input: ${args || '(none)'}`,
        `/${cmd.name} ${args}`.trim(),
      )
    }
    switch (cmd.name) {
      case 'help':
        return push({ kind: 'info', text: helpText(commands) })
      case 'clear':
        agentRef.current.reset()
        setStats(agentRef.current.stats())
        return push({ kind: 'info', text: 'Started a fresh conversation (history cleared).' })
      case 'exit':
        await cleanup()
        return exit()
      case 'yolo': {
        const p = permsRef.current
        p.yolo = !p.yolo
        setYoloOn(p.yolo)
        return push({
          kind: 'info',
          text: p.yolo ? 'YOLO on — all tools auto-approved. Careful.' : 'YOLO off — permissions restored.',
        })
      }
      case 'cost': {
        const s = agentRef.current.stats()
        const credits = await getCredits(config.apiKey)
        const creditLine = credits
          ? `\nOpenRouter credits: $${(credits.total_credits - credits.total_usage).toFixed(2)} remaining`
          : ''
        return push({
          kind: 'info',
          text: `Session: ${s.requests} requests · ${s.prompt + s.completion} tokens (${s.prompt} in / ${s.completion} out) · $${s.cost.toFixed(4)}${creditLine}`,
        })
      }
      case 'mcp': {
        const st = mcp.status()
        return push({
          kind: 'info',
          text: st.length
            ? st
                .map(
                  (x) =>
                    `${x.name}: ${x.status}${x.status === 'ready' ? ` (${x.tools} tools)` : ''}${x.error ? ' — ' + x.error : ''}`,
                )
                .join('\n')
            : 'No MCP servers configured. Add them to ~/.manix/mcp.json or .manix/mcp.json.',
        })
      }
      case 'skills':
        return push({
          kind: 'info',
          text: skills.length
            ? skills.map((s) => `${s.name}: ${s.description}`).join('\n')
            : 'No skills found. Add SKILL.md folders under ~/.manix/skills/ or .manix/skills/.',
        })
      case 'init':
        return runPrompt(INIT_PROMPT, '/init')
      case 'compact': {
        setBusy(true)
        push({ kind: 'info', text: 'Compacting conversation…' })
        try {
          await agentRef.current.compact()
          push({ kind: 'info', text: 'Compacted — context freed.' })
        } catch (e) {
          push({ kind: 'error', text: 'Compact failed: ' + e.message })
        } finally {
          setBusy(false)
        }
        return
      }
      case 'model':
        if (args) return applyModel(args)
        return setOverlay({ type: 'models' })
      case 'resume':
        return setOverlay({ type: 'sessions' })
      case 'rewind': {
        const turns = agentRef.current.turns()
        if (!turns.length) return push({ kind: 'info', text: 'Nothing to rewind — no turns in this session yet.' })
        return setOverlay({ type: 'rewind', turns })
      }
      default:
        return
    }
  }

  function handleSubmit(raw) {
    historyRef.current.push(raw)
    if (raw.startsWith('/')) return handleSlash(raw)
    runPrompt(raw)
  }

  // Build the agent once the API key exists.
  useEffect(() => {
    if (!ready || agentRef.current) return
    const permissions = new Permissions({ yolo: yoloOn })
    permsRef.current = permissions
    agentRef.current = new Agent({
      config: { ...config, model },
      cwd,
      permissions,
      mcp,
      skills,
      contextFiles,
      handlers: {
        onTextDelta: (d) => {
          streamRef.current += d
          if (!flushTimer.current) {
            flushTimer.current = setTimeout(() => {
              flushTimer.current = null
              setStreamText(streamRef.current)
            }, 60)
          }
        },
        onAssistantDone: (text) => {
          if (flushTimer.current) {
            clearTimeout(flushTimer.current)
            flushTimer.current = null
          }
          streamRef.current = ''
          setStreamText('')
          if (text?.trim()) push({ kind: 'assistant', text })
        },
        onToolStart: ({ display }) => setActivity(display),
        onToolEnd: ({ display, ok, summary }) => {
          setActivity(null)
          push({ kind: 'tool', display, ok, summary })
        },
        onInfo: (text) => push({ kind: 'info', text }),
        onError: (text) => push({ kind: 'error', text }),
        onStats: (s) => setStats(s),
        requestPermission: (req) => new Promise((resolve) => setPermission({ ...req, resolve })),
      },
    })

    push({
      kind: 'banner',
      version,
      model,
      cwd: shortenPath(cwd),
      hasManixmd: contextFiles.some((f) => f.path.startsWith(cwd)),
      tip: randomTip(),
    })

    if (resumeTarget === 'last' || resumeTarget === 'pick') {
      const sessions = listSessions(cwd)
      if (!sessions.length) push({ kind: 'info', text: 'No previous sessions found.' })
      else if (resumeTarget === 'last') doResume(sessions[0].file)
      else setOverlay({ type: 'sessions' })
    } else if (resumeTarget) {
      doResume(resumeTarget)
    }

    if (initialPrompt) runPrompt(initialPrompt)
  }, [ready])

  // Global keys: esc interrupts, ctrl+c twice exits.
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (permission) {
        permission.resolve('no')
        setPermission(null)
      }
      if (busy) return agentRef.current?.abort()
      if (exitHint) return void cleanup().finally(() => exit())
      setExitHint(true)
      setTimeout(() => setExitHint(false), 1500)
      return
    }
    if (key.escape && busy && !permission) agentRef.current?.abort()
  })

  if (!ready) {
    return (
      <Onboarding
        onDone={(key) => {
          config.apiKey = key
          setReady(true)
        }}
      />
    )
  }

  const overlayEl =
    overlay?.type === 'models' ? (
      <Picker
        title="Select model"
        load={async () => {
          const models = await fetchModels(config.apiKey)
          return models
            .slice()
            .sort((a, b) => a.id.localeCompare(b.id))
            .map((m) => ({
              id: m.id,
              label: m.id,
              extra: `${Math.round((m.context_length || 0) / 1000)}k ctx · $${perM(m.pricing?.prompt)}/${perM(m.pricing?.completion)} per M`,
            }))
        }}
        onSelect={(it) => {
          setOverlay(null)
          applyModel(it.id)
        }}
        onCancel={() => setOverlay(null)}
      />
    ) : overlay?.type === 'sessions' ? (
      <Picker
        title="Resume session"
        load={() =>
          listSessions(cwd).map((s) => ({
            id: s.file,
            label: s.title,
            extra: `${timeAgo(s.mtime)} · ${s.count} msgs`,
          }))
        }
        onSelect={(it) => {
          setOverlay(null)
          doResume(it.id)
        }}
        onCancel={() => setOverlay(null)}
      />
    ) : overlay?.type === 'rewind' ? (
      <Picker
        title="Rewind to a message — its file edits (and everything after) are reverted"
        load={() =>
          overlay.turns.map((t) => {
            const parts = []
            if (t.snapshots) parts.push(`${t.snapshots} file edit${t.snapshots !== 1 ? 's' : ''}`)
            if (t.bashCount) parts.push(`${t.bashCount} bash`)
            return {
              id: String(t.index),
              label: t.label || '(empty)',
              extra: parts.length ? parts.join(' · ') : 'no file changes',
            }
          })
        }
        onSelect={(it) => {
          setOverlay(null)
          const index = Number(it.id)
          const turn = overlay.turns.find((t) => t.index === index)
          const watermark = turn?.itemCount ?? 0
          const { files, bashCount } = agentRef.current.rewind(index)
          // Build a note about what was reverted, to show in the trimmed transcript.
          const notes = []
          if (files > 0) notes.push(`reverted ${files} file change${files !== 1 ? 's' : ''}`)
          if (bashCount > 0)
            notes.push(
              `${bashCount} bash command${bashCount !== 1 ? 's' : ''} ran after this point — any files they changed were NOT reverted`,
            )
          const notice = notes.length
            ? { kind: 'info', text: `Rewound — ${notes.join('; ')}.`, key: keyRef.current++ }
            : null
          // Physically wipe the terminal + Ink's committed <Static> buffer, trim the
          // log to items before the rewound message, then remount <Static> so it
          // repaints only those. Without this the old lines stay on screen.
          screen?.reset?.()
          setItems((prev) => {
            const kept = prev.filter((x) => x.key < watermark)
            return notice ? [...kept, notice] : kept
          })
          setStaticKey((k) => k + 1)
          // Drop the rewound message back into the composer to edit and resend.
          setPrefill((p) => ({ text: turn?.label || '', seq: p.seq + 1 }))
          setStats(agentRef.current.stats())
        }}
        onCancel={() => setOverlay(null)}
      />
    ) : null

  return (
    <Box flexDirection="column">
      <Static key={staticKey} items={items}>{(item) => <LogItem key={item.key} item={item} />}</Static>
      {streamText ? (
        <Box marginTop={1}>
          <Text color={color.accent}>{GLYPH.assistant} </Text>
          <Box flexDirection="column" flexGrow={1}>
            <Text>{renderMarkdown(streamText)}</Text>
          </Box>
        </Box>
      ) : null}
      {busy && !permission ? <SpinnerLine label={activity} cost={stats.cost} /> : null}
      {permission ? (
        <PermissionPrompt
          request={permission}
          onAnswer={(v) => {
            const { resolve } = permission
            setPermission(null)
            resolve(v)
          }}
        />
      ) : (
        overlayEl || (
          <Box flexDirection="column" marginTop={1}>
            <InputBox
              onSubmit={handleSubmit}
              commands={commands}
              active={!busy}
              history={historyRef.current}
              prefill={prefill}
            />
            <Footer model={model} stats={stats} yolo={yoloOn} cwd={cwd} exitHint={exitHint} />
          </Box>
        )
      )}
    </Box>
  )
}

function perM(p) {
  const n = parseFloat(p || 0) * 1e6
  return n ? (n < 10 ? n.toFixed(2) : Math.round(n)) : '0'
}

function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
