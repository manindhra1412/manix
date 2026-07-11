/**
 * Permission gate. Read-only tools pass automatically; mutating tools ask the UI.
 * ask() → Promise<'once'|'always'|'no'>. In print mode ask is null → deny.
 */
export class Permissions {
  constructor({ yolo = false } = {}) {
    this.yolo = yolo
    this.always = new Set()
  }

  async check(tool, ask) {
    if (tool.safe || this.yolo || this.always.has(tool.name)) return true
    if (!ask) return false
    const answer = await ask()
    if (answer === 'always') {
      this.always.add(tool.name)
      return true
    }
    return answer === 'once'
  }
}
