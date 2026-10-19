-- Full-text job search in Postgres (replaces the optional OpenSearch index).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- array_to_string is only STABLE; generated columns require IMMUTABLE expressions.
CREATE OR REPLACE FUNCTION job_skills_text(skills text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT coalesce(array_to_string(skills, ' '), '') $$;

ALTER TABLE "Job" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english'::regconfig, coalesce("title", '')), 'A') ||
  setweight(to_tsvector('simple'::regconfig, job_skills_text("skills")), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce("company", '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce("description", '')), 'C')
) STORED;

CREATE INDEX "Job_searchVector_idx" ON "Job" USING GIN ("searchVector");

-- Typo-tolerant title matching (`query <% title`).
CREATE INDEX "Job_title_trgm_idx" ON "Job" USING GIN ("title" gin_trgm_ops);
