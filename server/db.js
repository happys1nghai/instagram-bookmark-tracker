// Database layer — better-sqlite3 + simple schema
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'bookmarks.db');

let _db;
function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    migrate(_db);
  }
  return _db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      url         TEXT    NOT NULL,
      platform    TEXT    NOT NULL DEFAULT 'instagram',
      post_id     TEXT,
      caption     TEXT,
      author_name TEXT,
      author_handle TEXT,
      media_urls  TEXT,          -- JSON array
      media_type  TEXT,          -- image | video | carousel | reel
      timestamp   TEXT,          -- original post timestamp (ISO)
      saved_at    TEXT NOT NULL DEFAULT (datetime('now')),
      user_id     TEXT NOT NULL DEFAULT 'default',
      UNIQUE(url, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_saved ON bookmarks(saved_at);
  `);
}

// ── CRUD helpers ────────────────────────────────────────────────

function insertBookmark(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO bookmarks (url, platform, post_id, caption, author_name,
                           author_handle, media_urls, media_type, timestamp, user_id)
    VALUES (@url, @platform, @postId, @caption, @authorName,
            @authorHandle, @mediaUrls, @mediaType, @timestamp, @userId)
  `);
  const info = stmt.run({
    url: data.url,
    platform: data.platform || 'instagram',
    postId: data.postId || null,
    caption: data.caption || null,
    authorName: data.authorName || null,
    authorHandle: data.authorHandle || null,
    mediaUrls: Array.isArray(data.mediaUrls) ? JSON.stringify(data.mediaUrls) : (data.mediaUrls || null),
    mediaType: data.mediaType || null,
    timestamp: data.timestamp || null,
    userId: data.userId || 'default',
  });
  return getBookmarkById(info.lastInsertRowid);
}

function getBookmarkById(id) {
  return getDb().prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
}

function listBookmarks({ userId = 'default', limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM bookmarks WHERE user_id = ? ORDER BY saved_at DESC LIMIT ? OFFSET ?'
  ).all(userId, limit, offset);
  const { total } = db.prepare(
    'SELECT COUNT(*) as total FROM bookmarks WHERE user_id = ?'
  ).get(userId);
  return { rows, total };
}

function deleteBookmark(id) {
  return getDb().prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
}

function findByUrl(url, userId = 'default') {
  return getDb().prepare('SELECT * FROM bookmarks WHERE url = ? AND user_id = ?').get(url, userId);
}

function closeDb() {
  if (_db) { _db.close(); _db = null; }
}

module.exports = { getDb, insertBookmark, getBookmarkById, listBookmarks, deleteBookmark, findByUrl, closeDb };
