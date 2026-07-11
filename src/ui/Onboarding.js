import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { color, hr } from '../theme.js'
import { validateKey } from '../openrouter.js'
import { saveConfig } from '../config.js'
import Mascot from './Mascot.js'

export default function Onboarding({ onDone }) {
  const [key, setKey] = useState('')
  const [state, setState] = useState('input') // input | checking | error
  const [error, setError] = useState('')

  useInput((input, k) => {
    if (state === 'checking') return
    if (k.return) {
      const trimmed = key.trim()
      if (!trimmed) return
      setState('checking')
      validateKey(trimmed).then((ok) => {
        if (ok) {
          saveConfig({ apiKey: trimmed })
          onDone(trimmed)
        } else {
          setState('error')
          setError('Key rejected by OpenRouter — check it and try again.')
          setKey('')
        }
      })
      return
    }
    if (k.backspace || k.delete) return setKey((s) => s.slice(0, -1))
    if (k.ctrl || k.meta || k.escape || k.tab) return
    if (input) setKey((s) => s + input.replace(/\s/g, ''))
  })

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Mascot />
        <Box flexDirection="column">
          <Text bold color={color.user}>
            Manix
          </Text>
          <Text color={color.dim}>Terminal coding agent</Text>
          <Text color={color.faint}>powered by OpenRouter</Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={color.faint}>{hr(2)}</Text>
        <Box paddingX={1}>
          <Text color={color.accent}>❯ </Text>
          {state === 'checking' ? (
            <Text color={color.dim}>validating key…</Text>
          ) : key ? (
            <Text>{'•'.repeat(Math.min(key.length, 48))}</Text>
          ) : (
            <Text color={color.faint}>paste your OpenRouter API key, then enter</Text>
          )}
        </Box>
        <Text color={color.faint}>{hr(2)}</Text>
      </Box>

      {state === 'error' && (
        <Box marginTop={1}>
          <Text color={color.err}>{error}</Text>
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        <Text color={color.faint}>Get a key → https://openrouter.ai/keys</Text>
        <Text color={color.faint}>Saved to ~/.manix/config.json (0600) · or export OPENROUTER_API_KEY</Text>
      </Box>
    </Box>
  )
}
