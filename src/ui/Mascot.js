import React from 'react'
import { Box, Text } from 'ink'
import { color, lerpColor } from '../theme.js'

// 5-row triangle: row i has (2i+1) glyphs, centred in width 9
const ROWS = 5
const lines = Array.from({ length: ROWS }, (_, i) => {
  const glyphs = 2 * i + 1
  const pad = ROWS - 1 - i
  return { glyphs, pad }
})

export default function Mascot() {
  return (
    <Box flexDirection="column" marginRight={2}>
      {lines.map(({ glyphs, pad }, i) => {
        const c = lerpColor(color.accent, color.amber, i / (ROWS - 1))
        return (
          <Text key={i}>
            {' '.repeat(pad)}{c('▲'.repeat(glyphs))}
          </Text>
        )
      })}
    </Box>
  )
}
