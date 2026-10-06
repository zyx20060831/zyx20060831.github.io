CREATE TABLE IF NOT EXISTS access_requests (user_id TEXT PRIMARY KEY NOT NULL, login TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, login TEXT NOT NULL, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS oauth_states (state_hash TEXT PRIMARY KEY NOT NULL, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_oauth_expiry ON oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS moments (
 id TEXT PRIMARY KEY NOT NULL,
 body TEXT NOT NULL,
 images TEXT NOT NULL DEFAULT '[]',
 visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','approved')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_moments_public_feed ON moments(created_at DESC,id DESC) WHERE deleted_at IS NULL AND visibility='public';
CREATE INDEX IF NOT EXISTS idx_moments_visible_feed ON moments(created_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS moment_photos (
 id TEXT PRIMARY KEY NOT NULL,
 post_id TEXT NOT NULL REFERENCES moments(id),
 content_type TEXT NOT NULL,
 data BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_moment_photos_post ON moment_photos(post_id);
PRAGMA optimize;

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
