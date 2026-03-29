/**
 * Backward-compatible re-export layer.
 * Any existing code that imports from "services/claudeService" keeps working
 * while the actual implementation routes through the active AI provider.
 */
import { aiProvider } from './ai/index'

export const mapCoursesToJob = aiProvider.mapCoursesToJob.bind(aiProvider)
export const detectFresherFriendly = aiProvider.detectFresherFriendly.bind(aiProvider)
export const detectRedFlags = aiProvider.detectRedFlags.bind(aiProvider)
export const generateEmailTemplate = aiProvider.generateEmailTemplate.bind(aiProvider)
export const generateCallScript = aiProvider.generateCallScript.bind(aiProvider)
