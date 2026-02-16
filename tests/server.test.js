const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../server/index');
const db = require('../server/db');

let server;
let BASE;

// Spin up the server on a random port before tests
before(() => {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      BASE = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  return new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  db.clear(); // clean slate per test
});

// ── helpers ─────────────────────────────────────────────
function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname };
    const headers = {};
    let payload;
    if (body) {
      payload = JSON.stringify(body);
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(payload);
    }
    opts.headers = headers;

    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

// ── tests ───────────────────────────────────────────────

describe('Health', () => {
  it('GET /health returns ok', async () => {
    const { status, body } = await req('GET', '/health');
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.bookmarks, 0);
  });
});

describe('POST /api/bookmarks', () => {
  it('captures a bookmark', async () => {
    const { status, body } = await req('POST', '/api/bookmarks', {
      url: 'https://www.instagram.com/p/ABC123/',
      postId: 'ABC123',
      caption: 'Hello world',
      authorUsername: 'testuser',
      mediaUrls: ['https://scontent.cdninstagram.com/v/photo.jpg'],
      mediaType: 'image',
      timestamp: '2026-02-10T12:00:00Z',
    });
    assert.equal(status, 201);
    assert.ok(body.bookmark.id);
    assert.equal(body.bookmark.url, 'https://www.instagram.com/p/ABC123/');
    assert.equal(body.bookmark.caption, 'Hello world');
    assert.equal(body.bookmark.authorUsername, 'testuser');
    assert.deepEqual(body.bookmark.mediaUrls, ['https://scontent.cdninstagram.com/v/photo.jpg']);
    assert.ok(body.bookmark.capturedAt);
  });

  it('rejects missing url', async () => {
    const { status } = await req('POST', '/api/bookmarks', { caption: 'no url' });
    assert.equal(status, 400);
  });

  it('rejects duplicate url', async () => {
    await req('POST', '/api/bookmarks', { url: 'https://instagram.com/p/DUP/' });
    const { status, body } = await req('POST', '/api/bookmarks', { url: 'https://instagram.com/p/DUP/' });
    assert.equal(status, 409);
    assert.equal(body.error, 'already captured');
  });
});

describe('GET /api/bookmarks', () => {
  it('returns empty list initially', async () => {
    const { body } = await req('GET', '/api/bookmarks');
    assert.deepEqual(body.bookmarks, []);
  });

  it('returns captured bookmarks newest-first', async () => {
    await req('POST', '/api/bookmarks', { url: 'https://instagram.com/p/A/' });
    await req('POST', '/api/bookmarks', { url: 'https://instagram.com/p/B/' });
    const { body } = await req('GET', '/api/bookmarks');
    assert.equal(body.bookmarks.length, 2);
    assert.equal(body.bookmarks[0].url, 'https://instagram.com/p/B/');
  });
});

describe('GET /api/bookmarks/:id', () => {
  it('returns a single bookmark', async () => {
    const { body: created } = await req('POST', '/api/bookmarks', { url: 'https://instagram.com/p/X/' });
    const { status, body } = await req('GET', `/api/bookmarks/${created.bookmark.id}`);
    assert.equal(status, 200);
    assert.equal(body.bookmark.url, 'https://instagram.com/p/X/');
  });

  it('404 for unknown id', async () => {
    const { status } = await req('GET', '/api/bookmarks/nonexistent');
    assert.equal(status, 404);
  });
});

describe('DELETE /api/bookmarks/:id', () => {
  it('removes a bookmark', async () => {
    const { body: created } = await req('POST', '/api/bookmarks', { url: 'https://instagram.com/p/DEL/' });
    const { status } = await req('DELETE', `/api/bookmarks/${created.bookmark.id}`);
    assert.equal(status, 200);
    // verify gone
    const { body: all } = await req('GET', '/api/bookmarks');
    assert.equal(all.bookmarks.length, 0);
  });
});
