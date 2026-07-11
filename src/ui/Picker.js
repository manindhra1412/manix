import React, { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { color } from '../theme.js'

/** Generic filterable list overlay (models, sessions). */
export default function Picker({ title, load, onSelect, onCancel }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.resolve()
      .then(load)
      .then((it) => alive && setItems(it))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])

  const filtered = (items || []).filter((it) =>
    (it.label + ' ' + (it.extra || '')).toLowerCase().includes(q.toLowerCase()),
  )
  const PAGE = 10
  const sel = filtered.length ? ((idx % filtered.length) + filtered.length) % filtered.length : 0
  const start = Math.min(Math.max(0, sel - PAGE + 1), Math.max(0, filtered.length - PAGE))
  const visible = filtered.slice(start, start + PAGE)

  useInput((input, key) => {
    if (key.escape) return onCancel()
    if (key.return) {
      if (filtered.length) onSelect(filtered[sel])
      return
    }
    if (key.upArrow) return setIdx((i) => ((i - 1) + filtered.length) % filtered.length)
    if (key.downArrow) return setIdx((i) => (i + 1) % filtered.length)
    if (key.backspace || key.delete) {
      setQ((s) => s.slice(0, -1))
      setIdx(0)
      return
    }
    if (key.ctrl || key.meta || key.tab) return
    if (input) {
      setQ((s) => s + input)
      setIdx(0)
    }
  })

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color.border} paddingX={1} marginTop={1}>
      <Text color={color.accent} bold>
        {title}
      </Text>
      <Text>
        <Text color={color.accent}>❯ </Text>
        {q || <Text color={color.faint}>type to filter…</Text>}
      </Text>
      {error && <Text color={color.err}>{error}</Text>}
      {!items && !error && <Text color={color.dim}>loading…</Text>}
      {start > 0 && <Text color={color.faint}>  ↑ {start} more</Text>}
      {visible.map((it) => {
        const abs = filtered.indexOf(it)
        return (
          <Text key={it.id ?? it.label}>
            <Text color={abs === sel ? color.accent : color.user}>
              {abs === sel ? '❯ ' : '  '}
              {it.label}
            </Text>
            {it.extra ? <Text color={color.dim}>  {it.extra}</Text> : null}
          </Text>
        )
      })}
      {start + PAGE < filtered.length && <Text color={color.faint}>  ↓ {filtered.length - start - PAGE} more</Text>}
      {items && !filtered.length && <Text color={color.dim}>no matches</Text>}
      <Text color={color.faint}>↑↓ select · enter confirm · esc cancel · {filtered.length} items</Text>
    </Box>
  )
}
