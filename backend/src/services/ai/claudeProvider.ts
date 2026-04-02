/**
 * STUB — complete once you have a Claude API key.
 *
 * To activate:
 *   1. npm install @anthropic-ai/sdk  (in backend/)
 *   2. Add CLAUDE_API_KEY to backend/.env
 *   3. Implement each method mirroring GeminiProvider prompts,
 *      using messages array with system + user roles:
 *        client.messages.create({
 *          model: "claude-sonnet-4-20250514",
 *          max_tokens: 800,
 *          system: "You are the placement AI for RV University...",
 *          messages: [{ role: "user", content: prompt }]
 *        })
 *   4. In index.ts swap activeProvider to new ClaudeProvider()
 */
import type {
  AIProvider,
  CallScript,
  ProgramMapping,
  EmailTemplate,
  FresherDetection,
  RedFlagResult,
} from './types'

export class ClaudeProvider implements AIProvider {
  constructor() {
    if (!process.env.CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY is not set in environment variables')
    }
  }

  async mapProgramsToJob(
    _jobTitle: string,
    _skills: string[],
    _description: string,
    _programsCatalogJson: string
  ): Promise<ProgramMapping> {
    throw new Error('ClaudeProvider.mapProgramsToJob is not yet implemented')
  }

  async detectFresherFriendly(
    _jobTitle: string,
    _experienceRequired: string,
    _description: string
  ): Promise<FresherDetection> {
    throw new Error('ClaudeProvider.detectFresherFriendly is not yet implemented')
  }

  async detectRedFlags(
    _company: string,
    _jobTitle: string,
    _salary: string,
    _description: string
  ): Promise<RedFlagResult> {
    throw new Error('ClaudeProvider.detectRedFlags is not yet implemented')
  }

  async generateEmailTemplate(
    _company: string,
    _jobTitle: string,
    _courses: string[],
    _officerName: string,
    _universityName: string,
    _hrName?: string
  ): Promise<EmailTemplate> {
    throw new Error('ClaudeProvider.generateEmailTemplate is not yet implemented')
  }

  async generateCallScript(
    _company: string,
    _jobTitle: string,
    _courses: string[]
  ): Promise<CallScript> {
    throw new Error('ClaudeProvider.generateCallScript is not yet implemented')
  }
}
