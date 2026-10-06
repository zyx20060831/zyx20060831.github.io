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
