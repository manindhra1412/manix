import fs from 'node:fs'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { MANIX_DIR } from './config.js'

/** Merge ~/.manix/mcp.json and ./.manix/mcp.json → { name: {command,args,env} } */
export function loadMcpConfigs(cwd) {
  const files = [path.join(MANIX_DIR, 'mcp.json'), path.join(cwd, '.manix', 'mcp.json')]
  const servers = {}
  for (const f of files) {
    try {
      Object.assign(servers, JSON.parse(fs.readFileSync(f, 'utf8')).mcpServers || {})
    } catch {}
  }
  return servers
}

function withTimeout(promise, ms, msg) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(msg)), ms)
    timer.unref?.()
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export class McpManager {
  constructor() {
    this.servers = new Map()
  }

  /** Connect all configured servers in the background; onUpdate fires per status change. */
  start(configs, onUpdate) {
    for (const [name, cfg] of Object.entries(configs)) {
      const entry = { name, status: 'connecting', tools: [], client: null, error: null }
      this.servers.set(name, entry)
      this.connect(entry, cfg)
        .then(() => onUpdate?.(entry))
        .catch((err) => {
          entry.status = 'error'
          entry.error = err.message
          onUpdate?.(entry)
        })
    }
  }

  async connect(entry, cfg) {
    const client = new Client({ name: 'manix', version: '0.1.0' })
    const transport = new StdioClientTransport({
      command: cfg.command,
      args: cfg.args || [],
      env: { ...process.env, ...(cfg.env || {}) },
      stderr: 'ignore',
    })
    await withTimeout(client.connect(transport), 15_000, `MCP "${entry.name}": connect timed out`)
    const { tools } = await withTimeout(client.listTools(), 15_000, `MCP "${entry.name}": listTools timed out`)
    entry.client = client
    entry.tools = tools || []
    entry.status = 'ready'
  }

  /** All ready servers' tools in Manix tool shape, namespaced mcp__server__tool. */
  getTools() {
    const out = []
    for (const s of this.servers.values()) {
      if (s.status !== 'ready') continue
      for (const tl of s.tools) {
        out.push({
          name: `mcp__${s.name}__${tl.name}`,
          safe: false, // external code — always gate behind permissions
          description: (tl.description || `${tl.name} from MCP server ${s.name}`).slice(0, 1024),
          parameters: tl.inputSchema || { type: 'object', properties: {} },
          describe: (a) => `${s.name}:${tl.name}(${JSON.stringify(a).slice(0, 48)})`,
          preview: (a) => JSON.stringify(a, null, 2).split('\n').slice(0, 10),
          run: async (a) => {
            const res = await s.client.callTool({ name: tl.name, arguments: a })
            const text = (res.content || [])
              .map((c) => (c.type === 'text' ? c.text : `[${c.type} content]`))
              .join('\n')
            if (res.isError) throw new Error(text || 'MCP tool returned an error')
            return text || '(no output)'
          },
        })
      }
    }
    return out
  }

  status() {
    return [...this.servers.values()].map((s) => ({
      name: s.name,
      status: s.status,
      tools: s.tools.length,
      error: s.error,
    }))
  }

  async closeAll() {
    for (const s of this.servers.values()) {
      try {
        await s.client?.close()
      } catch {}
    }
  }
}
