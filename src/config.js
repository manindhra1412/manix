import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const MANIX_DIR = path.join(os.homedir(), '.manix')
export const CONFIG_FILE = path.join(MANIX_DIR, 'config.json')
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5'

export function ensureDir(dir = MANIX_DIR) {
  fs.mkdirSync(dir, { recursive: true })
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

export function loadConfig() {
  const cfg = readJson(CONFIG_FILE)
  return {
    model: DEFAULT_MODEL,
    ...cfg,
    apiKey: process.env.OPENROUTER_API_KEY || cfg.apiKey || null,
  }
}

export function saveConfig(patch) {
  ensureDir()
  const next = { ...readJson(CONFIG_FILE), ...patch }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 })
  return next
}
