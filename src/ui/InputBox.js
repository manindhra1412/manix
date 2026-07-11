import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import chalk from 'chalk'
import { color, hr } from '../theme.js'

/** Line editor: cursor movement, history, slash-command menu, ctrl+a/e/u. */
export default function InputBox({ onSubmit, commands, active, history }) {
  const [value, setValue] = useState('')
  const [pos, setPos] = useState(0)
  const [histIdx, setHistIdx] = useState(-1)
  const [menuIdx, setMenuIdx] = useState(0)

  const menuOpen = active && value.startsWith('/') && !value.includes(' ')
  const matches = menuOpen
    ? commands.filter((c) => ('/' + c.name).startsWith(value.toLowerCase()))
    : []
  const sel = matches.length ? Math.min(menuIdx, matches.length - 1) : 0

  useInput(
    (input, key) => {
      if (key.return) {
        if (menuOpen && matches.length) {
          setValue('')
          setPos(0)
          setMenuIdx(0)
          setHistIdx(-1)
          onSubmit('/' + matches[sel].name)
          return
        }
        const text = value.trim()
        if (!text) return
        setValue('')
        setPos(0)
        setHistIdx(-1)
        onSubmit(text)
        return
      }
      if (key.tab) {
        if (menuOpen && matches.length) {
          const cmd = '/' + matches[sel].name + ' '
          setValue(cmd)
          setPos(cmd.length)
        }
        return
      }
      if (key.upArrow) {
        if (menuOpen && matches.length) return setMenuIdx((i) => (i + matches.length - 1) % matches.length)
        if (history.length) {
          const next = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1)
          setHistIdx(next)
          setValue(history[next])
          setPos(history[next].length)
        }
        return
      }
      if (key.downArrow) {
        if (menuOpen && matches.length) return setMenuIdx((i) => (i + 1) % matches.length)
        if (histIdx !== -1) {
          const next = histIdx + 1
          if (next >= history.length) {
            setHistIdx(-1)
            setValue('')
            setPos(0)
          } else {
            setHistIdx(next)
            setValue(history[next])
            setPos(history[next].length)
          }
        }
        return
      }
      if (key.leftArrow) return setPos((p) => Math.max(0, p - 1))
      if (key.rightArrow) return setPos((p) => Math.min(value.length, p + 1))
      if (key.escape) {
        setValue('')
        setPos(0)
        setHistIdx(-1)
        return
      }
      if (key.backspace || key.delete) {
        if (pos > 0) {
          setValue(value.slice(0, pos - 1) + value.slice(pos))
          setPos(pos - 1)
        }
        return
      }
      if (key.ctrl && input === 'u') {
        setValue('')
        setPos(0)
        return
      }
      if (key.ctrl && input === 'a') return setPos(0)
      if (key.ctrl && input === 'e') return setPos(value.length)
      if (key.ctrl || key.meta) return
      if (input) {
        const clean = input.replace(/\r/g, '\n')
        setValue(value.slice(0, pos) + clean + value.slice(pos))
        setPos(pos + clean.length)
        setMenuIdx(0)
      }
    },
    { isActive: active },
  )

  return (
    <Box flexDirection="column">
      {menuOpen && matches.length > 0 && (
        <Box flexDirection="column" marginLeft={2} marginBottom={1}>
          {matches.slice(0, 6).map((c, i) => (
            <Text key={c.name}>
              <Text color={i === sel ? color.accent : color.dim}>
                {i === sel ? '❯ ' : '  '}/{c.name.padEnd(14)}
              </Text>
              <Text color={color.faint}>{c.desc}</Text>
            </Text>
          ))}
        </Box>
      )}
      <Text color={color.faint}>{hr(2)}</Text>
      <Box paddingX={1}>
        <Text color={color.accent}>❯ </Text>
        <Text>{renderValue(value, pos, active)}</Text>
      </Box>
      <Text color={color.faint}>{hr(2)}</Text>
    </Box>
  )
}

function renderValue(value, pos, active) {
  if (!active) return chalk.hex(color.faint)(value || 'working… (esc to interrupt)')
  if (!value) return chalk.inverse(' ') + chalk.hex(color.faint)('ask anything · "/" for commands')
  return value.slice(0, pos) + chalk.inverse(value[pos] || ' ') + value.slice(pos + 1)
}
