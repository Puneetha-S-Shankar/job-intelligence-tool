import dotenv from 'dotenv'
dotenv.config()

import { aiProvider } from './services/ai/index'
import { enrichmentService } from './services/enrichmentService'

async function run() {
  try {
    console.log("🚀 Testing DB → AI pipeline...\n")

    // ✅ Step 1: Fetch schools JSON from DB
    const schoolsJson = await enrichmentService.getSchoolsJson()
    console.log("✅ Schools JSON fetched from DB\n")

    // Optional: print a small preview
    console.log("Preview:", schoolsJson.substring(0, 200), "...\n")

    // ✅ Step 2: Call AI
    const result = await aiProvider.mapCoursesToJob(
      'React Developer',
      ['JavaScript', 'React', 'Node.js'], // ✅ ARRAY (important)
      'Build frontend apps using React and APIs',
      schoolsJson
    )

    console.log("🎯 AI RESULT:\n", result)

  } catch (err) {
    console.error("❌ ERROR:", err)
  }
}

run()