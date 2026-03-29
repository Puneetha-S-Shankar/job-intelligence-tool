/**
 * Simple rate-limiter for AI API calls.
 * Gemini free tier = 15 req/min → max 3 concurrent + 1.2 s gap keeps us comfortably under.
 */
export class AIRequestQueue {
  private queue: Array<() => Promise<unknown>> = []
  private running = 0
  private readonly max = 3
  private readonly delay = 1200 // ms between completions

  add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await fn())
        } catch (e) {
          reject(e)
        }
      })
      this.process()
    })
  }

  private async process(): Promise<void> {
    if (this.running >= this.max || !this.queue.length) return
    this.running++
    const fn = this.queue.shift()!
    await fn()
    await new Promise<void>((r) => setTimeout(r, this.delay))
    this.running--
    this.process()
  }
}

export const aiQueue = new AIRequestQueue()
