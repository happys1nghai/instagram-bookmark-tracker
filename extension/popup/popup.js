/**
 * Instagram Bookmark Tracker - Popup Script
 * Handles UI interactions and coordinates with background + content scripts
 */

// ── DOM Elements ───────────────────────────────────────────────

const saveBtn = document.getElementById('save-btn');
const refreshBtn = document.getElementById('refresh-btn');
const postStatus = document.getElementById('post-status');
const bookmarksList = document.getElementById('bookmarks-list');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const totalCount = document.getElementById('total-count');
const serverStatus = document.getElementById('server-status');
const toast = document.getElementById('toast');

// ── State ─────────────────────────────────────────────────────

let currentPostData = null;
let isServerHealthy = false;

// ── Utility Functions ──────────────────────────────────────────

function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function truncate(text, maxLength = 100) {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

// ── UI Updates ─────────────────────────────────────────────────

function updateServerStatus(healthy) {
  isServerHealthy = healthy;
  serverStatus.className = `status-indicator ${healthy ? 'online' : 'offline'}`;
  serverStatus.title = healthy ? 'Server connected' : 'Server offline';
}

function updatePostStatus(data) {
  currentPostData = data;
  
  if (data.error) {
    postStatus.innerHTML = `
      <div class="post-info">
        <p class="error-text">${data.error}</p>
      </div>
    `;
    saveBtn.disabled = true;
    saveBtn.textContent = '💾 Save Post';
  } else {
    postStatus.innerHTML = `
      <div class="post-info">
        <div class="post-author">
          <strong>${data.authorHandle || 'Unknown'}</strong>
          ${data.mediaType ? `<span class="badge">${data.mediaType}</span>` : ''}
        </div>
        <p class="post-caption">${truncate(data.caption, 120) || 'No caption'}</p>
        <p class="post-meta">${data.mediaUrls?.length || 0} media items</p>
      </div>
    `;
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Save Post';
  }
}

function renderBookmarkItem(bookmark) {
  const li = document.createElement('li');
  li.className = 'bookmark-item';
  li.dataset.id = bookmark.id;
  
  const mediaPreview = bookmark.media_urls?.[0] 
    ? `<img src="${bookmark.media_urls[0]}" alt="" class="bookmark-thumb" loading="lazy">`
    : `<div class="bookmark-thumb-placeholder">📷</div>`;

  li.innerHTML = `
    <a href="${bookmark.url}" target="_blank" class="bookmark-link">
      ${mediaPreview}
      <div class="bookmark-content">
        <div class="bookmark-header">
          <span class="bookmark-author">${bookmark.author_handle || 'Unknown'}</span>
          <span class="bookmark-type">${bookmark.media_type || 'post'}</span>
        </div>
        <p class="bookmark-caption">${truncate(bookmark.caption, 80) || 'No caption'}</p>
        <span class="bookmark-date">${formatDate(bookmark.saved_at)}</span>
      </div>
    </a>
    <button class="delete-btn" data-id="${bookmark.id}" title="Delete bookmark">🗑️</button>
  `;

  // Delete handler
  const deleteBtn = li.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteBookmark(bookmark.id);
  });

  return li;
}

function updateBookmarksList(bookmarks, total) {
  bookmarksList.innerHTML = '';
  
  if (!bookmarks || bookmarks.length === 0) {
    emptyState.classList.remove('hidden');
    totalCount.textContent = '0 bookmarks';
    return;
  }

  emptyState.classList.add('hidden');
  
  bookmarks.forEach(bookmark => {
    bookmarksList.appendChild(renderBookmarkItem(bookmark));
  });

  totalCount.textContent = `${total} bookmark${total !== 1 ? 's' : ''}`;
}

// ── API Actions ────────────────────────────────────────────────

async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.url?.includes('instagram.com')) {
      updatePostStatus({ error: 'Not on Instagram' });
      return;
    }

    // Ping content script to check if we're on a post page
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
    
    if (!response?.isPostPage) {
      updatePostStatus({ error: 'Navigate to a post or reel' });
      return;
    }

    // Extract post data
    const data = await chrome.tabs.sendMessage(tab.id, { action: 'extractPost' });
    updatePostStatus(data);
  } catch (error) {
    console.error('Failed to check current tab:', error);
    updatePostStatus({ error: 'Cannot access Instagram page. Refresh and try again.' });
  }
}

async function loadBookmarks() {
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  bookmarksList.innerHTML = '';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getBookmarks' });
    
    if (response.success) {
      updateBookmarksList(response.data, response.total);
    } else {
      showToast('Failed to load bookmarks', 'error');
      emptyState.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Failed to load bookmarks:', error);
    showToast('Failed to load bookmarks', 'error');
    emptyState.classList.remove('hidden');
  } finally {
    loadingState.classList.add('hidden');
  }
}

async function saveCurrentBookmark() {
  if (!currentPostData || currentPostData.error) return;

  saveBtn.disabled = true;
  saveBtn.textContent = '⏳ Saving...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveBookmark',
      data: currentPostData
    });

    if (response.success) {
      showToast('Bookmark saved!', 'success');
      await loadBookmarks();
    } else if (response.conflict) {
      showToast('Already bookmarked', 'info');
    } else {
      showToast(response.error || 'Failed to save', 'error');
    }
  } catch (error) {
    console.error('Failed to save bookmark:', error);
    showToast('Failed to save bookmark', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Save Post';
  }
}

async function deleteBookmark(id) {
  const item = document.querySelector(`li[data-id="${id}"]`);
  if (item) {
    item.style.opacity = '0.5';
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'deleteBookmark',
      id: id
    });

    if (response.success) {
      showToast('Bookmark deleted', 'success');
      await loadBookmarks();
    } else {
      showToast(response.error || 'Failed to delete', 'error');
      if (item) item.style.opacity = '1';
    }
  } catch (error) {
    console.error('Failed to delete bookmark:', error);
    showToast('Failed to delete bookmark', 'error');
    if (item) item.style.opacity = '1';
  }
}

async function checkHealth() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'checkHealth' });
    updateServerStatus(response.success && response.healthy);
  } catch {
    updateServerStatus(false);
  }
}

// ── Event Listeners ────────────────────────────────────────────

saveBtn.addEventListener('click', saveCurrentBookmark);

refreshBtn.addEventListener('click', () => {
  refreshBtn.classList.add('spinning');
  loadBookmarks().then(() => {
    setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
  });
});

// ── Initialization ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await checkHealth();
  await checkCurrentTab();
  await loadBookmarks();
});