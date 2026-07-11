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
  const raw = stats.contextLength ? (stats.tokens / stats.contextLength) * 100 : 0
  const pctDisplay = raw < 1 ? raw.toFixed(1) : Math.min(99, Math.round(raw))
  const pct = Math.min(99, raw) // numeric for color thresholds
  const pctColor = pct < 50 ? color.dim : pct < 80 ? color.warn : color.err

  return (
    <Box paddingX={1}>
      <Text color={color.faint}>{model}</Text>
      <Text color={color.faint}>{SEP}</Text>
      <Text color={pctColor}>ctx {pctDisplay}%</Text>
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
