import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { color } from '../theme.js'

const OPTIONS = [
  { key: 'y', value: 'once', label: 'Yes, once (y)' },
  { key: 'a', value: 'always', label: 'Yes, always this session (a)' },
  { key: 'n', value: 'no', label: 'No (n / esc)' },
]

export default function PermissionPrompt({ request, onAnswer }) {
  const [idx, setIdx] = useState(0)

  useInput((input, key) => {
    if (key.upArrow) return setIdx((i) => (i + OPTIONS.length - 1) % OPTIONS.length)
    if (key.downArrow) return setIdx((i) => (i + 1) % OPTIONS.length)
    if (key.return) return onAnswer(OPTIONS[idx].value)
    if (key.escape) return onAnswer('no')
    const hot = OPTIONS.find((o) => o.key === (input || '').toLowerCase())
    if (hot) onAnswer(hot.value)
  })

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color.warn} paddingX={1} marginTop={1}>
      <Text color={color.warn} bold>
        Permission needed
      </Text>
      <Text bold>{request.display}</Text>
      {(request.preview || []).slice(0, 16).map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      <Box marginTop={1} flexDirection="column">
        {OPTIONS.map((o, i) => (
          <Text key={o.key} color={i === idx ? color.accent : color.dim}>
            {i === idx ? '❯ ' : '  '}
            {o.label}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
