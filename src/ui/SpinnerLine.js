import React, { useEffect, useMemo, useState } from 'react'
import { Box, Text } from 'ink'
import { color, lerpColor, LOGO } from '../theme.js'

// One verb is drawn per turn and held for the whole turn — like Claude Code's
// status line. It never changes mid-turn; nothing here moves horizontally.
const VERBS = [
  'Thinking',
  'Pondering',
  'Cooking',
  'Scheming',
  'Noodling',
  'Percolating',
  'Ruminating',
  'Excavating',
  'Synthesizing',
  'Wrangling',
  'Sketching',
  'Simmering',
  'Puzzling',
  'Tinkering',
  'Marinating',
  'Conjuring',
]

// Triangle rotates through four orientations.
// Each entry is exactly 2 columns wide (glyph + space) so the text never shifts.
const TRIANGLE_FRAMES = ['▲ ', '▶ ', '▼ ', '◀ ']

// Shine: bright highlight color that sweeps over the base orange text
const SHINE = '#ffe0b0'

/** Render `text` with a single-character shine highlight sweeping left→right.
 *  `pos` is a float 0..len+width — the center of the shine window. */
function shineText(text, pos) {
  const WIDTH = 3 // how many chars the highlight spans
  return [...text]
    .map((ch, i) => {
      const dist = Math.abs(i - pos)
      if (dist < WIDTH) {
        // Blend from accent → shine based on proximity to center
        const t = 1 - dist / WIDTH
        return lerpColor(color.accent, SHINE, t)(ch)
      }
      return lerpColor(color.accent, color.accent, 0)(ch)
    })
    .join('')
}

export default function SpinnerLine({ label, cost }) {
  const verb = useMemo(() => VERBS[Math.floor(Math.random() * VERBS.length)], [])
  const [frame, setFrame] = useState(0)
  const [start] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 80)
    return () => clearInterval(id)
  }, [])

  const secs = Math.floor((Date.now() - start) / 1000)

  // Triangle rotates independently (slower cadence).
  const triFrame = TRIANGLE_FRAMES[Math.floor(frame / 3) % TRIANGLE_FRAMES.length]
  const triColor = lerpColor(color.accent, color.amber, 0.5)

  // Shine sweeps left→right across the text then repeats
  const displayText = label || verb + '…'
  const TOTAL = displayText.length + 6 // pause at ends before repeating
  const shinePos = (frame % TOTAL) - 2   // leads in from -2, exits to len+2

  return (
    <Box marginTop={1}>
      <Text>{triColor(triFrame)}</Text>
      <Text>{shineText(displayText, shinePos)}</Text>
      <Text color={color.faint}>
        {' '}
        ({secs}s · esc to interrupt{cost ? ` · $${cost.toFixed(4)}` : ''})
      </Text>
    </Box>
  )
}
