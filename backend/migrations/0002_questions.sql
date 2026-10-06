CREATE TABLE IF NOT EXISTS questions (
 id TEXT PRIMARY KEY NOT NULL,
 question TEXT NOT NULL,
 answer TEXT NOT NULL DEFAULT '',
 anonymous INTEGER NOT NULL CHECK(anonymous IN (0,1)),
 author_id TEXT,
 author_login TEXT,
 lookup_hash TEXT NOT NULL UNIQUE,
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 CHECK((anonymous=1 AND author_id IS NULL AND author_login IS NULL) OR (anonymous=0 AND author_id IS NOT NULL AND author_login IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_questions_public ON questions(created_at DESC,id DESC) WHERE published=1 AND archived=0;
CREATE INDEX IF NOT EXISTS idx_questions_admin ON questions(archived,created_at DESC);
CREATE TABLE IF NOT EXISTS question_limits (bucket TEXT PRIMARY KEY NOT NULL,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_question_limits_expiry ON question_limits(expires_at);
PRAGMA optimize;
