import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

export const enrichmentService = {
  async getSchoolsJson(): Promise<string> {
    const { data, error } = await supabase
      .from('universities')
      .select('curriculum')
      .limit(1)
      .single()

    if (error) {
      throw new Error('Failed to fetch schools JSON: ' + error.message)
    }

    if (!data || !data.curriculum) {
      throw new Error('Curriculum not found in DB')
    }

    return JSON.stringify(data.curriculum)
  }
}