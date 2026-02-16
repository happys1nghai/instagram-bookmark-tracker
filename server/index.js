// Express API for Instagram Bookmark Capture
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── Health ──────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Create bookmark ─────────────────────────────────────────────
app.post('/api/v1/bookmarks', (req, res) => {
  const { url, platform, postId, caption, authorName, authorHandle,
          mediaUrls, mediaType, timestamp, userId } = req.body;

  if (!url) return res.status(400).json({ error: 'url is required' });
  if (!platform) return res.status(400).json({ error: 'platform is required' });

  // duplicate check
  const existing = db.findByUrl(url, userId || 'default');
  if (existing) return res.status(409).json({ error: 'Bookmark already exists', data: existing });

  try {
    const bookmark = db.insertBookmark({
      url, platform, postId, caption, authorName, authorHandle,
      mediaUrls, mediaType, timestamp, userId,
    });
    res.status(201).json({ data: bookmark });
  } catch (err) {
    console.error('POST /bookmarks error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── List bookmarks ──────────────────────────────────────────────
app.get('/api/v1/bookmarks', (req, res) => {
  const userId = req.query.userId || 'default';
  const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  const { rows, total } = db.listBookmarks({ userId, limit, offset });
  // parse media_urls JSON for each row
  const data = rows.map(r => ({
    ...r,
    media_urls: r.media_urls ? JSON.parse(r.media_urls) : [],
  }));
  res.json({ data, total, limit, offset });
});

// ── Get single bookmark ─────────────────────────────────────────
app.get('/api/v1/bookmarks/:id', (req, res) => {
  const row = db.getBookmarkById(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  row.media_urls = row.media_urls ? JSON.parse(row.media_urls) : [];
  res.json({ data: row });
});

// ── Delete bookmark ─────────────────────────────────────────────
app.delete('/api/v1/bookmarks/:id', (req, res) => {
  const info = db.deleteBookmark(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ── Start ───────────────────────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🚀 Bookmark API on http://localhost:${PORT}`));
}

module.exports = app;   // export for testing
