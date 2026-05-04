const folderList = document.getElementById('folderList');
const cards = document.getElementById('bookmarkCards');
const currentFolderName = document.getElementById('currentFolderName');
const currentFolderSubtitle = document.getElementById('currentFolderSubtitle');
const searchInput = document.getElementById('searchInput');
const statusBar = document.getElementById('statusBar');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const viewModeToggleBtn = document.getElementById('viewModeToggleBtn');
const pathDepthLabel = document.getElementById('pathDepthLabel');

const THEME_KEY = 'ultimate-bookmark-theme';
const VIEW_MODE_KEY = 'ultimate-bookmark-view-mode';

const state = {
  loading: true,
  error: '',
  activeFolderId: 'all',
  query: '',
  folderTree: [],
  folderMap: new Map(),
  allBookmarks: [],
  expandedFolders: new Set(),
  activePath: [],
  viewMode: localStorage.getItem(VIEW_MODE_KEY) || 'grid',
};

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getFaviconUrl(url) {
  try {
    const domain = new URL(url).origin;
    return `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(domain)}`;
  } catch {
    return '';
  }
}

function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  if (themeToggleBtn) {
    themeToggleBtn.checked = theme === 'dark';
  }
}

function promptRename(currentName, label) {
  const nextName = window.prompt(`Rename ${label}`, currentName);
  if (nextName === null) return null;
  const trimmed = nextName.trim();
  return trimmed ? trimmed : null;
}

function refreshBookmarks() {
  loadBookmarks();
}

function renameBookmark(id, currentName) {
  const nextName = promptRename(currentName, 'bookmark');
  if (!nextName || !chrome?.bookmarks?.update) return;
  chrome.bookmarks.update(id, { title: nextName }, () => {
    const error = chrome.runtime?.lastError?.message;
    statusBar.textContent = error || `Renamed bookmark to “${nextName}”.`;
    refreshBookmarks();
  });
}

function renameFolder(id, currentName) {
  const nextName = promptRename(currentName, 'folder');
  if (!nextName || !chrome?.bookmarks?.update) return;
  chrome.bookmarks.update(id, { title: nextName }, () => {
    const error = chrome.runtime?.lastError?.message;
    statusBar.textContent = error || `Renamed folder to “${nextName}”.`;
    refreshBookmarks();
  });
}

const GRID_ICON = 'assets/icons/grid.png';
const LIST_ICON = 'assets/icons/list.png';

function applyViewMode(mode) {
  state.viewMode = mode;
  document.body.dataset.layout = mode;
  localStorage.setItem(VIEW_MODE_KEY, mode);
  if (viewModeToggleBtn) {
    viewModeToggleBtn.innerHTML = `<img src="${mode === 'grid' ? GRID_ICON : LIST_ICON}" alt="" />`;
    viewModeToggleBtn.setAttribute('aria-label', mode === 'grid' ? 'Switch to list view' : 'Switch to grid view');
    viewModeToggleBtn.title = mode === 'grid' ? 'Switch to list view' : 'Switch to grid view';
  }
}

function renderPermissionHelp() {
  currentFolderName.textContent = 'Permission required';
  currentFolderSubtitle.textContent = 'Open this page as a browser extension page to access your bookmarks.';
  statusBar.innerHTML = `
    <div><strong>Bookmark access unavailable.</strong> This page must be opened from the extension icon.</div>
    <div style="margin-top: 8px;">Please install or reload the unpacked extension, then click the toolbar icon. If permission is disabled, open the extension details and ensure <code>Bookmarks</code> is allowed.</div>
  `;
  cards.innerHTML = `
    <div class="empty">
      <div style="font-size: 18px; color: var(--text); margin-bottom: 10px;">No extension context detected</div>
      <div>Do not open <code>index.html</code> directly. Load the folder as an unpacked extension and launch it from the browser toolbar.</div>
    </div>
  `;
  folderList.innerHTML = `
    <div class="folder-item active">
      <span class="folder-icon"><img src="assets/icons/folder.png" alt="" /></span>
      <span class="folder-name">Extension mode</span>
      <span class="folder-count">0</span>
    </div>
  `;
}

