/**
 * Instagram Bookmark Tracker - Background Service Worker
 * Handles API calls to the backend server
 */

const API_BASE_URL = 'http://localhost:3000/api/v1';

// ── API Functions ──────────────────────────────────────────────

async function fetchBookmarks(userId = 'default') {
  try {
    const response = await fetch(`${API_BASE_URL}/bookmarks?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return { success: true, data: data.data, total: data.total };
  } catch (error) {
    console.error('[IG Bookmark] Failed to fetch bookmarks:', error);
    return { success: false, error: error.message };
  }
}

async function createBookmark(bookmarkData) {
  try {
    const response = await fetch(`${API_BASE_URL}/bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookmarkData),
    });

    if (response.status === 409) {
      const data = await response.json();
      return { success: false, conflict: true, error: data.error, data: data.data };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data: data.data };
  } catch (error) {
    console.error('[IG Bookmark] Failed to create bookmark:', error);
    return { success: false, error: error.message };
  }
}

async function deleteBookmark(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/bookmarks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { success: true };
  } catch (error) {
    console.error('[IG Bookmark] Failed to delete bookmark:', error);
    return { success: false, error: error.message };
  }
}

async function checkServerHealth() {
  try {
    const response = await fetch('http://localhost:3000/health', {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ── Message Handler ────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleAsync = async () => {
    switch (request.action) {
      case 'getBookmarks':
        return await fetchBookmarks(request.userId);
      
      case 'saveBookmark':
        return await createBookmark(request.data);
      
      case 'deleteBookmark':
        return await deleteBookmark(request.id);
      
      case 'checkHealth':
        const isHealthy = await checkServerHealth();
        return { success: true, healthy: isHealthy };
      
      default:
        return { success: false, error: 'Unknown action' };
    }
  };

  handleAsync().then(sendResponse);
  return true; // Keep channel open for async response
});

// ── Extension Install/Update ───────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('[IG Bookmark] Extension installed/updated');
});

console.log('[IG Bookmark] Background service worker started');