/**
 * Instagram Bookmark Tracker - Content Script
 * Extracts post data from Instagram pages
 */

(function() {
  'use strict';

  // ── Extraction Helpers ─────────────────────────────────────────

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

  // ── DOM Extraction ─────────────────────────────────────────────

  function isPostPage() {
    const path = window.location.pathname;
    return path.includes('/p/') || path.includes('/reel/');
  }

  function getMediaType() {
    const path = window.location.pathname;
    if (path.includes('/reel/')) return 'reel';
    
    // Check for video element
    const video = document.querySelector('video');
    if (video && video.duration > 0) return 'video';
    
    // Check for multiple images (carousel)
    const images = document.querySelectorAll('article img, [role="dialog"] img');
    if (images.length > 2) return 'carousel';
    
    return 'image';
  }

  function extractAuthorInfo() {
    // Try multiple selectors for author info
    const selectors = [
      'article header a[href^="/"]',
      'article a[role="link"]',
      '[role="dialog"] header a[href^="/"]',
      'a[href^="/"][title]',
      'article h2 a',
      'a.notranslate'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const href = el.getAttribute('href') || '';
        const handle = href.replace(/^\//, '').replace(/\/$/, '').split('/')[0];
        if (handle && handle !== 'p' && handle !== 'reel' && !handle.includes('/')) {
          const name = el.textContent?.trim() || handle;
          return { name, handle: formatHandle(handle) };
        }
      }
    }

    // Fallback: look for meta tags
    const metaAuthor = document.querySelector('meta[property="og:title"]');
    if (metaAuthor) {
      const content = metaAuthor.getAttribute('content') || '';
      const match = content.match(/^([^@]+)\s*\(@([^)]+)\)/);
      if (match) {
        return { name: match[1].trim(), handle: formatHandle(match[2]) };
      }
    }

    return { name: '', handle: '' };
  }

  function extractCaption() {
    // Try multiple selectors for caption
    const selectors = [
      'article h1',
      'article ul li span[dir="auto"]',
      '[role="dialog"] ul li span[dir="auto"]',
      'article div[class] span[dir="auto"]',
      'meta[property="og:description"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        if (selector.includes('meta')) {
          const content = el.getAttribute('content') || '';
          if (content && !content.includes('Instagram')) return truncCaption(content);
        } else {
          const text = el.textContent?.trim();
          if (text && text.length > 5) return truncCaption(text);
        }
      }
    }

    // Look for the first meaningful paragraph
    const paragraphs = document.querySelectorAll('article p, [role="dialog"] p');
    for (const p of paragraphs) {
      const text = p.textContent?.trim();
      if (text && text.length > 5) return truncCaption(text);
    }

    return '';
  }

  function extractMediaUrls() {
    const urls = [];
    
    // Get images
    const imgSelectors = [
      'article img[srcset]',
      'article img[src]',
      '[role="dialog"] img[srcset]',
      '[role="dialog"] img[src]',
      'img[src*="instagram.com"]'
    ];

    for (const selector of imgSelectors) {
      const images = document.querySelectorAll(selector);
      for (const img of images) {
        // Get highest quality from srcset
        const srcset = img.getAttribute('srcset');
        if (srcset) {
          const candidates = srcset.split(',').map(s => {
            const [url, width] = s.trim().split(' ');
            return { url: url.split('?')[0], width: parseInt(width) || 0 };
          });
          candidates.sort((a, b) => b.width - a.width);
          if (candidates[0]?.url) urls.push(candidates[0].url);
        } else {
          const src = img.getAttribute('src');
          if (src && !src.includes('data:')) urls.push(src.split('?')[0]);
        }
      }
    }

    // Get video URLs
    const videos = document.querySelectorAll('video[src], video source[src]');
    for (const video of videos) {
      const src = video.getAttribute('src');
      if (src) urls.push(src.split('?')[0]);
    }

    return dedupeUrls(filterProfileImages(urls));
  }

  function getPostTimestamp() {
    // Look for time element
    const timeEl = document.querySelector('time[datetime]');
    if (timeEl) {
      return timeEl.getAttribute('datetime');
    }
    return new Date().toISOString();
  }

  // ── Main Extraction Function ───────────────────────────────────

  function extractPostData() {
    if (!isPostPage()) {
      return { error: 'Not on an Instagram post or reel page' };
    }

    const url = window.location.href.split('?')[0];
    const postId = extractPostId(url);
    
    if (!postId) {
      return { error: 'Could not extract post ID from URL' };
    }

    const author = extractAuthorInfo();
    const caption = extractCaption();
    const mediaUrls = extractMediaUrls();
    const mediaType = getMediaType();
    const timestamp = getPostTimestamp();

    return {
      url,
      platform: 'instagram',
      postId,
      caption,
      authorName: author.name,
      authorHandle: author.handle,
      mediaUrls,
      mediaType,
      timestamp,
      userId: 'default'
    };
  }

  // ── Message Handler ────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractPost') {
      const data = extractPostData();
      sendResponse(data);
    } else if (request.action === 'ping') {
      sendResponse({ ok: true, isPostPage: isPostPage() });
    }
    return true; // Keep channel open for async
  });

  // Log initialization
  console.log('[IG Bookmark] Content script loaded');
})();