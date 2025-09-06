// ==UserScript==
// @name         URL Visit Tracker (Improved)
// @namespace    https://github.com/hongmd/userscript-improved
// @version      2.0.2
// @description  Track visits per URL, show corner badge history & link hover info - Massive Capacity (10K URLs)
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

  /*
   * URL Visit Tracker (Improved)
   * 
   * Credits:
   * - Original concept and idea by Chewy
   * - Enhanced and optimized by hongmd
   * 
   * This script builds upon the original vision while adding:
   * - Massive capacity (10K URLs) with smart cleanup
   * - Toggle badge visibility with smooth animations  
   * - RequestAnimationFrame tooltip movement
   * - Advanced storage optimization and performance
   * - Production-ready error handling and edge cases
   */

  // Configuration options
  const CONFIG = {
    MAX_VISITS_STORED: 20,
    MAX_URLS_STORED: 10000,         // Massive capacity for extensive tracking
    CLEANUP_THRESHOLD: 12000,       // Cleanup when exceeding this (20% buffer)
    HOVER_DELAY: 200,
    POLL_INTERVAL: 2000,
    DEBOUNCE_DELAY: 1500,
    BADGE_POSITION: { right: '14px', bottom: '14px' },
    BADGE_VISIBLE: true
  };

  // Badge visibility state
  let badgeVisible = CONFIG.BADGE_VISIBLE;
  let menuRegistered = false; // Flag to prevent duplicate menu registration

  function normalizeUrl(url) {
    // Remove protocol, www, trailing slash, and fragments for better compression
    return url
      .replace(/^https?:\/\//, '')        // Remove protocol
      .replace(/^www\./, '')              // Remove www
      .replace(/\/$/, '')                 // Remove trailing slash
      .split('#')[0]                      // Remove fragments
      .split('?')[0];                     // Remove query params (optional - keeps core path only)
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

  // Smart cleanup to maintain database size
  function cleanupOldUrls(db) {
    const urls = Object.keys(db);
    if (urls.length <= CONFIG.MAX_URLS_STORED) return db;
    
    console.log(`🧹 Large database cleanup: ${urls.length} → ${CONFIG.MAX_URLS_STORED} URLs`);
    
    // Calculate score for each URL (visits * recency)
    const scored = urls.map(url => {
      const data = db[url];
      const recentVisit = data.visits && data.visits.length > 0 ? data.visits[0] : 0;
      const daysSinceVisit = (Date.now() - recentVisit) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 30 - daysSinceVisit) / 30; // 0-1 based on last 30 days
      const score = data.count * (1 + recencyScore); // Visits weighted by recency
      
      return { url, score, count: data.count, lastVisit: recentVisit };
    });
    
    // Keep top 10,000 URLs by score - massive capacity
    scored.sort((a, b) => b.score - a.score);
    const keepUrls = scored.slice(0, CONFIG.MAX_URLS_STORED);
    
    const cleanDb = {};
    keepUrls.forEach(item => {
      cleanDb[item.url] = db[item.url];
    });
    
    const removedCount = urls.length - keepUrls.length;
    console.log(`✅ Cleanup complete: Kept ${keepUrls.length} URLs, removed ${removedCount} low-priority URLs`);
    return cleanDb;
  }

  function shortenNumber(num) {
    if (num >= 1000) return (Math.round(num / 100) / 10) + 'k';
    return String(num);
  }

  function getDB() {
    try {
      return GM_getValue('visitDB', {});
    } catch (error) {
      console.warn('Failed to read visit database:', error);
      return {};
    }
  }

  function setDB(db) {
    try {
      // Auto cleanup if database is getting too large
      if (Object.keys(db).length > CONFIG.CLEANUP_THRESHOLD) {
        db = cleanupOldUrls(db);
      }
      
      GM_setValue('visitDB', db);
    } catch (error) {
      console.warn('Failed to save visit database:', error);
    }
  }

  let currentUrl = normalizeUrl(location.href);

  function updateVisit() {
    const db = getDB();
    const now = new Date();
    const timestamp = createTimestamp(now);

    if (!db[currentUrl]) {
      db[currentUrl] = { count: 1, visits: [timestamp] };
    } else {
      db[currentUrl].count += 1;
      db[currentUrl].visits.unshift(timestamp);
      if (db[currentUrl].visits.length > CONFIG.MAX_VISITS_STORED) {
        db[currentUrl].visits.length = CONFIG.MAX_VISITS_STORED;
      }
    }

    setDB(db);
    renderBadge(db[currentUrl]);
    
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
  }

  function exportData() {
    try {
      const db = getDB();
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
    const db = getDB();
    const urls = Object.keys(db);
    const totalUrls = urls.length;
    
    // Handle empty database
    if (totalUrls === 0) {
      alert('📈 Visit Tracker Statistics\n\n🌐 No websites tracked yet!\n\nStart browsing to collect visit data.');
      return;
    }
    
    const totalVisits = urls.reduce((sum, url) => sum + db[url].count, 0);
    
    // Find most visited site
    const mostVisited = urls.reduce((max, url) => 
      db[url].count > (db[max] ? db[max].count : 0) ? url : max, '');
    
    // Find oldest entry
    const oldestEntry = urls.reduce((oldest, url) => {
      if (!db[url].visits || db[url].visits.length === 0) return oldest;
      const lastVisit = db[url].visits[db[url].visits.length - 1];
      if (!oldest || !db[oldest].visits || db[oldest].visits.length === 0) return url;
      const oldestLastVisit = db[oldest].visits[db[oldest].visits.length - 1];
      return lastVisit < oldestLastVisit ? url : oldest;
    }, '');

    const stats = `
📈 Visit Tracker Statistics

🌐 Total websites tracked: ${totalUrls}
👆 Total visits recorded: ${totalVisits}
🏆 Most visited: ${mostVisited} (${db[mostVisited] ? db[mostVisited].count : 0} visits)
⏰ Oldest tracked site: ${oldestEntry}
📅 Current page visits: ${db[currentUrl] ? db[currentUrl].count : 0}

Database size: ${Math.round(JSON.stringify(db).length / 1024)} KB
    `.trim();
    
    alert(stats);
  }

  function clearCurrentPage() {
    if (confirm(`Clear visit data for current page?\n\nURL: ${currentUrl}\nThis will only affect this page.`)) {
      const db = getDB();
      
      // Delete old data
      delete db[currentUrl];
      setDB(db);
      
      // Immediately create new entry for current visit
      const now = new Date();
      const timestamp = createTimestamp(now);
      const updatedDb = getDB();
      updatedDb[currentUrl] = { count: 1, visits: [timestamp] };
      setDB(updatedDb);
      
      // Update UI immediately with new data
      renderBadge(updatedDb[currentUrl]);
      
      alert('Current page data cleared! Counter reset to 1.');
    }
  }

  function clearAllData() {
    if (confirm('⚠️ WARNING: This will clear ALL visit data from ALL websites!\n\nAre you absolutely sure?')) {
      // Clear all data
      setDB({});
      
      // Immediately create new entry for current page
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

  function onUrlChange() {
    const newUrl = normalizeUrl(location.href);
    if (newUrl === currentUrl) return;
    currentUrl = newUrl;
    updateVisit();
  }

  function installUrlObservers() {
    const _pushState = history.pushState;
    const _replaceState = history.replaceState;
    history.pushState = function () { const r = _pushState.apply(this, arguments); onUrlChange(); return r; };
    history.replaceState = function () { const r = _replaceState.apply(this, arguments); onUrlChange(); return r; };
    window.addEventListener('popstate', onUrlChange);
    window.addEventListener('hashchange', onUrlChange);
    
    // Optimized MutationObserver - only watch for navigation-related changes
    const mo = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.target.tagName === 'TITLE') {
          onUrlChange();
          break;
        }
      }
    });
    
    // Safely observe document.head
    if (document.head) {
      mo.observe(document.head, { childList: true, subtree: true });
    } else {
      // Fallback: observe document for head creation
      mo.observe(document, { childList: true, subtree: true });
    }
    
    // Reduced polling frequency and added debounce
    let lastHref = location.href;
    let pollTimer;
    const debouncedPoll = () => {
      clearTimeout(pollTimer);
      pollTimer = setTimeout(() => {
        if (location.href !== lastHref) { 
          lastHref = location.href; 
          onUrlChange(); 
        }
      }, CONFIG.DEBOUNCE_DELAY);
    };
    
    setInterval(debouncedPoll, CONFIG.POLL_INTERVAL);
  }

  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position: fixed;
    padding: 6px 8px;
    font-size: 12px;
    font-family: system-ui, sans-serif;
    background: rgba(20, 20, 20, 0.9);
    color: white;
    border-radius: 6px;
    pointer-events: none;
    white-space: nowrap;
    z-index: 999999;
    opacity: 0;
    transition: opacity 0.15s ease;
  `;
  
  // Safely append tooltip to DOM
  if (document.body) {
    document.body.appendChild(tooltip);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(tooltip);
    });
  }

  let hoverTimer;
  let currentHoveredLink = null;
  let rafId = null; // RequestAnimationFrame ID for smooth tooltip movement
  let pendingTooltipPosition = null; // Store pending position updates

  function showTooltip(e, linkUrl) {
    const key = normalizeUrl(linkUrl);
    const data = getDB()[key];
    
    // Clear previous content safely
    tooltip.textContent = '';
    
    if (!data) {
      tooltip.textContent = 'No visits recorded';
    } else {
      // Create elements safely instead of using innerHTML
      const visitLine = document.createElement('div');
      visitLine.textContent = `Visit: ${shortenNumber(data.count)}`;
      
      const lastLine = document.createElement('div');
      // Format timestamp for display
      const lastVisit = data.visits && data.visits.length > 0 ? formatTimestamp(data.visits[0]) : 'Never';
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

  document.addEventListener('mouseover', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.href;
    if (!/^https?:\/\//.test(href)) return;

    // Prevent duplicate listeners
    if (currentHoveredLink === a) return;
    currentHoveredLink = a;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showTooltip(e, href), CONFIG.HOVER_DELAY);
    document.addEventListener('mousemove', moveTooltip);
  });

  document.addEventListener('mouseout', e => {
    const a = e.target.closest('a[href]');
    if (!a || a !== currentHoveredLink) return;
    
    clearTimeout(hoverTimer);
    hideTooltip();
  });

  // Initialize the tracker
  function initializeTracker() {
    // Load saved badge visibility state
    try {
      badgeVisible = GM_getValue('badgeVisible', CONFIG.BADGE_VISIBLE);
    } catch (error) {
      console.warn('Failed to load badge visibility state:', error);
      badgeVisible = CONFIG.BADGE_VISIBLE;
    }
    
    // Don't register menu for initial empty state - let updateVisit() handle it
    updateVisit();
    installUrlObservers();
  }

  initializeTracker();

})();