function getVisibleBookmarks() {
  const query = state.query.trim().toLowerCase();
  const activeFolder = state.activeFolderId === 'all' ? null : state.folderMap.get(state.activeFolderId);
  return state.allBookmarks.filter(bookmark => {
    const folderMatch = state.activeFolderId === 'all' || bookmark.folderPath === activeFolder?.path;
    const searchMatch = !query || [bookmark.title, bookmark.url, bookmark.domain, bookmark.folderPath]
      .some(value => String(value).toLowerCase().includes(query));
    return folderMatch && searchMatch;
  });
}

function renderFolderNodes(nodes, parentPath = [], depth = 0) {
  return nodes.map(node => {
    const isActive = node.id === state.activeFolderId;
    const pathParts = [...parentPath, node.title];
    const pathIsActive = state.activePath.join(' / ') === pathParts.join(' / ');
    const isExpanded = state.expandedFolders.has(node.id);
    const hasChildren = node.children?.length > 0;
    const toggle = hasChildren
      ? `<button class="folder-toggle" data-toggle-id="${node.id}" aria-label="${isExpanded ? 'Collapse' : 'Expand'} folder">${isExpanded ? '−' : '+'}</button>`
      : '<span class="folder-toggle-spacer"></span>';
    const childMarkup = hasChildren && isExpanded ? `<div class="folder-children ${isExpanded ? 'expanded' : ''}">${renderFolderNodes(node.children, pathParts, depth + 1)}</div>` : '';
    return `
      <div class="folder-node ${pathIsActive ? 'folder-path-active' : ''}">
        <div class="folder-item ${isActive ? 'active' : ''}" data-folder-id="${node.id}" style="padding-left: ${16 + depth * 12}px;">
          ${toggle}
          <span class="folder-icon"><img src="assets/icons/folder.png" alt="" /></span>
          <span class="folder-name">${escapeHtml(node.title)}</span>
          <span class="folder-count">${node.count}</span>
        </div>
        ${childMarkup}
      </div>
    `;
  }).join('');
}

function renderFolders() {
  const treeMarkup = renderFolderNodes(state.folderTree);
  folderList.innerHTML = state.loading
    ? '<div class="folder-item active"><span class="folder-icon">📁</span><span class="folder-name">Loading…</span><span class="folder-count">0</span></div>'
    : `
      <div class="folder-item ${state.activeFolderId === 'all' ? 'active' : ''}" data-folder-id="all">
        <span class="folder-icon">⭐</span>
        <span class="folder-name">All Bookmarks</span>
        <span class="folder-count">${state.allBookmarks.length}</span>
      </div>
      ${treeMarkup}
    `;

  folderList.querySelectorAll('.folder-item[data-folder-id]').forEach(item => {
    item.addEventListener('click', () => {
      const folderId = item.dataset.folderId;
      state.activeFolderId = folderId;
      if (folderId !== 'all') {
        if (state.expandedFolders.has(folderId)) {
          state.expandedFolders.delete(folderId);
        } else {
          state.expandedFolders.add(folderId);
        }
      }
      updateActivePath();
      render();
    });
  });

  folderList.querySelectorAll('.folder-toggle[data-toggle-id]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const folderId = button.dataset.toggleId;
      if (state.expandedFolders.has(folderId)) state.expandedFolders.delete(folderId);
      else state.expandedFolders.add(folderId);
      renderFolders();
    });
  });
}

