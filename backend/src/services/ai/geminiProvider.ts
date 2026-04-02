import { GoogleGenAI } from '@google/genai'
import {
  AIProvider,
  CallScript,
  ProgramMapping,
  EmailTemplate,
  FresherDetection,
  RedFlagResult,
} from './types'
import { aiQueue } from './queue'

export class GeminiProvider implements AIProvider {
  private model: GoogleGenAI

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables')
    }
    this.model = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    })
  }

  private async call(prompt: string): Promise<string> {
    const result = await this.model.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
    })
    
    return result.text ?? ''
  }

  private parseJSON<T>(text: string): T {
    const clean = text.replace(/```json|```/g, '').trim()
    try {
      return JSON.parse(clean) as T
    } catch {
      throw new Error(`Gemini returned invalid JSON:\n${clean}`)
    }
  }

  async mapProgramsToJob(
    jobTitle: string,
    skills: string[],
    description: string,
    programsCatalogJson: string
  ): Promise<ProgramMapping> {
    const prompt = [
      'You are the placement AI for RV University, Bangalore.',
      'Canonical programme catalog (JSON array). Each item has id, school_code, name, keywords.',
      'ONLY choose programme ids from this catalog — never invent ids.',
      programsCatalogJson,
      '',
      'Job to analyze:',
      'Title: ' + jobTitle,
      'Skills: ' + skills.join(', '),
      'Description (first 500 chars): ' + description.substring(0, 500),
      '',
      'Which programmes are relevant for placing students from RVU?',
      '- 0.8+ = strong direct match, 0.5-0.79 = related, below 0.5 = exclude',
      '- Max 5 programme ids per job',
      'Return ONLY valid JSON (no markdown): { programs: string[], confidence: {program_id: number}, reasoning: string }',
    ].join('\n')

    const text = await aiQueue.add(() => this.call(prompt))
    return this.parseJSON<ProgramMapping>(text)
  }

  async detectFresherFriendly(
    jobTitle: string,
    experienceRequired: string,
    description: string
  ): Promise<FresherDetection> {
    const prompt = [
      'Is this job suitable for a fresh graduate with zero work experience?',
      'Job: ' + jobTitle + '. Experience required: ' + experienceRequired,
      'Description: ' + description.substring(0, 200),
      'Return ONLY valid JSON: { isFresherFriendly: boolean, reason: string }',
    ].join('\n')

    const text = await aiQueue.add(() => this.call(prompt))
    return this.parseJSON<FresherDetection>(text)
  }

  async detectRedFlags(
    company: string,
    jobTitle: string,
    salary: string,
    description: string
  ): Promise<RedFlagResult> {
    const prompt = [
      'Identify red flags in this fresher job posting.',
      'Red flags = no salary info, vague description, requires 2+ years despite saying fresher,',
      'suspicious company, unrealistic salary (too high or too low for India fresher).',
      'Company: ' + company + ', Title: ' + jobTitle + ', Salary: ' + salary,
      'Description: ' + description.substring(0, 300),
      'Return ONLY valid JSON: { hasRedFlags: boolean, flags: string[] }',
    ].join('\n')

    const text = await aiQueue.add(() => this.call(prompt))
    return this.parseJSON<RedFlagResult>(text)
  }

  async generateEmailTemplate(
    company: string,
    jobTitle: string,
    courses: string[],
    officerName: string,
    universityName: string,
    hrName = 'HR Team'
  ): Promise<EmailTemplate> {
    const prompt = [
      'Write a professional cold outreach email from a university placement officer.',
      'To: HR of ' + company + ' about the ' + jobTitle + ' position.',
      'From: ' + officerName + ', ' + universityName,
      'Relevant courses our students study: ' + courses.join(', '),
      'HR contact: ' + hrName,
      'Tone: professional, concise, 150-200 words. Request campus or virtual hiring drive.',
      'Return ONLY valid JSON: { subject: string, body: string }',
    ].join('\n')

    const text = await aiQueue.add(() => this.call(prompt))
    return this.parseJSON<EmailTemplate>(text)
  }

  async generateCallScript(
    company: string,
    jobTitle: string,
    courses: string[]
  ): Promise<CallScript> {
    const prompt = [
      'Write a cold call script for a placement officer calling ' + company + ' HR about ' + jobTitle + '.',
      'Students from these RVU courses are relevant: ' + courses.join(', '),
      'Format: Opening (10s), Value proposition (20s), 3 questions, How to close, 3 objection responses.',
      'Return ONLY valid JSON: { script: string } where script uses newlines between sections',
    ].join('\n')

    const text = await aiQueue.add(() => this.call(prompt))
    return this.parseJSON<CallScript>(text)
  }
}
