// Tests for the database layer
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// Use a temp database for tests
const TEST_DB = path.join(__dirname, '..', 'test-bookmarks.db');
process.env.DB_PATH = TEST_DB;

const db = require('../server/db');

// cleanup helper
function cleanup() {
  db.closeDb();
  try { fs.unlinkSync(TEST_DB); } catch {}
  try { fs.unlinkSync(TEST_DB + '-wal'); } catch {}
  try { fs.unlinkSync(TEST_DB + '-shm'); } catch {}
}

before(() => cleanup());
after(() => cleanup());

describe('Database layer', () => {

  it('inserts a bookmark and returns it with an id', () => {
    const bm = db.insertBookmark({
      url: 'https://www.instagram.com/p/ABC123/',
      platform: 'instagram',
      postId: 'ABC123',
      caption: 'Beautiful sunset 🌅',
      authorName: 'Jane',
      authorHandle: '@jane',
      mediaUrls: ['https://instagram.com/img1.jpg'],
      mediaType: 'image',
      timestamp: '2024-06-01T12:00:00Z',
    });
    assert.ok(bm.id, 'should have an id');
    assert.equal(bm.url, 'https://www.instagram.com/p/ABC123/');
    assert.equal(bm.platform, 'instagram');
    assert.equal(bm.caption, 'Beautiful sunset 🌅');
    assert.equal(bm.author_handle, '@jane');
    assert.ok(bm.saved_at, 'should have saved_at timestamp');
  });

  it('rejects duplicate url+user', () => {
    assert.throws(() => {
      db.insertBookmark({
        url: 'https://www.instagram.com/p/ABC123/',
        platform: 'instagram',
      });
    }, /UNIQUE constraint/);
  });

  it('inserts a second bookmark for the same user', () => {
    const bm = db.insertBookmark({
      url: 'https://www.instagram.com/reel/XYZ789/',
      platform: 'instagram',
      postId: 'XYZ789',
      caption: 'Great reel!',
      mediaType: 'reel',
    });
    assert.ok(bm.id);
    assert.equal(bm.post_id, 'XYZ789');
  });

  it('lists bookmarks in reverse-chronological order', () => {
    const { rows, total } = db.listBookmarks({ userId: 'default', limit: 10 });
    assert.equal(total, 2);
    assert.equal(rows.length, 2);
    // newest first
    assert.equal(rows[0].post_id, 'XYZ789');
    assert.equal(rows[1].post_id, 'ABC123');
  });

  it('finds a bookmark by URL', () => {
    const found = db.findByUrl('https://www.instagram.com/p/ABC123/', 'default');
    assert.ok(found);
    assert.equal(found.post_id, 'ABC123');
  });

  it('returns undefined for unknown URL', () => {
    const found = db.findByUrl('https://nope.com', 'default');
    assert.equal(found, undefined);
  });

  it('deletes a bookmark', () => {
    const { rows } = db.listBookmarks();
    const id = rows[0].id;
    const info = db.deleteBookmark(id);
    assert.equal(info.changes, 1);
    assert.equal(db.getBookmarkById(id), undefined);
  });

  it('handles media_urls as JSON array', () => {
    const bm = db.insertBookmark({
      url: 'https://www.instagram.com/p/MULTI/',
      platform: 'instagram',
      mediaUrls: ['https://a.jpg', 'https://b.jpg', 'https://c.jpg'],
      mediaType: 'carousel',
    });
    const parsed = JSON.parse(bm.media_urls);
    assert.deepEqual(parsed, ['https://a.jpg', 'https://b.jpg', 'https://c.jpg']);
  });
});
