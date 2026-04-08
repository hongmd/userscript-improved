// ==UserScript==
// @name         URL Visit Tracker (Improved)
// @namespace    https://github.com/hongmd/userscript-improved
// @version      2.8.0
// @description  Track visits per URL, show corner badge history & link hover info - Massive Capacity (10K URLs) - ES2020+ & Smooth Tooltips. Advanced URL normalization and performance optimizations.
// @author       hongmd
// @contributor  Original idea by Chewy
// @license      MIT
// @homepageURL  https://github.com/hongmd/userscript-improved
// @supportURL   https://github.com/hongmd/userscript-improved/issues
// @match        https://*/*
// @run-at       document-start
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @updateURL    https://raw.githubusercontent.com/hongmd/userscript-improved/master/scripts/URL-Visit-Tracker-Improved.user.js
// @downloadURL  https://raw.githubusercontent.com/hongmd/userscript-improved/master/scripts/URL-Visit-Tracker-Improved.user.js
// ==/UserScript==

(function () {
  'use strict';

  const DEFAULT_SETTINGS = Object.freeze({
    badgeVisible: true,
    debugMode: false,
    hoverDelay: 1000,
    removeQuery: false,
    removeHash: true,
    cleanSearchUrls: true,
    skipUtilityPages: true,
    debounceEnabled: true,
    debounceDelay: 1000,
    webWorkerEnabled: true,
    pauseWhenHidden: true,
    adaptivePolling: true,
    pollInterval: 5000,
    maxUrlsStored: 10000,
    maxVisitsStored: 20
  });

  const NUMERIC_SETTING_LIMITS = Object.freeze({
    hoverDelay: { min: 0, max: 5000, defaultValue: DEFAULT_SETTINGS.hoverDelay },
    debounceDelay: { min: 100, max: 5000, defaultValue: DEFAULT_SETTINGS.debounceDelay },
    pollInterval: { min: 1000, max: 30000, defaultValue: DEFAULT_SETTINGS.pollInterval },
    maxUrlsStored: { min: 1000, max: 50000, defaultValue: DEFAULT_SETTINGS.maxUrlsStored },
    maxVisitsStored: { min: 5, max: 100, defaultValue: DEFAULT_SETTINGS.maxVisitsStored }
  });

  // Configuration options
  const CONFIG = {
    MAX_VISITS_STORED: DEFAULT_SETTINGS.maxVisitsStored,
    MAX_URLS_STORED: DEFAULT_SETTINGS.maxUrlsStored, // Massive capacity for extensive tracking
    HOVER_DELAY: DEFAULT_SETTINGS.hoverDelay,        // Delay before showing tooltip (ms)
    POLL_INTERVAL: DEFAULT_SETTINGS.pollInterval,    // Reduced polling frequency for better performance
    BADGE_POSITION: { right: '14px', bottom: '14px' },
    BADGE_VISIBLE: DEFAULT_SETTINGS.badgeVisible,
    DEBUG: DEFAULT_SETTINGS.debugMode, // Set to true to enable debug logging
    // Performance optimizations
    POLLING: {
      PAUSE_WHEN_HIDDEN: DEFAULT_SETTINGS.pauseWhenHidden, // Pause polling timer when tab is hidden
      SKIP_WHEN_HIDDEN: true,                               // Skip polling execution when tab is hidden (lighter)
      ADAPTIVE: DEFAULT_SETTINGS.adaptivePolling            // Enable adaptive polling based on activity
    },
    // Debounce settings for database writes
    DEBOUNCE: {
      ENABLED: DEFAULT_SETTINGS.debounceEnabled, // Enable debounced writes for better performance
      DELAY: DEFAULT_SETTINGS.debounceDelay      // Delay in ms before writing to storage
    },
    // Web Worker for heavy operations
    WEB_WORKER: {
      ENABLED: DEFAULT_SETTINGS.webWorkerEnabled, // Use Web Worker for cleanup operations
      TIMEOUT: 15000                // Timeout for worker operations (ms)
    },
    // URL normalization options
    NORMALIZE_URL: {
      REMOVE_QUERY: DEFAULT_SETTINGS.removeQuery, // Set to true to ignore query params (?key=value)
      // false: tracks "site.com?q=A" and "site.com?q=B" separately
      // true:  groups them as "site.com" (same page)
      REMOVE_HASH: DEFAULT_SETTINGS.removeHash, // Set to true to ignore hash fragments (#section)
      // true:  treats "page.html#top" and "page.html#bottom" as same
      // false: tracks different sections separately
      REMOVE_WWW: true,             // Set to true to remove www. prefix
      REMOVE_PROTOCOL: true,        // Set to true to remove http/https
      REMOVE_TRAILING_SLASH: true,  // Set to true to remove trailing /
      CLEAN_SEARCH_URLS: DEFAULT_SETTINGS.cleanSearchUrls // Clean search engine URLs (keep only main query)
    },
    // URL filtering - Skip tracking certain types of URLs
    URL_FILTERS: {
      SKIP_UTILITY_PAGES: DEFAULT_SETTINGS.skipUtilityPages, // Skip tracking utility/internal pages (cookies, auth, etc.)
      SKIP_PATTERNS: [              // URL patterns to skip (case-insensitive)
        '/RotateCookiesPage',       // YouTube cookie rotation
        '/ServiceLogin',            // Google login pages
        '/CheckCookie',             // Cookie check pages
        '/robots.txt',              // Robot files
        '/favicon.ico',             // Favicon requests
        'ogs.google.com',           // Google widgets/apps
        '/widget/app',              // Google widget apps
        '/persist_identity',        // YouTube identity persistence
        'studio.youtube.com/persist_identity' // YouTube Studio identity
      ]
    }
  };

  // Badge visibility state
  let badgeVisible = CONFIG.BADGE_VISIBLE;
  let menuRegistered = false; // Flag to prevent duplicate menu registration

  // Polling state
  let pollTimer = null;
  let lastHref = location.href;
  let lastCheck = Date.now();
  let activityCount = 0; // Track recent activity for adaptive polling

  // In-memory cache for hot path performance
  let dbCache = null;
  let cacheValid = false;

  function sanitizeNumericSetting(name, value) {
    const rule = NUMERIC_SETTING_LIMITS[name];
    if (!rule) {
      return value;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return rule.defaultValue;
    }

    return Math.min(rule.max, Math.max(rule.min, parsed));
  }

  function buildValidatedSettings(rawSettings = {}) {
    return {
      badgeVisible: rawSettings.badgeVisible ?? DEFAULT_SETTINGS.badgeVisible,
      debugMode: rawSettings.debugMode ?? DEFAULT_SETTINGS.debugMode,
      hoverDelay: sanitizeNumericSetting('hoverDelay', rawSettings.hoverDelay ?? DEFAULT_SETTINGS.hoverDelay),
      removeQuery: rawSettings.removeQuery ?? DEFAULT_SETTINGS.removeQuery,
      removeHash: rawSettings.removeHash ?? DEFAULT_SETTINGS.removeHash,
      cleanSearchUrls: rawSettings.cleanSearchUrls ?? DEFAULT_SETTINGS.cleanSearchUrls,
      skipUtilityPages: rawSettings.skipUtilityPages ?? DEFAULT_SETTINGS.skipUtilityPages,
      debounceEnabled: rawSettings.debounceEnabled ?? DEFAULT_SETTINGS.debounceEnabled,
      debounceDelay: sanitizeNumericSetting('debounceDelay', rawSettings.debounceDelay ?? DEFAULT_SETTINGS.debounceDelay),
      webWorkerEnabled: rawSettings.webWorkerEnabled ?? DEFAULT_SETTINGS.webWorkerEnabled,
      pauseWhenHidden: rawSettings.pauseWhenHidden ?? DEFAULT_SETTINGS.pauseWhenHidden,
      adaptivePolling: rawSettings.adaptivePolling ?? DEFAULT_SETTINGS.adaptivePolling,
      pollInterval: sanitizeNumericSetting('pollInterval', rawSettings.pollInterval ?? DEFAULT_SETTINGS.pollInterval),
      maxUrlsStored: sanitizeNumericSetting('maxUrlsStored', rawSettings.maxUrlsStored ?? DEFAULT_SETTINGS.maxUrlsStored),
      maxVisitsStored: sanitizeNumericSetting('maxVisitsStored', rawSettings.maxVisitsStored ?? DEFAULT_SETTINGS.maxVisitsStored)
    };
  }

  function applySettings(settings) {
    badgeVisible = Boolean(settings.badgeVisible);
    CONFIG.DEBUG = Boolean(settings.debugMode);
    CONFIG.HOVER_DELAY = settings.hoverDelay;
    CONFIG.NORMALIZE_URL.REMOVE_QUERY = Boolean(settings.removeQuery);
    CONFIG.NORMALIZE_URL.REMOVE_HASH = Boolean(settings.removeHash);
    CONFIG.NORMALIZE_URL.CLEAN_SEARCH_URLS = Boolean(settings.cleanSearchUrls);
    CONFIG.URL_FILTERS.SKIP_UTILITY_PAGES = Boolean(settings.skipUtilityPages);
    CONFIG.DEBOUNCE.ENABLED = Boolean(settings.debounceEnabled);
    CONFIG.DEBOUNCE.DELAY = settings.debounceDelay;
    CONFIG.WEB_WORKER.ENABLED = Boolean(settings.webWorkerEnabled);
    CONFIG.POLLING.PAUSE_WHEN_HIDDEN = Boolean(settings.pauseWhenHidden);
    CONFIG.POLLING.ADAPTIVE = Boolean(settings.adaptivePolling);
    CONFIG.POLL_INTERVAL = settings.pollInterval;
    CONFIG.MAX_URLS_STORED = settings.maxUrlsStored;
    CONFIG.MAX_VISITS_STORED = settings.maxVisitsStored;
  }

  function getCurrentSettings() {
    return {
      badgeVisible,
      debugMode: CONFIG.DEBUG,
      hoverDelay: CONFIG.HOVER_DELAY,
      removeQuery: CONFIG.NORMALIZE_URL.REMOVE_QUERY,
      removeHash: CONFIG.NORMALIZE_URL.REMOVE_HASH,
      cleanSearchUrls: CONFIG.NORMALIZE_URL.CLEAN_SEARCH_URLS,
      skipUtilityPages: CONFIG.URL_FILTERS.SKIP_UTILITY_PAGES,
      debounceEnabled: CONFIG.DEBOUNCE.ENABLED,
      debounceDelay: CONFIG.DEBOUNCE.DELAY,
      webWorkerEnabled: CONFIG.WEB_WORKER.ENABLED,
      pauseWhenHidden: CONFIG.POLLING.PAUSE_WHEN_HIDDEN,
      adaptivePolling: CONFIG.POLLING.ADAPTIVE,
      pollInterval: CONFIG.POLL_INTERVAL,
      maxUrlsStored: CONFIG.MAX_URLS_STORED,
      maxVisitsStored: CONFIG.MAX_VISITS_STORED
    };
  }

  function persistSettings(settings = getCurrentSettings()) {
    GM_setValue('badgeVisible', settings.badgeVisible);
    GM_setValue('debugMode', settings.debugMode);
    GM_setValue('hoverDelay', settings.hoverDelay);
    GM_setValue('removeQuery', settings.removeQuery);
    GM_setValue('removeHash', settings.removeHash);
    GM_setValue('searchCleaning', settings.cleanSearchUrls);
    GM_setValue('urlFiltering', settings.skipUtilityPages);
    GM_setValue('debounceEnabled', settings.debounceEnabled);
    GM_setValue('debounceDelay', settings.debounceDelay);
    GM_setValue('webWorkerEnabled', settings.webWorkerEnabled);
    GM_setValue('pauseWhenHidden', settings.pauseWhenHidden);
    GM_setValue('adaptivePolling', settings.adaptivePolling);
    GM_setValue('pollInterval', settings.pollInterval);
    GM_setValue('maxUrlsStored', settings.maxUrlsStored);
    GM_setValue('maxVisitsStored', settings.maxVisitsStored);
  }

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

    // Clean search URLs before other normalizations (must be done first)
    if (CONFIG.NORMALIZE_URL.CLEAN_SEARCH_URLS) {
      normalized = cleanSearchUrl(normalized);
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

    // Remove query parameters if configured (after search cleaning)
    if (CONFIG.NORMALIZE_URL.REMOVE_QUERY) {
      normalized = normalized.split('?')[0];
    }

    if (CONFIG.DEBUG) {
      console.log(`🔗 URL normalized: "${url}" → "${normalized}"`);
    }

    return normalized;
  }

  // Check if URL should be skipped from tracking
  function shouldSkipUrl(url) {
    if (!CONFIG.URL_FILTERS.SKIP_UTILITY_PAGES) return false;

    const urlLower = url.toLowerCase();

    // Check against skip patterns
    for (const pattern of CONFIG.URL_FILTERS.SKIP_PATTERNS) {
      if (urlLower.includes(pattern.toLowerCase())) {
        if (CONFIG.DEBUG) {
          console.log(`🚫 Skipping URL (matches pattern "${pattern}"): ${url}`);
        }
        return true;
      }
    }

    return false;
  }

  // Clean search engine URLs to group similar searches
  function cleanSearchUrl(url) {
    if (!CONFIG.NORMALIZE_URL.CLEAN_SEARCH_URLS) return url;

    try {
      const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname;
      const searchParams = new URLSearchParams(urlObj.search);

      // Google Search
      if ((hostname.includes('google.') || hostname === 'google.com') && pathname.includes('/search')) {
        const query = searchParams.get('q');
        if (query) {
          // Keep only the main query, remove tracking params
          const cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${pathname}?q=${encodeURIComponent(query)}`;
          if (CONFIG.DEBUG) {
            console.log(`🔍 Cleaned Google search: "${url}" → "${cleanUrl}"`);
          }
          return cleanUrl;
        }
      }

      // Bing Search
      else if (hostname.includes('bing.com') && pathname.includes('/search')) {
        const query = searchParams.get('q');
        if (query) {
          const cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${pathname}?q=${encodeURIComponent(query)}`;
          if (CONFIG.DEBUG) {
            console.log(`🔍 Cleaned Bing search: "${url}" → "${cleanUrl}"`);
          }
          return cleanUrl;
        }
      }

      // DuckDuckGo Search
      else if (hostname.includes('duckduckgo.com')) {
        const query = searchParams.get('q');
        if (query) {
          const cleanUrl = `${urlObj.protocol}//${urlObj.hostname}/?q=${encodeURIComponent(query)}`;
          if (CONFIG.DEBUG) {
            console.log(`🔍 Cleaned DuckDuckGo search: "${url}" → "${cleanUrl}"`);
          }
          return cleanUrl;
        }
      }

      // YouTube Search
      else if (hostname.includes('youtube.com') && pathname.includes('/results')) {
        const query = searchParams.get('search_query');
        if (query) {
          const cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${pathname}?search_query=${encodeURIComponent(query)}`;
          if (CONFIG.DEBUG) {
            console.log(`🔍 Cleaned YouTube search: "${url}" → "${cleanUrl}"`);
          }
          return cleanUrl;
        }
      }
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.warn('Failed to clean search URL:', error);
      }
    }

    return url; // Return original if not a search URL or parsing failed
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

  function getPollingInterval() {
    let interval = CONFIG.POLL_INTERVAL;

    if (CONFIG.POLLING.ADAPTIVE) {
      interval = activityCount > 0
        ? Math.max(2000, Math.floor(CONFIG.POLL_INTERVAL / 2))
        : CONFIG.POLL_INTERVAL * 2;
      activityCount = Math.max(0, activityCount - 1);
    }

    return interval;
  }

  function scheduleNextPoll() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
    }

    pollTimer = window.setTimeout(() => {
      pollTimer = null;
      directPoll();

      if (!CONFIG.POLLING.PAUSE_WHEN_HIDDEN || !document.hidden) {
        scheduleNextPoll();
      }
    }, getPollingInterval());
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
      onUrlChange(pendingUrlChange);
    }

    // Only process if URL actually changed and enough time has passed
    if (currentHref !== lastHref && (now - lastCheck) >= 1000) {
      if (CONFIG.DEBUG) {
        console.log(`🔄 Polling detected URL change: ${lastHref} → ${currentHref}`);
      }
      onUrlChange(currentHref);
    }
  }

  function startPolling() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
    }

    scheduleNextPoll();
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
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

  function getCleanupThreshold() {
    return Math.max(CONFIG.MAX_URLS_STORED + 1, Math.ceil(CONFIG.MAX_URLS_STORED * 1.2));
  }

  function trimDbToMaxUrls(dbData, maxUrls) {
    const urlKeys = Object.keys(dbData);
    if (urlKeys.length <= maxUrls) {
      return dbData;
    }

    // Calculate score for each URL (visits * recency)
    const scored = urlKeys.map(url => {
      const data = dbData[url];
      const recentVisit = data.visits?.[0] ?? 0;
      const daysSinceVisit = (Date.now() - recentVisit) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 30 - daysSinceVisit) / 30;
      const score = data.count * (1 + recencyScore);
      return { url, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const keepUrls = scored.slice(0, maxUrls);

    const cleanDb = {};
    for (const { url } of keepUrls) {
      cleanDb[url] = dbData[url];
    }

    return cleanDb;
  }

  // Smart cleanup to maintain database size with performance optimization
  // Uses Web Worker for heavy computation to avoid blocking UI
  async function cleanupOldUrls(db) {
    const urls = Object.keys(db);
    if (urls.length <= CONFIG.MAX_URLS_STORED) return db;

    if (CONFIG.DEBUG) {
      console.log(`🧹 Large database cleanup: ${urls.length} → ${CONFIG.MAX_URLS_STORED} URLs`);
    }

    // Try Web Worker for large databases
    if (CONFIG.WEB_WORKER.ENABLED && urls.length > 5000 && typeof Worker !== 'undefined') {
      try {
        return await runCleanupInWorker(db, CONFIG.MAX_URLS_STORED);
      } catch (error) {
        if (CONFIG.DEBUG) {
          console.warn('🔧 Web Worker cleanup failed, falling back to main thread:', error);
        }
        // Fallback to main thread
      }
    }

    // Use requestIdleCallback for medium databases, or run directly for small ones
    if (window.requestIdleCallback && urls.length > 3000) {
      return new Promise(resolve => {
        requestIdleCallback(() => {
          resolve(trimDbToMaxUrls(db, CONFIG.MAX_URLS_STORED));
        }, { timeout: 10000 });
      });
    }

    return trimDbToMaxUrls(db, CONFIG.MAX_URLS_STORED);
  }

  // Web Worker implementation for cleanup (runs in separate thread)
  function runCleanupInWorker(db, maxUrls) {
    return new Promise((resolve, reject) => {
      // Create worker code as a Blob (works in userscript context)
      const workerCode = `
        self.onmessage = function(e) {
          const { db, maxUrls } = e.data;
          const urls = Object.keys(db);
          
          // Calculate scores
          const scored = urls.map(url => {
            const data = db[url];
            const recentVisit = data.visits?.[0] ?? 0;
            const daysSinceVisit = (Date.now() - recentVisit) / (1000 * 60 * 60 * 24);
            const recencyScore = Math.max(0, 30 - daysSinceVisit) / 30;
            const score = data.count * (1 + recencyScore);
            return { url, score };
          });
          
          // Sort and keep top URLs
          scored.sort((a, b) => b.score - a.score);
          const keepUrls = scored.slice(0, maxUrls);
          
          // Build clean database
          const cleanDb = {};
          for (const { url } of keepUrls) {
            cleanDb[url] = db[url];
          }
          
          self.postMessage(cleanDb);
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      // Timeout handler
      const timeoutId = setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        reject(new Error('Worker timeout'));
      }, CONFIG.WEB_WORKER.TIMEOUT);

      worker.onmessage = (e) => {
        clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);

        if (CONFIG.DEBUG) {
          console.log('🔧 Web Worker cleanup completed successfully');
        }
        resolve(e.data);
      };

      worker.onerror = (error) => {
        clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        reject(error);
      };

      // Send data to worker
      worker.postMessage({ db, maxUrls });
    });
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

  // Debounce state for setDB
  let pendingDbWrite = null;
  let debounceTimer = null;

  async function prepareDbForPersistence(db) {
    let nextDb = db;

    if (Object.keys(nextDb).length > getCleanupThreshold()) {
      nextDb = await cleanupOldUrls(nextDb);
    }

    dbCache = nextDb;
    cacheValid = true;
    return nextDb;
  }

  function prepareDbForPersistenceSync(db) {
    let nextDb = db;

    if (Object.keys(nextDb).length > getCleanupThreshold()) {
      nextDb = trimDbToMaxUrls(nextDb, CONFIG.MAX_URLS_STORED);
    }

    dbCache = nextDb;
    cacheValid = true;
    return nextDb;
  }

  // Internal function to actually write to storage
  async function _persistDB(db) {
    try {
      db = await prepareDbForPersistence(db);

      // Persist to storage
      GM_setValue('visitDB', db);

      if (CONFIG.DEBUG) {
        console.log('💾 Database persisted to storage');
      }
    } catch (error) {
      console.warn('Failed to save visit database:', error);
      // Invalidate cache on save failure
      cacheValid = false;
    }
  }

  // Debounced setDB - batches rapid writes
  async function setDB(db) {
    // Always update cache immediately for fast reads
    dbCache = db;
    cacheValid = true;

    if (CONFIG.DEBOUNCE.ENABLED) {
      // Store pending write
      pendingDbWrite = db;

      // Clear existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Schedule debounced write
      debounceTimer = setTimeout(async () => {
        if (pendingDbWrite) {
          const dataToWrite = pendingDbWrite;
          pendingDbWrite = null;
          debounceTimer = null;
          await _persistDB(dataToWrite);
        }
      }, CONFIG.DEBOUNCE.DELAY);
    } else {
      // No debounce - write immediately
      await _persistDB(db);
    }
  }

  // Force flush pending writes (call before page unload)
  function flushPendingWrites() {
    if (pendingDbWrite) {
      if (CONFIG.DEBUG) {
        console.log('💾 Flushing pending database writes');
      }
      // Clear timer and write synchronously
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      try {
        const dataToWrite = prepareDbForPersistenceSync(pendingDbWrite);
        GM_setValue('visitDB', dataToWrite);
      } catch (error) {
        console.warn('Failed to flush pending writes:', error);
      }
      pendingDbWrite = null;
    }
  }

  let currentUrl = normalizeUrl(location.href);

  function getLocationState(href = location.href) {
    return {
      href,
      normalizedUrl: normalizeUrl(href),
      shouldTrack: !shouldSkipUrl(href)
    };
  }

  function clearPendingUrlChange() {
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
    pendingUrlChange = null;
  }

  function commitLocationChange(locationState, { forceTrack = false, timestamp = Date.now() } = {}) {
    const previousUrl = currentUrl;
    const nextUrl = locationState.normalizedUrl;
    const hasUrlChanged = forceTrack || nextUrl !== previousUrl;

    currentUrl = nextUrl;
    lastHref = locationState.href;
    lastCheck = timestamp;

    if (!hasUrlChanged) {
      return false;
    }

    if (!locationState.shouldTrack) {
      if (CONFIG.DEBUG) {
        console.log(`🚫 Skipping URL tracking: ${locationState.href}`);
      }
      return false;
    }

    if (CONFIG.POLLING.ADAPTIVE) {
      activityCount = Math.min(10, activityCount + 2);
    }

    if (CONFIG.DEBUG) {
      console.log(`🌐 URL changed: ${previousUrl} → ${nextUrl}`);
    }

    lastUrlChangeTime = timestamp;
    updateVisit(nextUrl);
    return true;
  }

  function updateVisit(urlKey = currentUrl) {
    const db = getDB();
    const now = new Date();
    const timestamp = createTimestamp(now);

    // Use logical assignment and modern destructuring
    db[urlKey] ??= { count: 0, visits: [] };

    const urlData = db[urlKey];
    urlData.count += 1;
    urlData.visits.unshift(timestamp);

    // Trim visits array if needed
    if (urlData.visits.length > CONFIG.MAX_VISITS_STORED) {
      urlData.visits.length = CONFIG.MAX_VISITS_STORED;
    }

    if (CONFIG.DEBUG) {
      const isNew = urlData.count === 1;
      console.log(isNew
        ? `🆕 New URL tracked: ${urlKey}`
        : `🔄 URL revisited: ${urlKey} (${urlData.count} times)`
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
    GM_registerMenuCommand('⚙️ Settings', openSettingsPanel);
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
    const locationState = getLocationState(location.href);
    if (!locationState.shouldTrack) {
      alert('Current page is excluded from tracking, so there is no visit data to clear.');
      return;
    }

    if (confirm(`Clear visit data for current page?\n\nURL: ${locationState.normalizedUrl}\nThis will only affect this page.`)) {
      const db = getDB();

      // Clear old data and immediately set new entry in single operation
      const now = new Date();
      const timestamp = createTimestamp(now);
      currentUrl = locationState.normalizedUrl;
      db[currentUrl] = { count: 1, visits: [timestamp] };
      setDB(db);

      // Update UI immediately with new data
      renderBadge(db[currentUrl]);

      alert('Current page data cleared! Counter reset to 1.');
    }
  }

  function clearAllData() {
    if (confirm('⚠️ WARNING: This will clear ALL visit data from ALL websites!\n\nAre you absolutely sure?')) {
      const locationState = getLocationState(location.href);
      const newDb = {};

      if (locationState.shouldTrack) {
        const now = new Date();
        const timestamp = createTimestamp(now);
        currentUrl = locationState.normalizedUrl;
        newDb[currentUrl] = { count: 1, visits: [timestamp] };
        setDB(newDb);
        renderBadge(newDb[currentUrl]);
        alert('All visit data cleared! Current page counter reset to 1.');
        return;
      }

      setDB(newDb);
      const badge = document.getElementById('vt-hover-badge');
      if (badge) {
        badge.remove();
      }

      alert('All visit data cleared. The current page is excluded from tracking, so no new entry was created.');
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
      persistSettings();
    } catch (error) {
      console.warn('Failed to save badge visibility state:', error);
    }
  }

  function toggleUrlFiltering() {
    CONFIG.URL_FILTERS.SKIP_UTILITY_PAGES = !CONFIG.URL_FILTERS.SKIP_UTILITY_PAGES;

    // Save state to GM storage
    try {
      persistSettings();
    } catch (error) {
      console.warn('Failed to save URL filtering state:', error);
    }

    const status = CONFIG.URL_FILTERS.SKIP_UTILITY_PAGES ? 'enabled' : 'disabled';
    alert(`🚫 URL Filtering ${status}!\n\nUtility pages (cookies, auth, etc.) filtering is now ${status}.`);
  }

  function toggleSearchCleaning() {
    CONFIG.NORMALIZE_URL.CLEAN_SEARCH_URLS = !CONFIG.NORMALIZE_URL.CLEAN_SEARCH_URLS;

    // Save state to GM storage
    try {
      persistSettings();
    } catch (error) {
      console.warn('Failed to save search cleaning state:', error);
    }

    const status = CONFIG.NORMALIZE_URL.CLEAN_SEARCH_URLS ? 'enabled' : 'disabled';
    alert(`🔍 Search URL Cleaning ${status}!\n\nSearch URLs will now ${CONFIG.NORMALIZE_URL.CLEAN_SEARCH_URLS ? 'be cleaned (grouped by query)' : 'be tracked as-is (separate tracking)'}.`);
  }

  function toggleDebugMode() {
    CONFIG.DEBUG = !CONFIG.DEBUG;

    // Save state to GM storage
    try {
      persistSettings();
    } catch (error) {
      console.warn('Failed to save debug mode state:', error);
    }

    const status = CONFIG.DEBUG ? 'enabled' : 'disabled';
    alert(`🐛 Debug mode ${status}!\n\nDebug logging is now ${status}.`);

    if (CONFIG.DEBUG) {
      console.log('🐛 Visit Tracker Debug Mode: ENABLED');
    }
  }

  // ============================================
  // SETTINGS PANEL UI
  // ============================================

  let settingsPanel = null;
  let settingsPanelOpen = false;

  function getSettingsPanelStyles() {
    return `
      .vt-settings-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        z-index: 2147483646;
        opacity: 0;
        transition: opacity 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .vt-settings-overlay.visible {
        opacity: 1;
      }
      .vt-settings-panel {
        background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 16px;
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
        width: 480px;
        max-width: 95vw;
        max-height: 85vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transform: scale(0.9) translateY(20px);
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        font-family: system-ui, -apple-system, sans-serif;
      }
      .vt-settings-overlay.visible .vt-settings-panel {
        transform: scale(1) translateY(0);
      }
      .vt-settings-header {
        padding: 20px 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(255, 255, 255, 0.03);
      }
      .vt-settings-title {
        font-size: 18px;
        font-weight: 600;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .vt-settings-title::before {
        content: '⚙️';
        font-size: 20px;
      }
      .vt-settings-close {
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: #fff;
        font-size: 18px;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .vt-settings-close:hover {
        background: rgba(239, 68, 68, 0.8);
        transform: scale(1.05);
      }
      .vt-settings-body {
        padding: 16px 24px;
        overflow-y: auto;
        flex: 1;
      }
      .vt-settings-section {
        margin-bottom: 20px;
      }
      .vt-settings-section:last-child {
        margin-bottom: 0;
      }
      .vt-section-title {
        font-size: 12px;
        font-weight: 600;
        color: #818cf8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .vt-setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 10px;
        margin-bottom: 8px;
        transition: background 0.15s ease;
      }
      .vt-setting-row:hover {
        background: rgba(255, 255, 255, 0.06);
      }
      .vt-setting-label {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .vt-setting-name {
        font-size: 14px;
        color: #e2e8f0;
        font-weight: 500;
      }
      .vt-setting-desc {
        font-size: 11px;
        color: #64748b;
      }
      .vt-toggle {
        position: relative;
        width: 44px;
        height: 24px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .vt-toggle.active {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      }
      .vt-toggle::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.2s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      .vt-toggle.active::after {
        transform: translateX(20px);
      }
      .vt-input-number {
        width: 80px;
        padding: 6px 10px;
        background: rgba(30, 30, 50, 0.9) !important;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        color: #ffffff !important;
        font-size: 13px;
        font-weight: 500;
        text-align: center;
        transition: all 0.15s ease;
        -webkit-appearance: textfield;
        -moz-appearance: textfield;
        appearance: textfield;
      }
      .vt-input-number::-webkit-outer-spin-button,
      .vt-input-number::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .vt-input-number:focus {
        outline: none;
        border-color: #6366f1;
        background: rgba(99, 102, 241, 0.2) !important;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
      }
      .vt-settings-footer {
        padding: 16px 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        gap: 12px;
        background: rgba(0, 0, 0, 0.2);
      }
      .vt-btn {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .vt-btn-primary {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: #fff;
      }
      .vt-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
      }
      .vt-btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: #e2e8f0;
      }
      .vt-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.15);
      }
      .vt-toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #fff;
        padding: 12px 24px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        z-index: 2147483647;
        opacity: 0;
        transition: all 0.3s ease;
      }
      .vt-toast.visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    `;
  }

  function createSettingsPanel() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'vt-settings-overlay';
    overlay.id = 'vt-settings-overlay';

    // Create panel HTML
    overlay.innerHTML = `
      <div class="vt-settings-panel">
        <div class="vt-settings-header">
          <div class="vt-settings-title">URL Visit Tracker Settings</div>
          <button class="vt-settings-close" id="vt-close-settings">✕</button>
        </div>
        <div class="vt-settings-body">
          <!-- General Section -->
          <div class="vt-settings-section">
            <div class="vt-section-title">🎯 General</div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Show Badge</span>
                <span class="vt-setting-desc">Display visit counter badge on screen</span>
              </div>
              <div class="vt-toggle ${badgeVisible ? 'active' : ''}" data-setting="badgeVisible"></div>
            </div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Debug Mode</span>
                <span class="vt-setting-desc">Enable console logging for debugging</span>
              </div>
              <div class="vt-toggle ${CONFIG.DEBUG ? 'active' : ''}" data-setting="debug"></div>
            </div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Hover Delay</span>
                <span class="vt-setting-desc">Delay before showing tooltip (ms)</span>
              </div>
              <input type="number" class="vt-input-number" value="${CONFIG.HOVER_DELAY}" data-setting="hoverDelay" min="0" max="5000" step="100">
            </div>
          </div>

          <!-- URL Normalization Section -->
          <div class="vt-settings-section">
            <div class="vt-section-title">🔗 URL Normalization</div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Remove Query Params</span>
                <span class="vt-setting-desc">Ignore ?key=value in URLs</span>
              </div>
              <div class="vt-toggle ${CONFIG.NORMALIZE_URL.REMOVE_QUERY ? 'active' : ''}" data-setting="removeQuery"></div>
            </div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Remove Hash</span>
                <span class="vt-setting-desc">Ignore #section in URLs</span>
              </div>
              <div class="vt-toggle ${CONFIG.NORMALIZE_URL.REMOVE_HASH ? 'active' : ''}" data-setting="removeHash"></div>
            </div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Clean Search URLs</span>
                <span class="vt-setting-desc">Group search results by query</span>
              </div>
              <div class="vt-toggle ${CONFIG.NORMALIZE_URL.CLEAN_SEARCH_URLS ? 'active' : ''}" data-setting="cleanSearchUrls"></div>
            </div>
          </div>

          <!-- URL Filtering Section -->
          <div class="vt-settings-section">
            <div class="vt-section-title">🚫 URL Filtering</div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Skip Utility Pages</span>
                <span class="vt-setting-desc">Don't track login, cookie pages, etc.</span>
              </div>
              <div class="vt-toggle ${CONFIG.URL_FILTERS.SKIP_UTILITY_PAGES ? 'active' : ''}" data-setting="skipUtilityPages"></div>
            </div>
          </div>

          <!-- Performance Section -->
          <div class="vt-settings-section">
            <div class="vt-section-title">⚡ Performance</div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Debounce Writes</span>
                <span class="vt-setting-desc">Batch database writes for better performance</span>
              </div>
              <div class="vt-toggle ${CONFIG.DEBOUNCE.ENABLED ? 'active' : ''}" data-setting="debounceEnabled"></div>
            </div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Debounce Delay</span>
                <span class="vt-setting-desc">Delay before writing to storage (ms)</span>
              </div>
              <input type="number" class="vt-input-number" value="${CONFIG.DEBOUNCE.DELAY}" data-setting="debounceDelay" min="100" max="5000" step="100">
            </div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Use Web Worker</span>
                <span class="vt-setting-desc">Run cleanup in background thread</span>
              </div>
              <div class="vt-toggle ${CONFIG.WEB_WORKER.ENABLED ? 'active' : ''}" data-setting="webWorkerEnabled"></div>
            </div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Pause When Hidden</span>
                <span class="vt-setting-desc">Stop polling when tab is not visible</span>
              </div>
              <div class="vt-toggle ${CONFIG.POLLING.PAUSE_WHEN_HIDDEN ? 'active' : ''}" data-setting="pauseWhenHidden"></div>
            </div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Adaptive Polling</span>
                <span class="vt-setting-desc">Adjust polling frequency based on activity</span>
              </div>
              <div class="vt-toggle ${CONFIG.POLLING.ADAPTIVE ? 'active' : ''}" data-setting="adaptivePolling"></div>
            </div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Poll Interval</span>
                <span class="vt-setting-desc">URL change check interval (ms)</span>
              </div>
              <input type="number" class="vt-input-number" value="${CONFIG.POLL_INTERVAL}" data-setting="pollInterval" min="1000" max="30000" step="1000">
            </div>
          </div>

          <!-- Storage Section -->
          <div class="vt-settings-section">
            <div class="vt-section-title">💾 Storage</div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Max URLs Stored</span>
                <span class="vt-setting-desc">Maximum number of URLs to track</span>
              </div>
              <input type="number" class="vt-input-number" value="${CONFIG.MAX_URLS_STORED}" data-setting="maxUrlsStored" min="1000" max="50000" step="1000">
            </div>
            <div class="vt-setting-row">
              <div class="vt-setting-label">
                <span class="vt-setting-name">Max Visits per URL</span>
                <span class="vt-setting-desc">Visit timestamps to keep per URL</span>
              </div>
              <input type="number" class="vt-input-number" value="${CONFIG.MAX_VISITS_STORED}" data-setting="maxVisitsStored" min="5" max="100" step="5">
            </div>
          </div>
        </div>
        <div class="vt-settings-footer">
          <button class="vt-btn vt-btn-secondary" id="vt-reset-settings">Reset to Defaults</button>
          <button class="vt-btn vt-btn-primary" id="vt-save-settings">Save Settings</button>
        </div>
      </div>
    `;

    return overlay;
  }

  function openSettingsPanel() {
    if (settingsPanelOpen) return;

    // Add styles if not already added
    if (!document.getElementById('vt-settings-styles')) {
      const style = document.createElement('style');
      style.id = 'vt-settings-styles';
      style.textContent = getSettingsPanelStyles();
      document.head.appendChild(style);
    }

    // Create and add panel
    settingsPanel = createSettingsPanel();
    document.body.appendChild(settingsPanel);
    settingsPanelOpen = true;

    // Trigger animation
    requestAnimationFrame(() => {
      settingsPanel.classList.add('visible');
    });

    // Add event listeners
    setupSettingsEventListeners();
  }

  // ESC key handler for settings panel (moved outside for proper cleanup)
  let settingsEscHandler = null;

  function closeSettingsPanel() {
    if (!settingsPanel || !settingsPanelOpen) return;

    // Remove ESC handler to prevent memory leak
    if (settingsEscHandler) {
      document.removeEventListener('keydown', settingsEscHandler);
      settingsEscHandler = null;
    }

    settingsPanel.classList.remove('visible');

    setTimeout(() => {
      if (settingsPanel && settingsPanel.parentNode) {
        settingsPanel.parentNode.removeChild(settingsPanel);
      }
      settingsPanel = null;
      settingsPanelOpen = false;
    }, 200);
  }

  function setupSettingsEventListeners() {
    // Close button
    document.getElementById('vt-close-settings').addEventListener('click', closeSettingsPanel);

    // Click outside to close
    settingsPanel.addEventListener('click', (e) => {
      if (e.target === settingsPanel) {
        closeSettingsPanel();
      }
    });

    // ESC key to close - use the outer variable for proper cleanup
    settingsEscHandler = (e) => {
      if (e.key === 'Escape' && settingsPanelOpen) {
        closeSettingsPanel();
      }
    };
    document.addEventListener('keydown', settingsEscHandler);

    // Toggle switches
    settingsPanel.querySelectorAll('.vt-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
      });
    });

    // Save button
    document.getElementById('vt-save-settings').addEventListener('click', saveSettings);

    // Reset button
    document.getElementById('vt-reset-settings').addEventListener('click', resetSettings);
  }

  function saveSettings() {
    try {
      // Read all settings from UI
      const getToggle = (name) => settingsPanel.querySelector(`[data-setting="${name}"]`).classList.contains('active');
      const getNumber = (name) => settingsPanel.querySelector(`[data-setting="${name}"]`).value;

      const settings = buildValidatedSettings({
        badgeVisible: getToggle('badgeVisible'),
        debugMode: getToggle('debug'),
        hoverDelay: getNumber('hoverDelay'),
        removeQuery: getToggle('removeQuery'),
        removeHash: getToggle('removeHash'),
        cleanSearchUrls: getToggle('cleanSearchUrls'),
        skipUtilityPages: getToggle('skipUtilityPages'),
        debounceEnabled: getToggle('debounceEnabled'),
        debounceDelay: getNumber('debounceDelay'),
        webWorkerEnabled: getToggle('webWorkerEnabled'),
        pauseWhenHidden: getToggle('pauseWhenHidden'),
        adaptivePolling: getToggle('adaptivePolling'),
        pollInterval: getNumber('pollInterval'),
        maxUrlsStored: getNumber('maxUrlsStored'),
        maxVisitsStored: getNumber('maxVisitsStored')
      });

      applySettings(settings);
      currentUrl = normalizeUrl(location.href);
      lastHref = location.href;
      persistSettings(settings);

      // Update badge visibility
      const badge = document.getElementById('vt-hover-badge');
      if (badge) {
        badge.classList.toggle('hidden', !badgeVisible);
      }

      // Restart polling with new settings
      stopPolling();
      startPolling();

      // Show success toast
      showToast('✅ Settings saved successfully!');

      // Close panel
      closeSettingsPanel();

    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('❌ Failed to save settings');
    }
  }

  function resetSettings() {
    if (!confirm('Reset all settings to default values?')) return;

    const defaults = {
      badgeVisible: DEFAULT_SETTINGS.badgeVisible,
      debug: DEFAULT_SETTINGS.debugMode,
      hoverDelay: DEFAULT_SETTINGS.hoverDelay,
      removeQuery: DEFAULT_SETTINGS.removeQuery,
      removeHash: DEFAULT_SETTINGS.removeHash,
      cleanSearchUrls: DEFAULT_SETTINGS.cleanSearchUrls,
      skipUtilityPages: DEFAULT_SETTINGS.skipUtilityPages,
      debounceEnabled: DEFAULT_SETTINGS.debounceEnabled,
      debounceDelay: DEFAULT_SETTINGS.debounceDelay,
      webWorkerEnabled: DEFAULT_SETTINGS.webWorkerEnabled,
      pauseWhenHidden: DEFAULT_SETTINGS.pauseWhenHidden,
      adaptivePolling: DEFAULT_SETTINGS.adaptivePolling,
      pollInterval: DEFAULT_SETTINGS.pollInterval,
      maxUrlsStored: DEFAULT_SETTINGS.maxUrlsStored,
      maxVisitsStored: DEFAULT_SETTINGS.maxVisitsStored
    };

    // Update UI
    Object.entries(defaults).forEach(([key, value]) => {
      const element = settingsPanel.querySelector(`[data-setting="${key}"]`);
      if (element) {
        if (element.classList.contains('vt-toggle')) {
          element.classList.toggle('active', value);
        } else {
          element.value = value;
        }
      }
    });

    showToast('🔄 Settings reset to defaults');
  }

  function showToast(message) {
    // Remove existing toast
    const existingToast = document.querySelector('.vt-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'vt-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // Load all saved settings on initialization
  function loadSavedSettings() {
    try {
      const settings = buildValidatedSettings({
        badgeVisible: GM_getValue('badgeVisible', DEFAULT_SETTINGS.badgeVisible),
        debugMode: GM_getValue('debugMode', DEFAULT_SETTINGS.debugMode),
        hoverDelay: GM_getValue('hoverDelay', DEFAULT_SETTINGS.hoverDelay),
        removeQuery: GM_getValue('removeQuery', DEFAULT_SETTINGS.removeQuery),
        removeHash: GM_getValue('removeHash', DEFAULT_SETTINGS.removeHash),
        cleanSearchUrls: GM_getValue('searchCleaning', DEFAULT_SETTINGS.cleanSearchUrls),
        skipUtilityPages: GM_getValue('urlFiltering', DEFAULT_SETTINGS.skipUtilityPages),
        debounceEnabled: GM_getValue('debounceEnabled', DEFAULT_SETTINGS.debounceEnabled),
        debounceDelay: GM_getValue('debounceDelay', DEFAULT_SETTINGS.debounceDelay),
        webWorkerEnabled: GM_getValue('webWorkerEnabled', DEFAULT_SETTINGS.webWorkerEnabled),
        pauseWhenHidden: GM_getValue('pauseWhenHidden', DEFAULT_SETTINGS.pauseWhenHidden),
        adaptivePolling: GM_getValue('adaptivePolling', DEFAULT_SETTINGS.adaptivePolling),
        pollInterval: GM_getValue('pollInterval', DEFAULT_SETTINGS.pollInterval),
        maxUrlsStored: GM_getValue('maxUrlsStored', DEFAULT_SETTINGS.maxUrlsStored),
        maxVisitsStored: GM_getValue('maxVisitsStored', DEFAULT_SETTINGS.maxVisitsStored)
      });

      applySettings(settings);
      currentUrl = normalizeUrl(location.href);
      lastHref = location.href;
    } catch (error) {
      console.warn('Failed to load saved settings:', error);
    }
  }

  // Rate limiting for URL changes with pending mechanism
  let lastUrlChangeTime = 0;
  let pendingUrlChange = null;
  let pendingTimeout = null;
  const URL_CHANGE_MIN_INTERVAL = 500; // Minimum 500ms between URL changes

  function onUrlChange(href = location.href, options = {}) {
    const now = Date.now();
    const locationState = getLocationState(href);

    if (!options.forceTrack && locationState.normalizedUrl === currentUrl) {
      lastHref = href;
      lastCheck = now;
      return false;
    }

    if (!locationState.shouldTrack) {
      clearPendingUrlChange();
      return commitLocationChange(locationState, { forceTrack: options.forceTrack, timestamp: now });
    }

    const timeSinceLastChange = now - lastUrlChangeTime;

    if (!options.forceTrack && timeSinceLastChange < URL_CHANGE_MIN_INTERVAL) {
      if (CONFIG.DEBUG) {
        console.log(`⏰ URL change rate limited, scheduling: ${currentUrl} → ${locationState.normalizedUrl}`);
      }

      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
      }
      pendingUrlChange = href;
      const remainingTime = URL_CHANGE_MIN_INTERVAL - timeSinceLastChange;
      pendingTimeout = setTimeout(() => {
        const pendingHref = pendingUrlChange;
        clearPendingUrlChange();

        if (pendingHref) {
          if (CONFIG.DEBUG) {
            console.log(`⏰ Processing pending URL change: ${currentUrl} → ${normalizeUrl(pendingHref)}`);
          }
          onUrlChange(pendingHref);
        }
      }, remainingTime + 10); // +10ms buffer

      return false;
    }

    clearPendingUrlChange();
    return commitLocationChange(locationState, { forceTrack: options.forceTrack, timestamp: now });
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

    // Optimized MutationObserver with focused title tracking
    let mutationTimeout = null;
    const mo = new MutationObserver((mutations) => {
      // Throttle mutation processing to avoid spam
      if (mutationTimeout) return;

      mutationTimeout = setTimeout(() => {
        mutationTimeout = null;
        let titleChanged = false;

        for (const mutation of mutations) {
          // Only check mutations that could affect title
          if (mutation.type === 'childList') {
            // Case 1: Title element added/removed from head
            const titleInAdded = Array.from(mutation.addedNodes).some(node =>
              node.nodeName === 'TITLE'
            );
            const titleInRemoved = Array.from(mutation.removedNodes).some(node =>
              node.nodeName === 'TITLE'
            );

            // Case 2: Direct title element changes
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

          // Case 3: Character data changed in title's text nodes (more targeted)
          else if (mutation.type === 'characterData' &&
            mutation.target.parentNode?.nodeName === 'TITLE') {
            titleChanged = true;
            if (CONFIG.DEBUG) {
              console.log('📝 Title characterData mutation detected:', mutation);
            }
            break;
          }
        }

        if (titleChanged) {
          if (CONFIG.DEBUG) {
            console.log('📝 Title change detected, triggering URL change check');
          }
          onUrlChange();
        }
      }, 150); // Slightly increased debounce for better performance
    });

    // Safely observe document.head with focused title tracking
    if (document.head) {
      mo.observe(document.head, {
        childList: true,      // Detect title element addition/removal
        subtree: false,       // Only direct children for better performance
        characterData: false  // Handle characterData separately for title only
      });

      // Separate observer for title content changes
      const titleEl = document.querySelector('title');
      if (titleEl) {
        mo.observe(titleEl, {
          childList: true,
          characterData: true,
          subtree: true
        });
      }
    } else {
      // Fallback: observe document for head creation (minimal scope)
      mo.observe(document, {
        childList: true,
        subtree: false
      });
    }

    // Initialize polling
    startPolling();
  }

  // Lazy tooltip initialization - only create when first needed
  let tooltip = null;
  let tooltipInitialized = false;

  // Create and initialize tooltip element (called lazily on first hover)
  function initializeTooltip() {
    if (tooltipInitialized) return tooltip;

    tooltip = document.createElement('div');
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

    // Append to DOM
    if (document.body) {
      try {
        document.body.appendChild(tooltip);
        tooltipInitialized = true;
        if (CONFIG.DEBUG) {
          console.log('📋 Tooltip initialized lazily on first hover');
        }
      } catch (error) {
        console.warn('Failed to append tooltip to body:', error);
      }
    } else {
      // Fallback for early DOM state (shouldn't happen with lazy init)
      document.addEventListener('DOMContentLoaded', () => {
        try {
          if (document.body && !document.body.contains(tooltip)) {
            document.body.appendChild(tooltip);
            tooltipInitialized = true;
          }
        } catch (error) {
          console.warn('Failed to append tooltip on DOMContentLoaded:', error);
        }
      }, { passive: true, once: true });
    }

    return tooltip;
  }

  // Get tooltip element, initializing if needed
  function getTooltip() {
    if (!tooltipInitialized) {
      initializeTooltip();
    }
    return tooltip;
  }

  let hoverTimer;
  let currentHoveredLink = null;
  let rafId = null; // RequestAnimationFrame ID for smooth tooltip movement
  let pendingTooltipPosition = null; // Store pending position updates
  let tooltipAutoHideTimer = null; // Auto-hide timer to prevent stuck tooltips
  let tooltipValidationTimer = null; // Timer to validate tooltip state
  let lastMousePosition = { x: 0, y: 0 }; // Track last mouse position

  // Configuration for tooltip anti-stick measures
  const TOOLTIP_CONFIG = {
    AUTO_HIDE_DELAY: 10000,   // Auto-hide after 10 seconds
    VALIDATION_INTERVAL: 500, // Check every 500ms if tooltip should still be visible
    STALE_THRESHOLD: 2000     // Consider tooltip stale if no mouse movement for 2s
  };

  function showTooltip(e, linkUrl) {
    // Initialize tooltip lazily on first use
    const tip = getTooltip();
    if (!tip) return; // Safety check

    const key = normalizeUrl(linkUrl);
    // Use cached DB for hot path performance - no storage I/O!
    const db = getDBCached();
    const data = db[key];

    // Clear previous content safely
    tip.textContent = '';

    if (!data) {
      tip.textContent = 'No visits recorded';
    } else {
      // Create elements safely instead of using innerHTML
      const visitLine = document.createElement('div');
      visitLine.textContent = `Visit: ${shortenNumber(data.count)}`;

      const lastLine = document.createElement('div');
      // Format timestamp for display using optional chaining
      const lastVisit = data.visits?.[0] ? formatTimestamp(data.visits[0]) : 'Never';
      lastLine.textContent = `Last: ${lastVisit}`;

      tip.appendChild(visitLine);
      tip.appendChild(lastLine);
    }

    // Set initial position
    updateTooltipPosition(e.clientX, e.clientY);
    tip.style.opacity = 1;

    // Start auto-hide timer as safety net
    startAutoHideTimer();

    // Start validation timer to check if tooltip should still be visible
    startValidationTimer();
  }

  // Auto-hide timer - safety net to prevent stuck tooltips
  function startAutoHideTimer() {
    clearAutoHideTimer();
    tooltipAutoHideTimer = setTimeout(() => {
      if (CONFIG.DEBUG) {
        console.log('⏰ Tooltip auto-hide triggered after timeout');
      }
      hideTooltip();
    }, TOOLTIP_CONFIG.AUTO_HIDE_DELAY);
  }

  function clearAutoHideTimer() {
    if (tooltipAutoHideTimer) {
      clearTimeout(tooltipAutoHideTimer);
      tooltipAutoHideTimer = null;
    }
  }

  // Validation timer - periodically check if tooltip should still be visible
  function startValidationTimer() {
    clearValidationTimer();
    tooltipValidationTimer = setInterval(() => {
      if (!validateTooltipState()) {
        if (CONFIG.DEBUG) {
          console.log('🔍 Tooltip validation failed, hiding tooltip');
        }
        hideTooltip();
      }
    }, TOOLTIP_CONFIG.VALIDATION_INTERVAL);
  }

  function clearValidationTimer() {
    if (tooltipValidationTimer) {
      clearInterval(tooltipValidationTimer);
      tooltipValidationTimer = null;
    }
  }

  // Validate if tooltip should still be visible
  function validateTooltipState() {
    // No link being tracked - tooltip shouldn't be visible
    if (!currentHoveredLink) {
      return false;
    }

    // Link was removed from DOM
    if (!document.body.contains(currentHoveredLink)) {
      if (CONFIG.DEBUG) {
        console.log('🔗 Link removed from DOM, invalidating tooltip');
      }
      return false;
    }

    // Check if mouse is still over the link using elementFromPoint
    const elementAtMouse = document.elementFromPoint(lastMousePosition.x, lastMousePosition.y);
    if (elementAtMouse) {
      const linkAtMouse = safeClosest(elementAtMouse, 'a[href]');
      if (linkAtMouse !== currentHoveredLink) {
        if (CONFIG.DEBUG) {
          console.log('🔗 Mouse no longer over tracked link');
        }
        return false;
      }
    }

    return true;
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
        const tip = getTooltip();
        if (tip) {
          tip.style.left = pendingTooltipPosition.x + 'px';
          tip.style.top = pendingTooltipPosition.y + 'px';
        }
        pendingTooltipPosition = null;
      }
      rafId = null;
    });
  }

  function hideTooltip() {
    const tip = getTooltip();
    if (tip) {
      tip.style.opacity = 0;
    }
    currentHoveredLink = null;

    // Cancel any pending animation frame
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pendingTooltipPosition = null;

    // Clear all timers
    clearAutoHideTimer();
    clearValidationTimer();

    // Ensure mousemove listener is properly removed
    document.removeEventListener('mousemove', moveTooltip);
  }

  function moveTooltip(e) {
    // Track mouse position for validation
    lastMousePosition.x = e.clientX;
    lastMousePosition.y = e.clientY;

    // Reset auto-hide timer on mouse movement (user is still active)
    startAutoHideTimer();

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

    // Track initial mouse position
    lastMousePosition.x = e.clientX;
    lastMousePosition.y = e.clientY;

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

  // Additional safety: hide tooltip when clicking anywhere
  document.addEventListener('click', () => {
    if (currentHoveredLink) {
      clearTimeout(hoverTimer);
      hideTooltip();
    }
  }, { passive: true });

  // Additional safety: hide tooltip when scrolling
  document.addEventListener('scroll', () => {
    if (currentHoveredLink) {
      clearTimeout(hoverTimer);
      hideTooltip();
    }
  }, { passive: true, capture: true });

  // Initialize the tracker
  function initializeTracker() {
    // Load all saved settings
    loadSavedSettings();

    if (CONFIG.DEBUG) {
      console.log('🐛 Visit Tracker Debug Mode: ENABLED');
    }

    // Don't register menu for initial empty state - let updateVisit() handle it
    commitLocationChange(getLocationState(location.href), { forceTrack: true });
    installUrlObservers();

    // Handle polling optimization
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Tab became hidden - pause polling if configured
        if (CONFIG.POLLING.PAUSE_WHEN_HIDDEN) {
          stopPolling();
        }
        // Hide tooltip when tab is hidden to prevent stuck tooltips
        if (currentHoveredLink) {
          clearTimeout(hoverTimer);
          hideTooltip();
        }
      } else {
        // Tab became visible - resume polling if it was paused
        if (CONFIG.POLLING.PAUSE_WHEN_HIDDEN && !pollTimer) {
          // Boost activity for immediate responsiveness when tab becomes visible
          if (CONFIG.POLLING.ADAPTIVE) {
            activityCount = Math.min(10, activityCount + 3);
          }
          startPolling();
        }
      }
    }, { passive: true });
  }

  // Cleanup pending operations on page unload
  window.addEventListener('beforeunload', () => {
    // Flush any pending debounced database writes
    flushPendingWrites();

    if (pendingTimeout || pendingUrlChange) {
      const pendingHref = pendingUrlChange;
      clearPendingUrlChange();
      if (pendingHref) {
        commitLocationChange(getLocationState(pendingHref), { timestamp: Date.now() });
        // Flush the new write as well
        flushPendingWrites();
      }
    }
  });

  initializeTracker();

})();
