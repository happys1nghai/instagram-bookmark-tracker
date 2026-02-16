// Tests for the Express API endpoints
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', 'test-api.db');
process.env.DB_PATH = TEST_DB;

const app = require('../server/index');
const db  = require('../server/db');

let server, base;

function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, base);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: {} };
    if (body) {
      const payload = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function cleanup() {
  db.closeDb();
  try { fs.unlinkSync(TEST_DB); } catch {}
  try { fs.unlinkSync(TEST_DB + '-wal'); } catch {}
  try { fs.unlinkSync(TEST_DB + '-shm'); } catch {}
}

before(async () => {
  cleanup();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise(r => server.close(r));
  cleanup();
});

describe('API', () => {

  // ── Health ──────────────────────────────────────────────
  it('GET /health returns ok', async () => {
    const r = await req('GET', '/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ok');
  });

  // ── Create ─────────────────────────────────────────────
  it('POST /api/v1/bookmarks creates a bookmark', async () => {
    const r = await req('POST', '/api/v1/bookmarks', {
      url: 'https://www.instagram.com/p/TEST1/',
      platform: 'instagram',
      postId: 'TEST1',
      caption: 'Test caption ✨',
      authorName: 'Alice',
      authorHandle: '@alice',
      mediaUrls: ['https://cdn.instagram.com/img.jpg'],
      mediaType: 'image',
      timestamp: '2024-06-15T08:00:00Z',
    });
    assert.equal(r.status, 201);
    assert.ok(r.body.data.id);
    assert.equal(r.body.data.url, 'https://www.instagram.com/p/TEST1/');
    assert.equal(r.body.data.caption, 'Test caption ✨');
  });

  it('POST rejects missing url', async () => {
    const r = await req('POST', '/api/v1/bookmarks', { platform: 'instagram' });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /url/i);
  });

  it('POST rejects missing platform', async () => {
    const r = await req('POST', '/api/v1/bookmarks', { url: 'https://x.com' });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /platform/i);
  });

  it('POST returns 409 on duplicate', async () => {
    const r = await req('POST', '/api/v1/bookmarks', {
      url: 'https://www.instagram.com/p/TEST1/',
      platform: 'instagram',
    });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /already exists/i);
  });

  // ── List ───────────────────────────────────────────────
  it('GET /api/v1/bookmarks lists bookmarks', async () => {
    // add a second bookmark
    await req('POST', '/api/v1/bookmarks', {
      url: 'https://www.instagram.com/p/TEST2/',
      platform: 'instagram',
      postId: 'TEST2',
      caption: 'Second post',
    });
    const r = await req('GET', '/api/v1/bookmarks');
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 2);
    assert.equal(r.body.data.length, 2);
    // newest first
    assert.equal(r.body.data[0].post_id, 'TEST2');
  });

  // ── Get single ─────────────────────────────────────────
  it('GET /api/v1/bookmarks/:id returns single bookmark', async () => {
    const list = await req('GET', '/api/v1/bookmarks');
    const id = list.body.data[0].id;
    const r = await req('GET', `/api/v1/bookmarks/${id}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.data.id, id);
  });

  it('GET /api/v1/bookmarks/:id returns 404 for missing', async () => {
    const r = await req('GET', '/api/v1/bookmarks/99999');
    assert.equal(r.status, 404);
  });

  // ── Delete ─────────────────────────────────────────────
  it('DELETE /api/v1/bookmarks/:id removes bookmark', async () => {
    const list = await req('GET', '/api/v1/bookmarks');
    const id = list.body.data[0].id;
    const r = await req('DELETE', `/api/v1/bookmarks/${id}`);
    assert.equal(r.status, 200);
    assert.ok(r.body.ok);
    // verify gone
    const r2 = await req('GET', `/api/v1/bookmarks/${id}`);
    assert.equal(r2.status, 404);
  });

  it('DELETE /api/v1/bookmarks/:id returns 404 for missing', async () => {
    const r = await req('DELETE', '/api/v1/bookmarks/99999');
    assert.equal(r.status, 404);
  });
});