function updateActivePath() {
  if (state.activeFolderId === 'all') {
    state.activePath = [];
    pathDepthLabel.textContent = '0 levels';
    return;
  }
  const folder = state.folderMap.get(state.activeFolderId);
  if (!folder) {
    state.activePath = [];
    pathDepthLabel.textContent = '0 levels';
    return;
  }
  state.activePath = folder.path.split(' / ');
  pathDepthLabel.textContent = `${state.activePath.length} level${state.activePath.length === 1 ? '' : 's'}`;
}

function renderCards() {
  if (state.loading) {
    currentFolderName.textContent = 'Loading bookmarks…';
    currentFolderSubtitle.textContent = 'Reading your browser bookmark tree.';
    cards.innerHTML = '<div class="empty">Loading bookmarks from your browser…</div>';
    return;
  }

  if (state.error) {
    currentFolderName.textContent = 'Bookmark access unavailable';
    currentFolderSubtitle.textContent = 'The extension needs bookmark permission to read your data.';
    cards.innerHTML = `<div class="empty">${escapeHtml(state.error)}</div>`;
    return;
  }

  const visible = getVisibleBookmarks();
  const activeFolder = state.activeFolderId === 'all' ? { title: 'All Bookmarks' } : state.folderMap.get(state.activeFolderId);
  currentFolderName.textContent = activeFolder?.title || 'All Bookmarks';
  currentFolderSubtitle.textContent = `${visible.length} bookmark${visible.length === 1 ? '' : 's'} in this view. Click a card to open the site.`;

  cards.innerHTML = visible.length ? visible.map(item => {
    const favicon = getFaviconUrl(item.url);
    return `
      <article class="card" data-url="${escapeHtml(item.url)}" data-bookmark-id="${escapeHtml(item.id)}" data-bookmark-title="${escapeHtml(item.title)}">
        <div class="card-logo-shell">
          <img class="card-logo" src="${escapeHtml(favicon)}" alt="${escapeHtml(item.domain)} logo" loading="lazy" />
        </div>
        <div>
          <h3 title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer" title="${escapeHtml(item.domain)}">${escapeHtml(item.domain)}</a>
        </div>
      </article>
    `;
  }).join('') : '<div class="empty">No bookmarks found in this directory.</div>';
}

function render() {
  renderFolders();
  renderCards();
}

function loadBookmarks() {
  state.loading = true;
  statusBar.textContent = 'Connecting to the browser bookmarks API…';
  render();

  if (!globalThis.chrome?.bookmarks?.getTree) {
    state.loading = false;
    state.error = 'Bookmark API is unavailable. This page must be opened from the installed extension, not as a normal HTML file.';
    statusBar.textContent = state.error;
    renderPermissionHelp();
    return;
  }

  chrome.bookmarks.getTree(tree => {
    const runtimeError = chrome.runtime?.lastError?.message;
    if (runtimeError) {
      state.loading = false;
      state.error = runtimeError;
      statusBar.textContent = runtimeError;
      render();
      return;
    }

    try {
      const rootChildren = tree?.[0]?.children ?? [];
      const folderMap = new Map();
      const allBookmarks = [];
      state.folderTree = [];

      function buildFolderNode(node, trail = []) {
        const title = node.title?.trim() || 'Untitled Folder';
        const nextTrail = node.id === '0' ? trail : [...trail, title];
        const folderNode = {
          id: node.id,
          title,
          path: nextTrail.join(' / '),
          depth: trail.length,
          count: 0,
          children: [],
        };

        if (node.id !== '0') folderMap.set(node.id, folderNode);

        for (const child of node.children || []) {
          if (Array.isArray(child.children)) {
            folderNode.children.push(buildFolderNode(child, nextTrail));
          } else if (child.url) {
            const folderPath = nextTrail.length ? nextTrail.join(' / ') : 'Bookmarks bar';
            allBookmarks.push({
              id: child.id,
              title: child.title?.trim() || 'Untitled',
              url: child.url,
              folderPath,
              domain: getDomain(child.url),
            });
          }
        }

        return folderNode;
      }

      rootChildren.forEach(child => {
        if (Array.isArray(child.children)) {
          state.folderTree.push(buildFolderNode(child));
        } else if (child.url) {
          allBookmarks.push({
            id: child.id,
            title: child.title?.trim() || 'Untitled',
            url: child.url,
            folderPath: 'Bookmarks bar',
            domain: getDomain(child.url),
          });
        }
      });

      const countByFolderPath = new Map();
      for (const bookmark of allBookmarks) {
        countByFolderPath.set(bookmark.folderPath, (countByFolderPath.get(bookmark.folderPath) || 0) + 1);
      }

      function applyCounts(nodes) {
        for (const node of nodes) {
          node.count = countByFolderPath.get(node.path) || 0;
          if (node.children?.length) applyCounts(node.children);
        }
      }

      applyCounts(state.folderTree);
      state.folderMap = folderMap;
      state.allBookmarks = allBookmarks;
      state.loading = false;
      state.error = '';
      state.activeFolderId = 'all';
      updateActivePath();
      statusBar.textContent = `Loaded ${allBookmarks.length} bookmark${allBookmarks.length === 1 ? '' : 's'} from ${folderMap.size} folder${folderMap.size === 1 ? '' : 's'}.`;
      render();
    } catch (error) {
      state.loading = false;
      state.error = error?.message || 'Unable to load browser bookmarks.';
      statusBar.textContent = state.error;
      render();
    }
  });
}

