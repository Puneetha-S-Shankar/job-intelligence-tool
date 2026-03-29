export interface CourseMapping {
  courses: string[]
  confidence: Record<string, number>
  reasoning: string
}

export interface FresherDetection {
  isFresherFriendly: boolean
  reason: string
}

export interface RedFlagResult {
  hasRedFlags: boolean
  flags: string[]
}

export interface EmailTemplate {
  subject: string
  body: string
}

export interface CallScript {
  script: string
}

export interface AIProvider {
  mapCoursesToJob(
    jobTitle: string,
    skills: string[],
    description: string,
    schoolsJson: string
  ): Promise<CourseMapping>

  detectFresherFriendly(
    jobTitle: string,
    experienceRequired: string,
    description: string
  ): Promise<FresherDetection>

  detectRedFlags(
    company: string,
    jobTitle: string,
    salary: string,
    description: string
  ): Promise<RedFlagResult>

  generateEmailTemplate(
    company: string,
    jobTitle: string,
    courses: string[],
    officerName: string,
    universityName: string,
    hrName?: string
  ): Promise<EmailTemplate>

  generateCallScript(
    company: string,
    jobTitle: string,
    courses: string[]
  ): Promise<CallScript>
}
