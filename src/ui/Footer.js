import React from 'react'
import path from 'node:path'
import { Box, Text } from 'ink'
import { color } from '../theme.js'

const SEP = '  ·  '

export default function Footer({ model, stats, yolo, cwd, exitHint }) {
  if (exitHint) {
    return (
      <Box paddingX={1}>
        <Text color={color.warn}>press ctrl+c again to exit</Text>
      </Box>
    )
  }
  const pct = stats.contextLength
    ? Math.min(99, Math.round((stats.tokens / stats.contextLength) * 100))
    : 0
  const pctColor = pct < 50 ? color.dim : pct < 80 ? color.warn : color.err

  return (
    <Box paddingX={1}>
      <Text color={color.faint}>{model}</Text>
      <Text color={color.faint}>{SEP}</Text>
      <Text color={pctColor}>ctx {pct}%</Text>
      <Text color={color.faint}>{SEP}</Text>
      <Text color={color.accent}>${stats.cost.toFixed(4)}</Text>
      {yolo ? <Text color={color.warn}>{SEP}YOLO</Text> : null}
      <Text color={color.faint}>
        {SEP}
        {path.basename(cwd)}
      </Text>
    </Box>
  )
}