searchInput.addEventListener('input', event => {
  state.query = event.target.value;
  renderCards();
});

function hideContextMenu() {
  document.getElementById('contextMenu')?.remove();
}

function showContextMenu(event, config) {
  hideContextMenu();
  const menu = document.createElement('div');
  menu.id = 'contextMenu';
  menu.className = 'context-menu';
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  menu.innerHTML = `
    <button type="button" data-menu-action="rename">
      <img src="assets/icons/edit.png" alt="" />
      <span>Rename</span>
    </button>
  `;
  document.body.appendChild(menu);
  menu.querySelector('[data-menu-action="rename"]')?.addEventListener('click', clickEvent => {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();
    hideContextMenu();
    config.onRename();
  });

  const rect = menu.getBoundingClientRect();
  const left = Math.min(event.clientX, window.innerWidth - rect.width - 12);
  const top = Math.min(event.clientY, window.innerHeight - rect.height - 12);
  menu.style.left = `${Math.max(12, left)}px`;
  menu.style.top = `${Math.max(12, top)}px`;
}

document.addEventListener('contextmenu', event => {
  const folderItem = event.target.closest?.('.folder-item[data-folder-id]:not([data-folder-id="all"])');
  if (folderItem) {
    event.preventDefault();
    event.stopPropagation();
    showContextMenu(event, {
      onRename: () => renameFolder(folderItem.dataset.folderId, folderItem.querySelector('.folder-name')?.textContent || 'Folder'),
    });
    return;
  }

  const card = event.target.closest?.('.card[data-bookmark-id]');
  if (card) {
    event.preventDefault();
    event.stopPropagation();
    showContextMenu(event, {
      onRename: () => renameBookmark(card.dataset.bookmarkId, card.dataset.bookmarkTitle || 'Bookmark'),
    });
  }
});

document.addEventListener('click', hideContextMenu);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') hideContextMenu();
});

themeToggleBtn?.addEventListener('change', event => applyTheme(event.target.checked ? 'dark' : 'light'));
viewModeToggleBtn?.addEventListener('click', () => applyViewMode(state.viewMode === 'grid' ? 'list' : 'grid'));

document.addEventListener('click', event => {
  const card = event.target.closest?.('.card[data-url]');
  if (card && !event.target.closest('a')) {
    const url = card.dataset.url;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
});

applyTheme(getTheme());
applyViewMode(state.viewMode);

if (globalThis.chrome?.runtime?.id) {
  render();
  loadBookmarks();
} else {
  state.loading = false;
  renderPermissionHelp();
}
