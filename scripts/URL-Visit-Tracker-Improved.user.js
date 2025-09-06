// ==UserScript==
// @name         URL Visit Tracker (Improved)
// @namespace    https://github.com/hongmd/userscript-improved
// @version        2.4.2
// @description  Track visits per URL, show corner badge history & link hover info - Massive Capacity (10K URLs) - ES2020+ & Smooth Tooltips
// @author       hongmd
// @contributor  Original idea by Chewy
// @homepage     https://github.com/hongmd/userscript-improved
// @homepageURL  https://github.com/hongmd/userscript-improved
// @supportURL   https://github.com/hongmd/userscript-improved/issues
// @license      MIT
// @match        https://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  'use strict';

  // Configuration options
  const CONFIG = {
    MAX_VISITS_STORED: 20,
    MAX_URLS_STORED: 10000,         // Massive capacity for extensive tracking
    CLEANUP_THRESHOLD: 12000,       // Cleanup when exceeding this (20% buffer)
    HOVER_DELAY: 200,
    POLL_INTERVAL: 3000,            // Increased to 3s for better CPU efficiency
    BADGE_POSITION: { right: '14px', bottom: '14px' },
    BADGE_VISIBLE: true,
    DEBUG: false,                   // Set to true to enable debug logging
    // Performance optimizations
    POLLING: {
      PAUSE_WHEN_HIDDEN: true,      // Pause polling timer when tab is hidden
      SKIP_WHEN_HIDDEN: true        // Skip polling execution when tab is hidden (lighter)
    },
    // URL normalization options
    NORMALIZE_URL: {
      REMOVE_QUERY: false,          // Set to true to ignore query params (?key=value)
                                    // false: tracks "site.com?q=A" and "site.com?q=B" separately
                                    // true:  groups them as "site.com" (same page)
      REMOVE_HASH: true,            // Set to true to ignore hash fragments (#section)
                                    // true:  treats "page.html#top" and "page.html#bottom" as same
                                    // false: tracks different sections separately
      REMOVE_WWW: true,             // Set to true to remove www. prefix
      REMOVE_PROTOCOL: true,        // Set to true to remove http/https
      REMOVE_TRAILING_SLASH: true   // Set to true to remove trailing /
    }
  };

  // Badge visibility state
  let badgeVisible = CONFIG.BADGE_VISIBLE;
  let menuRegistered = false; // Flag to prevent duplicate menu registration

  // Polling state
  let pollTimer = null;
  let lastHref = location.href;
  let lastCheck = Date.now();

  // In-memory cache for hot path performance
  let dbCache = null;
  let cacheValid = false;

  function normalizeUrl(url) {
    // Validate input URL first
    if (!url || typeof url !== 'string') {
      console.warn('Invalid URL provided to normalizeUrl:', url);
      return location.href;
    }
    
    // Configurable URL normalization for flexible tracking granularity
    let normalized = url.trim();
    
    // Handle malformed URLs
    try {
      // Test if URL is valid by creating URL object
      new URL(normalized.startsWith('http') ? normalized : 'http://' + normalized);
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.warn('Malformed URL detected, using current location:', url);
      }
      return normalizeUrl(location.href);
    }
    
    // Remove protocol if configured
    if (CONFIG.NORMALIZE_URL.REMOVE_PROTOCOL) {
      normalized = normalized.replace(/^https?:\/\//, '');
    }
    
    // Remove www prefix if configured
    if (CONFIG.NORMALIZE_URL.REMOVE_WWW) {
      normalized = normalized.replace(/^www\./, '');
    }
    
    // Remove trailing slash if configured
    if (CONFIG.NORMALIZE_URL.REMOVE_TRAILING_SLASH) {
      normalized = normalized.replace(/\/$/, '');
    }
    
    // Remove hash fragments if configured
    if (CONFIG.NORMALIZE_URL.REMOVE_HASH) {
      normalized = normalized.split('#')[0];
    }
    
    // Remove query parameters if configured
    if (CONFIG.NORMALIZE_URL.REMOVE_QUERY) {
      normalized = normalized.split('?')[0];
    }
    
    if (CONFIG.DEBUG) {
      console.log(`🔗 URL normalized: "${url}" → "${normalized}"`);
    }
    
    return normalized;
  }

  // Safe closest() that handles Text nodes and elements without closest method
  function safeClosest(target, selector) {
    // Handle null/undefined
    if (!target) return null;
    
    // If target is a Text node, use its parent element
    if (target.nodeType === Node.TEXT_NODE) {
      target = target.parentElement;
    }
    
    // If target doesn't have closest method (SVG elements in old browsers), fallback
    if (!target || typeof target.closest !== 'function') {
      // Traverse up manually
      let element = target;
      while (element && element.nodeType === Node.ELEMENT_NODE) {
        if (element.matches && element.matches(selector)) {
          return element;
        }
        element = element.parentElement;
      }
      return null;
    }
    
    // Use native closest if available
    return target.closest(selector);
  }

  // Polling control functions
  function directPoll() {
    // Skip polling when tab is hidden for performance
    if (CONFIG.POLLING.SKIP_WHEN_HIDDEN && document.hidden) {
      if (CONFIG.DEBUG) {
        console.log('⏸️ Skipping poll - tab is hidden');
      }
      return;
    }
    
    const currentHref = location.href;
    const now = Date.now();
    
    // Check if we should process pending URL change
    if (pendingUrlChange && !pendingTimeout && (now - lastUrlChangeTime) >= URL_CHANGE_MIN_INTERVAL) {
      if (CONFIG.DEBUG) {
        console.log(`🔄 Polling processing pending URL change: ${currentUrl} → ${pendingUrlChange}`);
      }
      const savedPendingUrl = pendingUrlChange;
      pendingUrlChange = null;
      // Validate URL before processing
      if (savedPendingUrl && savedPendingUrl !== currentUrl) {
        currentUrl = savedPendingUrl;
        lastUrlChangeTime = now;
        updateVisit();
      }
    }
    
    // Only process if URL actually changed and enough time has passed
    if (currentHref !== lastHref && (now - lastCheck) >= 1000) {
      if (CONFIG.DEBUG) {
        console.log(`🔄 Polling detected URL change: ${lastHref} → ${currentHref}`);
      }
      lastHref = currentHref;
      lastCheck = now;
      onUrlChange();
    } else if (currentHref !== lastHref) {
      // URL changed but too soon - just update lastHref to prevent spam
      lastHref = currentHref;
    }
  }
  
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(directPoll, CONFIG.POLL_INTERVAL);
    if (CONFIG.DEBUG) {
      console.log('▶️ Polling started');
    }
  }
  
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
      if (CONFIG.DEBUG) {
        console.log('⏹️ Polling stopped');
      }
    }
  }

  // Optimized functions for timestamp storage
  function createTimestamp(date = new Date()) {
    return date.getTime();
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  // Calculate accurate UTF-8 byte size using Blob
  function getActualDataSize(data) {
    try {
      const jsonString = JSON.stringify(data);
      // Create a Blob to get the actual UTF-8 byte size
      const blob = new Blob([jsonString], { type: 'application/json' });
      return blob.size;
    } catch (error) {
      // Fallback to character count if Blob fails
      console.warn('Failed to calculate Blob size, using character count:', error);
      return JSON.stringify(data).length;
    }
  }

  // Smart cleanup to maintain database size
  function cleanupOldUrls(db) {
    const urls = Object.keys(db);
    if (urls.length <= CONFIG.MAX_URLS_STORED) return db;

    if (CONFIG.DEBUG) {
      console.log(`🧹 Large database cleanup: ${urls.length} → ${CONFIG.MAX_URLS_STORED} URLs`);
    }

    // Calculate score for each URL (visits * recency)
    const scored = urls.map(url => {
      const data = db[url];
      const recentVisit = data.visits?.[0] ?? 0;  // Optional chaining + nullish coalescing
      const daysSinceVisit = (Date.now() - recentVisit) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 30 - daysSinceVisit) / 30; // 0-1 based on last 30 days
      const score = data.count * (1 + recencyScore); // Visits weighted by recency

      return { url, score, count: data.count, lastVisit: recentVisit };
    });

    // Keep top 10,000 URLs by score - massive capacity
    scored.sort((a, b) => b.score - a.score);
    const keepUrls = scored.slice(0, CONFIG.MAX_URLS_STORED);

    // Use Object.fromEntries for more modern approach (ES2019)
    const cleanDb = Object.fromEntries(
      keepUrls.map(({ url }) => [url, db[url]])
    );

    const removedCount = urls.length - keepUrls.length;
    if (CONFIG.DEBUG) {
      console.log(`✅ Cleanup complete: Kept ${keepUrls.length} URLs, removed ${removedCount} low-priority URLs`);
    }
    return cleanDb;
  }

  function shortenNumber(num) {
    // Handle edge cases first
    if (!Number.isFinite(num)) return '0'; // Handle NaN, Infinity, -Infinity
    if (num < 0) return '0'; // Visits can't be negative
    if (num === 0) return '0';
    
    // Convert to absolute value and round to avoid floating point issues
    const absNum = Math.abs(Math.floor(num));
    
    // Handle very large numbers with appropriate suffixes
    if (absNum >= 1_000_000_000) {
      return (Math.round(absNum / 100_000_000) / 10) + 'B'; // Billions
    }
    if (absNum >= 1_000_000) {
      return (Math.round(absNum / 100_000) / 10) + 'M'; // Millions
    }
    if (absNum >= 1_000) {
      return (Math.round(absNum / 100) / 10) + 'K'; // Thousands
    }
    
    return String(absNum);
  }

  function getDB() {
    // Return cached version if available and valid
    if (cacheValid && dbCache !== null) {
      return dbCache;
    }
    
    try {
      dbCache = GM_getValue('visitDB', {});
      cacheValid = true;
      
      if (CONFIG.DEBUG) {
        console.log(`💾 DB loaded from storage: ${Object.keys(dbCache).length} URLs`);
      }
      
      return dbCache;
    } catch (error) {
      console.warn('Failed to read visit database:', error);
      dbCache = {};
      cacheValid = true;
      return dbCache;
    }
  }

  // Fast read-only access for hot paths (tooltips, etc)
  function getDBCached() {
    if (cacheValid && dbCache !== null) {
      return dbCache;
    }
    return getDB(); // Fallback to full load
  }

  function setDB(db) {
    try {
      // Auto cleanup if database is getting too large
      if (Object.keys(db).length > CONFIG.CLEANUP_THRESHOLD) {
        db = cleanupOldUrls(db);
      }
      
      // Update cache first
      dbCache = db;
      cacheValid = true;
      
      // Then persist to storage
      GM_setValue('visitDB', db);
      
      if (CONFIG.DEBUG) {
        console.log(`💾 DB saved to storage: ${Object.keys(db).length} URLs`);
      }
    } catch (error) {
      console.warn('Failed to save visit database:', error);
      // Invalidate cache on save failure
      cacheValid = false;
    }
  }

  // Invalidate cache when external changes might occur
  function invalidateCache() {
    cacheValid = false;
    // Use setTimeout to prevent race conditions
    setTimeout(() => {
      dbCache = null;
    }, 0);
  }  let currentUrl = normalizeUrl(location.href);

  function updateVisit() {
    const db = getDB();
    const now = new Date();
    const timestamp = createTimestamp(now);

    // Use logical assignment and modern destructuring
    db[currentUrl] ??= { count: 0, visits: [] };

    const urlData = db[currentUrl];
    urlData.count += 1;
    urlData.visits.unshift(timestamp);

    // Trim visits array if needed
    if (urlData.visits.length > CONFIG.MAX_VISITS_STORED) {
      urlData.visits.length = CONFIG.MAX_VISITS_STORED;
    }

    if (CONFIG.DEBUG) {
      const isNew = urlData.count === 1;
      console.log(isNew
        ? `🆕 New URL tracked: ${currentUrl}`
        : `🔄 URL revisited: ${currentUrl} (${urlData.count} times)`
      );
    }

    setDB(db);
    renderBadge(urlData);

    // Only register menu once to prevent duplicates
    if (!menuRegistered) {
      registerMenu();
      menuRegistered = true;
    }
  }

  function registerMenu() {
    // Register static menu items once to prevent duplicates
    GM_registerMenuCommand('👁️ Toggle Badge', toggleBadgeVisibility);
    GM_registerMenuCommand('📊 Export Data', exportData);
    GM_registerMenuCommand('📈 Show Statistics', showStatistics);
    GM_registerMenuCommand('🗑️ Clear Current Page', clearCurrentPage);
    GM_registerMenuCommand('💥 Clear All Data', clearAllData);
    GM_registerMenuCommand('🐛 Toggle Debug Mode', toggleDebugMode);
  }

  function exportData() {
    try {
      // Use cached DB for export - same data, no extra I/O
      const db = getDBCached();
      const dataStr = JSON.stringify(db, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visit-tracker-${new Date().toISOString().split('T')[0]}.json`;

      // Safely append to DOM
      if (document.body) {
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // Fallback for early DOM state
        a.click();
      }

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data: ' + error.message);
    }
  }

  function showStatistics() {
    // Use cached DB for statistics - read-only operation
    const db = getDBCached();
    const urls = Object.keys(db);
    const totalUrls = urls.length;

    // Handle empty database
    if (totalUrls === 0) {
      alert('📈 Visit Tracker Statistics\n\n🌐 No websites tracked yet!\n\nStart browsing to collect visit data.');
      return;
    }

    const totalVisits = urls.reduce((sum, url) => sum + db[url].count, 0);

    // Find most visited site using optional chaining
    const mostVisited = urls.reduce((max, url) =>
      db[url].count > (db[max]?.count ?? 0) ? url : max, '');

    // Find oldest entry using optional chaining
    const oldestEntry = urls.reduce((oldest, url) => {
      const visits = db[url].visits;
      if (!visits?.length) return oldest;

      const lastVisit = visits[visits.length - 1];
      const oldestVisits = db[oldest]?.visits;
      if (!oldestVisits?.length) return url;

      const oldestLastVisit = oldestVisits[oldestVisits.length - 1];
      return lastVisit < oldestLastVisit ? url : oldest;
    }, '');

    const stats = `
📈 Visit Tracker Statistics

🌐 Total websites tracked: ${totalUrls}
👆 Total visits recorded: ${totalVisits}
🏆 Most visited: ${mostVisited} (${db[mostVisited]?.count ?? 0} visits)
⏰ Oldest tracked site: ${oldestEntry}
📅 Current page visits: ${db[currentUrl]?.count ?? 0}

Database size: ${Math.round(getActualDataSize(db) / 1024)} KB (UTF-8)
    `.trim();

    alert(stats);
  }

  function clearCurrentPage() {
    if (confirm(`Clear visit data for current page?\n\nURL: ${currentUrl}\nThis will only affect this page.`)) {
      const db = getDB();

      // Clear old data and immediately set new entry in single operation
      const now = new Date();
      const timestamp = createTimestamp(now);
      db[currentUrl] = { count: 1, visits: [timestamp] };
      setDB(db);

      // Update UI immediately with new data
      renderBadge(db[currentUrl]);

      alert('Current page data cleared! Counter reset to 1.');
    }
  }

  function clearAllData() {
    if (confirm('⚠️ WARNING: This will clear ALL visit data from ALL websites!\n\nAre you absolutely sure?')) {
      // Clear all data and immediately create new entry for current page in single operation
      const now = new Date();
      const timestamp = createTimestamp(now);
      const newDb = {};
      newDb[currentUrl] = { count: 1, visits: [timestamp] };
      setDB(newDb);

      // Update UI immediately with new data
      renderBadge(newDb[currentUrl]);

      alert('All visit data cleared! Current page counter reset to 1.');
    }
  }

  function ensureBadgeStyles() {
    if (document.getElementById('vt-hover-styles')) return;
    const css = `
      .vt-badge {
        position: fixed;
        right: ${CONFIG.BADGE_POSITION.right};
        bottom: ${CONFIG.BADGE_POSITION.bottom};
        z-index: 2147483647;
        font-family: system-ui, sans-serif;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .vt-badge.hidden {
        opacity: 0;
        pointer-events: none;
        transform: scale(0.8);
      }
      .vt-link {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 9999px;
        background: rgba(20,20,20,0.9);
        color: #fff !important;
        font-size: 12px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.2);
        opacity: 0.85;
        transition: opacity 0.2s ease;
      }
      .vt-badge:hover .vt-link { opacity: 1; }
      .vt-tooltip {
        position: absolute;
        bottom: 120%;
        right: 0;
        background: #111;
        color: #fff;
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 12px;
        white-space: nowrap;
        box-shadow: 0 10px 25px rgba(0,0,0,0.35);
        opacity: 0;
        transform: translateY(6px);
        transition: opacity 140ms ease, transform 140ms ease;
        pointer-events: none;
      }
      .vt-badge:hover .vt-tooltip {
        opacity: 1;
        transform: translateY(0);
      }
      .vt-tooltip .vt-line { display: block; }
    `;
    const style = document.createElement('style');
    style.id = 'vt-hover-styles';
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  function renderBadge(data) {
    ensureBadgeStyles();

    let badge = document.getElementById('vt-hover-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'vt-hover-badge';
      badge.className = 'vt-badge';
      badge.innerHTML = `
        <a class="vt-link" href="javascript:void(0)"></a>
        <div class="vt-tooltip"></div>
      `;

      // Add click handler for toggle visibility
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleBadgeVisibility();
      });

      document.documentElement.appendChild(badge);
    }

    // Apply visibility state
    if (!badgeVisible) {
      badge.classList.add('hidden');
    } else {
      badge.classList.remove('hidden');
    }

    badge.querySelector('.vt-link').textContent = `Visit: ${shortenNumber(data.count)}`;

    const tooltip = badge.querySelector('.vt-tooltip');
    tooltip.innerHTML = `<span class="vt-line">Visit: ${data.count}</span>`;

    // Handle empty visits array - format timestamps for display
    if (data.visits && data.visits.length > 0) {
      data.visits.forEach((timestamp, i) => {
        const formattedTime = formatTimestamp(timestamp);
        tooltip.innerHTML += `<span class="vt-line">${i + 1}. ${formattedTime}</span>`;
      });
    } else {
      tooltip.innerHTML += `<span class="vt-line">No visit history</span>`;
    }
  }

  function toggleBadgeVisibility() {
    badgeVisible = !badgeVisible;
    const badge = document.getElementById('vt-hover-badge');
    if (badge) {
      if (badgeVisible) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    // Save state to GM storage
    try {
      GM_setValue('badgeVisible', badgeVisible);
    } catch (error) {
      console.warn('Failed to save badge visibility state:', error);
    }
  }

  function toggleDebugMode() {
    CONFIG.DEBUG = !CONFIG.DEBUG;

    // Save state to GM storage
    try {
      GM_setValue('debugMode', CONFIG.DEBUG);
    } catch (error) {
      console.warn('Failed to save debug mode state:', error);
    }

    const status = CONFIG.DEBUG ? 'enabled' : 'disabled';
    alert(`🐛 Debug mode ${status}!\n\nDebug logging is now ${status}.`);

    if (CONFIG.DEBUG) {
      console.log('🐛 Visit Tracker Debug Mode: ENABLED');
    }
  }

  // Rate limiting for URL changes with pending mechanism
  let lastUrlChangeTime = 0;
  let pendingUrlChange = null;
  let pendingTimeout = null;
  const URL_CHANGE_MIN_INTERVAL = 500; // Minimum 500ms between URL changes

  function onUrlChange() {
    const newUrl = normalizeUrl(location.href);
    if (newUrl === currentUrl) return;
    
    const now = Date.now();
    const timeSinceLastChange = now - lastUrlChangeTime;
    
    if (timeSinceLastChange < URL_CHANGE_MIN_INTERVAL) {
      if (CONFIG.DEBUG) {
        console.log(`⏰ URL change rate limited, scheduling: ${currentUrl} → ${newUrl}`);
      }
      
      // Store the pending change without updating currentUrl yet
      pendingUrlChange = newUrl;
      
      // Clear any existing pending timeout
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
      }
      
      // Schedule the change for when rate limit expires
      const remainingTime = URL_CHANGE_MIN_INTERVAL - timeSinceLastChange;
      pendingTimeout = setTimeout(() => {
        if (pendingUrlChange && pendingUrlChange !== currentUrl) {
          if (CONFIG.DEBUG) {
            console.log(`⏰ Processing pending URL change: ${currentUrl} → ${pendingUrlChange}`);
          }
          const savedPendingUrl = pendingUrlChange;
          pendingUrlChange = null;
          pendingTimeout = null;
          
          // Process the pending change
          currentUrl = savedPendingUrl;
          lastUrlChangeTime = Date.now();
          updateVisit();
        }
      }, remainingTime + 10); // +10ms buffer
      
      return;
    }

    // Clear any pending changes since we're processing immediately
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
      pendingUrlChange = null;
    }

    if (CONFIG.DEBUG) {
      console.log(`🌐 URL changed: ${currentUrl} → ${newUrl}`);
    }

    currentUrl = newUrl;
    lastUrlChangeTime = now;
    updateVisit();
  }

  function installUrlObservers() {
    // Enhanced history hooks with rate limiting
    const _pushState = history.pushState;
    const _replaceState = history.replaceState;
    
    history.pushState = function (...args) {
      const result = _pushState.apply(this, args);
      // Use setTimeout to avoid immediate execution conflicts
      setTimeout(onUrlChange, 50);
      return result;
    };
    
    history.replaceState = function (...args) {
      const result = _replaceState.apply(this, args);
      setTimeout(onUrlChange, 50);
      return result;
    };
    
    // Standard event listeners
    window.addEventListener('popstate', onUrlChange);
    window.addEventListener('hashchange', onUrlChange);

    // Optimized MutationObserver with comprehensive title change detection
    let mutationTimeout = null;
    const mo = new MutationObserver((mutations) => {
      // Throttle mutation processing to avoid spam
      if (mutationTimeout) return;
      
      mutationTimeout = setTimeout(() => {
        mutationTimeout = null;
        let titleChanged = false;
        
        for (const mutation of mutations) {
          // Check for title element changes in multiple ways
          if (mutation.type === 'childList') {
            // Case 1: Title element added/removed from head
            const titleInAdded = Array.from(mutation.addedNodes).some(node => 
              node.nodeName === 'TITLE' || 
              (node.nodeType === Node.ELEMENT_NODE && node.querySelector('title'))
            );
            const titleInRemoved = Array.from(mutation.removedNodes).some(node => 
              node.nodeName === 'TITLE' || 
              (node.nodeType === Node.ELEMENT_NODE && node.querySelector('title'))
            );
            
            // Case 2: Text nodes added/removed inside title element
            if (mutation.target.nodeName === 'TITLE') {
              titleChanged = true;
              if (CONFIG.DEBUG) {
                console.log('📝 Title childList mutation detected:', mutation);
              }
              break;
            }
            
            if (titleInAdded || titleInRemoved) {
              titleChanged = true;
              if (CONFIG.DEBUG) {
                console.log('📝 Title element added/removed:', mutation);
              }
              break;
            }
          } 
          
          // Case 3: Character data changed in title's text nodes
          else if (mutation.type === 'characterData') {
            // Check if the text node belongs to title element
            let parent = mutation.target.parentNode;
            while (parent && parent.nodeName !== 'TITLE') {
              parent = parent.parentNode;
            }
            if (parent && parent.nodeName === 'TITLE') {
              titleChanged = true;
              if (CONFIG.DEBUG) {
                console.log('📝 Title characterData mutation detected:', mutation);
              }
              break;
            }
          }
        }
        
        if (titleChanged) {
          if (CONFIG.DEBUG) {
            console.log('📝 Title change detected, triggering URL change check');
          }
          onUrlChange();
        }
      }, 100); // 100ms throttle for mutations
    });

    // Safely observe document.head with comprehensive title tracking
    if (document.head) {
      mo.observe(document.head, { 
        childList: true,      // Detect title element addition/removal
        subtree: true,        // Detect changes in title's children (text nodes)
        characterData: true   // Detect text content changes in title
      });
    } else {
      // Fallback: observe document for head creation
      mo.observe(document, { 
        childList: true, 
        subtree: true,
        characterData: true 
      });
    }

    // Initialize polling
    startPolling();
  }

  const tooltip = document.createElement('div');
  // Apply styles using individual properties for better compatibility
  Object.assign(tooltip.style, {
    position: 'fixed',
    padding: '6px 8px',
    fontSize: '12px',
    fontFamily: 'system-ui, sans-serif',
    background: 'rgba(20, 20, 20, 0.9)',
    color: 'white',
    borderRadius: '6px',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    zIndex: '999999',
    opacity: '0',
    transition: 'opacity 0.15s ease'
  });

  // Safely append tooltip to DOM
  function appendTooltipSafely() {
    if (document.body) {
      try {
        document.body.appendChild(tooltip);
        return true;
      } catch (error) {
        console.warn('Failed to append tooltip to body:', error);
        return false;
      }
    } else {
      // Fallback for early DOM state
      document.addEventListener('DOMContentLoaded', () => {
        try {
          if (document.body && !document.body.contains(tooltip)) {
            document.body.appendChild(tooltip);
          }
        } catch (error) {
          console.warn('Failed to append tooltip on DOMContentLoaded:', error);
        }
      }, { passive: true, once: true });
      return false;
    }
  }

  if (!appendTooltipSafely()) {
    if (CONFIG.DEBUG) {
      console.log('📋 Tooltip will be appended when DOM is ready');
    }
  }

  let hoverTimer;
  let currentHoveredLink = null;
  let rafId = null; // RequestAnimationFrame ID for smooth tooltip movement
  let pendingTooltipPosition = null; // Store pending position updates

  function showTooltip(e, linkUrl) {
    const key = normalizeUrl(linkUrl);
    // Use cached DB for hot path performance - no storage I/O!
    const db = getDBCached();
    const data = db[key];

    // Clear previous content safely
    tooltip.textContent = '';

    if (!data) {
      tooltip.textContent = 'No visits recorded';
    } else {
      // Create elements safely instead of using innerHTML
      const visitLine = document.createElement('div');
      visitLine.textContent = `Visit: ${shortenNumber(data.count)}`;

      const lastLine = document.createElement('div');
      // Format timestamp for display using optional chaining
      const lastVisit = data.visits?.[0] ? formatTimestamp(data.visits[0]) : 'Never';
      lastLine.textContent = `Last: ${lastVisit}`;

      tooltip.appendChild(visitLine);
      tooltip.appendChild(lastLine);
    }

    // Set initial position
    updateTooltipPosition(e.clientX, e.clientY);
    tooltip.style.opacity = 1;
  }

  function updateTooltipPosition(x, y) {
    // Store the position to be updated in the next frame
    pendingTooltipPosition = { x: x + 12, y: y + 12 };

    // Cancel previous frame if it exists
    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    // Schedule position update for next frame
    rafId = requestAnimationFrame(() => {
      if (pendingTooltipPosition) {
        tooltip.style.left = pendingTooltipPosition.x + 'px';
        tooltip.style.top = pendingTooltipPosition.y + 'px';
        pendingTooltipPosition = null;
      }
      rafId = null;
    });
  }

  function hideTooltip() {
    tooltip.style.opacity = 0;
    currentHoveredLink = null;

    // Cancel any pending animation frame
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pendingTooltipPosition = null;

    document.removeEventListener('mousemove', moveTooltip);
  }

  function moveTooltip(e) {
    // Use requestAnimationFrame for smooth movement
    updateTooltipPosition(e.clientX, e.clientY);
  }

  // Improved mouse event handling to prevent tooltip flicker
  // Using passive listeners for better performance on heavy pages
  document.addEventListener('mouseover', e => {
    const a = safeClosest(e.target, 'a[href]');
    if (!a) return;
    const href = a.href;
    if (!/^https?:\/\//.test(href)) return;

    // Prevent duplicate listeners for same link
    if (currentHoveredLink === a) return;
    
    // Clean up previous link if any
    if (currentHoveredLink) {
      clearTimeout(hoverTimer);
      hideTooltip();
    }
    
    currentHoveredLink = a;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showTooltip(e, href), CONFIG.HOVER_DELAY);
    document.addEventListener('mousemove', moveTooltip, { passive: true });
  }, { passive: true });

  // Use mouseout with relatedTarget check to prevent flicker from child elements
  document.addEventListener('mouseout', e => {
    const a = safeClosest(e.target, 'a[href]');
    if (!a || a !== currentHoveredLink) return;
    
    // Check if we're moving to a child element of the same link
    const relatedTarget = e.relatedTarget;
    if (relatedTarget && a.contains(relatedTarget)) {
      if (CONFIG.DEBUG) {
        console.log('🔗 Mouse moved to child element, keeping tooltip visible');
      }
      return; // Still within the same link, don't hide tooltip
    }
    
    // Also check if we're moving from child to parent within same link
    const relatedLink = safeClosest(relatedTarget, 'a[href]');
    if (relatedLink === a) {
      if (CONFIG.DEBUG) {
        console.log('🔗 Mouse moved within same link structure, keeping tooltip visible');
      }
      return; // Still within the same link structure
    }

    if (CONFIG.DEBUG) {
      console.log('🔗 Mouse left link, hiding tooltip');
    }

    clearTimeout(hoverTimer);
    hideTooltip();
  }, { passive: true });

  // Initialize the tracker
  function initializeTracker() {
    // Load saved badge visibility state
    try {
      badgeVisible = GM_getValue('badgeVisible', CONFIG.BADGE_VISIBLE);
    } catch (error) {
      console.warn('Failed to load badge visibility state:', error);
      badgeVisible = CONFIG.BADGE_VISIBLE;
    }

    // Load saved debug mode state
    try {
      CONFIG.DEBUG = GM_getValue('debugMode', CONFIG.DEBUG);
    } catch (error) {
      console.warn('Failed to load debug mode state:', error);
      CONFIG.DEBUG = false;
    }

    if (CONFIG.DEBUG) {
      console.log('🐛 Visit Tracker Debug Mode: ENABLED');
      
      // Test shortenNumber edge cases in debug mode
      console.group('🔢 Testing shortenNumber edge cases:');
      const testCases = [
        [0, '0'], [1, '1'], [999, '999'], [1000, '1.0K'], [1500, '1.5K'],
        [999999, '999.9K'], [1000000, '1.0M'], [1500000, '1.5M'],
        [999999999, '999.9M'], [1000000000, '1.0B'], [1500000000, '1.5B'],
        [-5, '0'], [NaN, '0'], [Infinity, '0'], [-Infinity, '0'], [1.7, '1']
      ];
      testCases.forEach(([input, expected]) => {
        const result = shortenNumber(input);
        const status = result === expected ? '✅' : '❌';
        console.log(`${status} shortenNumber(${input}) = "${result}" (expected: "${expected}")`);
      });
      console.groupEnd();
    }

    // Don't register menu for initial empty state - let updateVisit() handle it
    updateVisit();
    installUrlObservers();
    
    // Handle polling optimization and cache invalidation for multi-tab scenarios
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Tab became hidden - pause polling if configured
        if (CONFIG.POLLING.PAUSE_WHEN_HIDDEN) {
          stopPolling();
          if (CONFIG.DEBUG) {
            console.log('👁️ Tab hidden - polling paused for performance');
          }
        } else if (CONFIG.DEBUG) {
          console.log('👁️ Tab hidden - polling continues but will skip execution');
        }
      } else {
        // Tab became visible - resume polling if it was paused
        if (CONFIG.POLLING.PAUSE_WHEN_HIDDEN && !pollTimer) {
          startPolling();
          if (CONFIG.DEBUG) {
            console.log('👁️ Tab visible - polling resumed');
          }
        } else if (CONFIG.DEBUG) {
          console.log('👁️ Tab visible - cache remains valid (single-tab assumption)');
        }
        // Note: We assume single-tab usage. If multi-tab coordination needed,
        // uncomment next line: invalidateCache();
      }
    }, { passive: true });
  }

  // Cleanup pending operations on page unload
  window.addEventListener('beforeunload', () => {
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      // Process any pending URL change immediately before unload
      if (pendingUrlChange && pendingUrlChange !== currentUrl) {
        currentUrl = pendingUrlChange;
        updateVisit();
      }
    }
  });

  // Debug test cases for URL normalization (only runs in debug mode)
  if (CONFIG.DEBUG) {
    console.group('🧪 URL Normalization Test Cases');
    
    const testUrls = [
      'https://www.example.com/page?q=search&tab=results#section1',
      'http://example.com/path/?filter=value',
      'https://subdomain.site.com/page/',
      'http://www.google.com/search?q=test+query&source=web',
      'https://github.com/user/repo/issues?state=open#comment-123'
    ];
    
    testUrls.forEach(testUrl => {
      const normalized = normalizeUrl(testUrl);
      console.log(`  "${testUrl}"\n  → "${normalized}"`);
    });
    
    console.log('\n📋 Current normalization settings:');
    Object.entries(CONFIG.NORMALIZE_URL).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    
    console.groupEnd();
    
    // Debug polling configuration
    console.group('🧪 Polling Configuration');
    console.log('Poll interval:', CONFIG.POLL_INTERVAL + 'ms');
    console.log('Pause when hidden:', CONFIG.POLLING.PAUSE_WHEN_HIDDEN);
    console.log('Skip when hidden:', CONFIG.POLLING.SKIP_WHEN_HIDDEN);
    console.log('Current tab visibility:', document.hidden ? 'hidden' : 'visible');
    console.log('Polling status:', pollTimer ? 'running' : 'stopped');
    console.groupEnd();
    
    // Debug title change detection
    console.group('🧪 Title Change Detection Test');
    console.log('Current title:', document.title);
    console.log('Title element:', document.querySelector('title'));
    
    // Test title change simulation (only if safe to do so)
    if (location.href.includes('localhost') || location.href.includes('127.0.0.1')) {
      console.log('🧪 Simulating title changes for testing...');
      const originalTitle = document.title;
      
      setTimeout(() => {
        document.title = originalTitle + ' [TEST]';
        console.log('📝 Title changed to:', document.title);
        
        setTimeout(() => {
          document.title = originalTitle;
          console.log('📝 Title restored to:', document.title);
        }, 1000);
      }, 2000);
    }
    
    console.groupEnd();
    
    // Debug size calculation comparison
    console.group('🧪 Database Size Calculation Test');
    const testDb = getDB();
    const charCount = JSON.stringify(testDb).length;
    const byteSize = getActualDataSize(testDb);
    const ratio = (byteSize / charCount).toFixed(2);
    
    console.log(`Character count: ${charCount.toLocaleString()}`);
    console.log(`Actual UTF-8 bytes: ${byteSize.toLocaleString()}`);
    console.log(`Bytes per character: ${ratio} (1.0 = pure ASCII, >1.0 = Unicode present)`);
    console.log(`Size in KB (old method): ${Math.round(charCount / 1024)} KB`);
    console.log(`Size in KB (accurate): ${Math.round(byteSize / 1024)} KB`);
    
    if (byteSize !== charCount) {
      console.log(`📊 Size difference: ${byteSize - charCount} bytes (${((byteSize / charCount - 1) * 100).toFixed(1)}% larger)`);
    } else {
      console.log(`✅ Database contains only ASCII characters`);
    }
    
    console.groupEnd();
  }

  initializeTracker();

})();
