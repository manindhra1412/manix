import React from 'react'
import { Box, Text } from 'ink'
import { color, GLYPH } from '../theme.js'
import { renderMarkdown } from '../markdown.js'
import Mascot from './Mascot.js'

export default function LogItem({ item }) {
  switch (item.kind) {
    case 'banner':
      return (
        <Box flexDirection="column" marginBottom={1}>
          <Box flexDirection="row">
            <Mascot />
            <Box flexDirection="column">
              <Text>
                <Text bold color={color.user}>
                  Manix
                </Text>
                <Text color={color.faint}>  v{item.version}</Text>
              </Text>
              <Text color={color.dim}>{item.model}</Text>
              <Text color={color.faint}>{item.cwd}</Text>
            </Box>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {!item.hasManixmd && (
              <Text color={color.faint}>
                {GLYPH.info} MANIX.md not found — /init to create
              </Text>
            )}
            <Text color={color.faint}>
              {GLYPH.info} {item.tip}
            </Text>
          </Box>
        </Box>
      )
    case 'user':
      return (
        <Box marginTop={1}>
          <Text color={color.accent}>{GLYPH.user} </Text>
          <Text color={color.user}>{item.text}</Text>
        </Box>
      )
    case 'assistant':
      return (
        <Box marginTop={1}>
          <Text color={color.accent}>{GLYPH.assistant} </Text>
          <Box flexDirection="column" flexGrow={1}>
            <Text>{renderMarkdown(item.text)}</Text>
          </Box>
        </Box>
      )
    case 'tool':
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text color={item.ok ? color.accent : color.err}>{GLYPH.tool} </Text>
            <Text bold>{item.display}</Text>
          </Text>
          {item.summary ? (
            <Box marginLeft={2}>
              <Text color={color.dim}>{item.summary}</Text>
            </Box>
          ) : null}
        </Box>
      )
    case 'info':
      return (
        <Box marginTop={1}>
          <Text color={color.dim}>
            {GLYPH.info} {item.text}
          </Text>
        </Box>
      )
    case 'error':
      return (
        <Box marginTop={1}>
          <Text color={color.err}>
            {GLYPH.error} {item.text}
          </Text>
        </Box>
      )
    default:
      return null
  }
}
