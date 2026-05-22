-- Seed minimal data for AI allowedSkills derivation
-- Inserts:
-- 1) Job with skills ["node","typescript"]
-- 2) JobApplication for user test_otp@example.com

BEGIN;

-- Fixed timestamps to keep reruns stable
-- Note: Postgres requires createdAt/updatedAt for NOT NULL columns.
-- (We use NOW() for simplicity but you can pin to a fixed value if needed.)
DO $$
DECLARE
  ts TIMESTAMP := NOW();
BEGIN
  -- Insert Job
  INSERT INTO public."Job" ("id","title","company","location","description","status","skills","createdAt","updatedAt")
  VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Software Engineer',
    'Acme',
    'Lagos',
    'Build backend services',
    'ACTIVE',
    ARRAY['node','typescript']::text[],
    ts,
    ts
  )
  ON CONFLICT ("id") DO NOTHING;

  -- Insert JobApplication
  -- user id from JWT sub = 2659d952-b4d8-4a85-ae8c-cc7a20f05cb6
  INSERT INTO public."JobApplication" ("id","userId","jobId","coverLetter","createdAt","updatedAt")
  VALUES (
    '22222222-2222-2222-2222-222222222222',
    '2659d952-b4d8-4a85-ae8c-cc7a20f05cb6',
    '11111111-1111-1111-1111-111111111111',
    'Hi! I am interested in this role.',
    ts,
    ts
  )
  ON CONFLICT ("id") DO NOTHING;

END $$;

COMMIT;
