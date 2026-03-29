import { GeminiProvider } from './geminiProvider'
import { ClaudeProvider } from './claudeProvider'
import type { AIProvider } from './types'

// CURRENTLY USING: Gemini (free tier — 1 500 req/day, 15 req/min)
// TO SWITCH TO CLAUDE:
//   1. Comment the GeminiProvider line below
//   2. Uncomment the ClaudeProvider line
//   3. Add CLAUDE_API_KEY to backend/.env
//   4. Run: npm install @anthropic-ai/sdk  (in backend/)
//   5. Implement ClaudeProvider methods in claudeProvider.ts
const activeProvider: AIProvider = new GeminiProvider()
// const activeProvider: AIProvider = new ClaudeProvider()

export { ClaudeProvider, GeminiProvider }
export type { AIProvider }
export const aiProvider = activeProvider
