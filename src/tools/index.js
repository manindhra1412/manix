import { fsTools } from './fs-tools.js'
import { searchTools } from './search.js'
import { bashTool } from './bash.js'

export function builtinTools() {
  return [...fsTools, ...searchTools, bashTool]
}

/** Manix tool → OpenAI function-calling schema. */
export function toOpenAI(tool) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || { type: 'object', properties: {} },
    },
  }
}
