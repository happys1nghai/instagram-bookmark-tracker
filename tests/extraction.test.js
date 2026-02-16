// Tests for the extraction helpers used in the content script
// These are pure-function unit tests — no DOM needed.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ── Inline the extraction helpers so we can test them in Node ──
function extractPostId(url) {
  const m = url.match(/\/p\/([A-Za-z0-9_-]+)/) ||
            url.match(/\/reel\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function truncCaption(text, max = 2000) {
  return (text || '').slice(0, max);
}

function dedupeUrls(urls) {
  return [...new Set(urls)];
}

function filterProfileImages(urls) {
  return urls.filter(u =>
    !u.includes('/profile') &&
    !u.includes('/avatar') &&
    !u.includes('s150x150')
  );
}

function formatHandle(raw) {
  if (!raw) return '';
  return raw.startsWith('@') ? raw : '@' + raw;
}

// ── Tests ────────────────────────────────────────────────────

describe('extractPostId', () => {
  it('standard /p/ URL',         () => assert.equal(extractPostId('https://www.instagram.com/p/Cx7mK_2P0Zj/'), 'Cx7mK_2P0Zj'));
  it('/p/ URL with query',       () => assert.equal(extractPostId('https://www.instagram.com/p/ABC123/?utm=x'), 'ABC123'));
  it('/reel/ URL',               () => assert.equal(extractPostId('https://www.instagram.com/reel/DEF456/'), 'DEF456'));
  it('non-Instagram URL → null', () => assert.equal(extractPostId('https://google.com'), null));
  it('profile URL → null',       () => assert.equal(extractPostId('https://www.instagram.com/username/'), null));
  it('bare string → null',       () => assert.equal(extractPostId('not-a-url'), null));
});

describe('truncCaption', () => {
  it('short text passes through', () => assert.equal(truncCaption('hello'), 'hello'));
  it('null → empty string',       () => assert.equal(truncCaption(null), ''));
  it('long text is truncated',    () => {
    const long = 'A'.repeat(3000);
    assert.equal(truncCaption(long).length, 2000);
  });
  it('preserves emoji',           () => assert.equal(truncCaption('🌅 sunset'), '🌅 sunset'));
});

describe('dedupeUrls', () => {
  it('removes duplicates', () => {
    assert.deepEqual(
      dedupeUrls(['a.jpg', 'b.jpg', 'a.jpg']),
      ['a.jpg', 'b.jpg']
    );
  });
  it('empty array → empty',  () => assert.deepEqual(dedupeUrls([]), []));
});

describe('filterProfileImages', () => {
  it('removes profile & avatar URLs', () => {
    const urls = [
      'https://cdn.instagram.com/v/photo.jpg',
      'https://cdn.instagram.com/profile/pic.jpg',
      'https://cdn.instagram.com/avatar.jpg',
      'https://cdn.instagram.com/v/s150x150/thumb.jpg',
    ];
    const result = filterProfileImages(urls);
    assert.equal(result.length, 1);
    assert.equal(result[0], 'https://cdn.instagram.com/v/photo.jpg');
  });
});

describe('formatHandle', () => {
  it('adds @ when missing',   () => assert.equal(formatHandle('alice'), '@alice'));
  it('keeps @ when present',  () => assert.equal(formatHandle('@alice'), '@alice'));
  it('null → empty string',   () => assert.equal(formatHandle(null), ''));
  it('empty → empty string',  () => assert.equal(formatHandle(''), ''));
});
