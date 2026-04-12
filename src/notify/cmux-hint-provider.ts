import type { BunShell } from "../lib/event-utils.js"

export interface CmuxHintProviderDeps {
  shell: BunShell
}

export class CmuxHintProvider {
  private hint: string = ""
  private hinted: boolean = false

  constructor(private readonly deps: CmuxHintProviderDeps) {}

  async init(): Promise<void> {
    try {
      const helpText = await this.deps.shell`cmux help 2>&1`.text()
      this.hint = helpText
        ? `You are running inside cmux. The full CLI reference follows.\n\n\`\`\`\n${helpText.trim()}\n\`\`\``
        : "You are running inside cmux. Run `cmux help` to see available commands."
    } catch {
      this.hint = "You are running inside cmux. Run `cmux help` to see available commands."
    }
  }

  async append(_input: unknown, output: { text?: string }): Promise<void> {
    if (this.hinted) return
    this.hinted = true
    output.text = (output.text || "") + `\n\n[cmux]\n${this.hint}`
  }
}
