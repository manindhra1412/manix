import React from 'react'
import { Box, Text } from 'ink'
import { MASCOT, color, lerpColor } from '../theme.js'

/** Small pixel-art logo mark, top (coral) to bottom (amber) gradient. */
export default function Mascot() {
  return (
    <Box flexDirection="column" marginRight={2}>
      {MASCOT.map((row, i) => {
        const c = lerpColor(color.accent, color.amber, MASCOT.length > 1 ? i / (MASCOT.length - 1) : 0)
        return (
          <Text key={i}>
            {[...row].map((ch, j) => (ch === '#' ? c('██') : '  ')).join('')}
          </Text>
        )
      })}
    </Box>
  )
}
