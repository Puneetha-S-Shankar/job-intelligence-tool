-- Program-level job mappings: program_id '' = school-only tag (SERP / legacy).
-- Unique (job_id, school_code, program_id) allows multiple programmes per job per school.

ALTER TABLE job_course_mappings
  ADD COLUMN IF NOT EXISTS program_id text NOT NULL DEFAULT '';

UPDATE job_course_mappings SET program_id = '' WHERE program_id IS NULL;

ALTER TABLE job_course_mappings
  ALTER COLUMN program_id SET DEFAULT '';

ALTER TABLE job_course_mappings DROP CONSTRAINT IF EXISTS job_course_mappings_job_id_school_code_key;

ALTER TABLE job_course_mappings
  ADD CONSTRAINT job_course_mappings_job_school_program_key UNIQUE (job_id, school_code, program_id);
