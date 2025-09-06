// ==UserScript==
// @name         URL Visit Tracker (Improved)
// @namespace    URL Visit Tracker
// @version      2.0.0
// @description  Track visits per URL, show corner badge history & link hover info - Optimized Storage
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
    HOVER_DELAY: 200,
    POLL_INTERVAL: 2000,
    DEBOUNCE_DELAY: 1500,
    BADGE_POSITION: { right: '14px', bottom: '14px' },
    BADGE_VISIBLE: true
  };

  function normalizeUrl(url) {
    return url.replace(/^https?:\/\//, '').split('#')[0];
  }

  function formatDate(date) {
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  function storeTimestamp(date) {
    return date.getTime();
  }

  function shortenNumber(num) {
    if (num >= 1000) return (Math.round(num / 100) / 10) + 'k';
    return String(num);
  }

  // Domain mapping for URL compression
  function getDomainMap() {
    try {
      return GM_getValue('domainMap', {});
    } catch (error) {
      console.warn('Failed to read domain map:', error);
      return {};
    }
  }

  function setDomainMap(map) {
    try {
      GM_setValue('domainMap', map);
    } catch (error) {
      console.warn('Failed to save domain map:', error);
    }
  }

  function compressUrl(url) {
    const parts = url.split('/');
    const domain = parts[0];
    const path = parts.slice(1).join('/');
    
    const domainMap = getDomainMap();
    
    if (!domainMap[domain]) {
      // Create new domain ID
      const domainIds = Object.values(domainMap);
      const nextId = domainIds.length > 0 ? Math.max(...domainIds) + 1 : 1;
      domainMap[domain] = nextId;
      setDomainMap(domainMap);
    }
    
    return path ? `${domainMap[domain]}/${path}` : `${domainMap[domain]}`;
  }

  function decompressUrl(compressedUrl) {
    const domainMap = getDomainMap();
    const reverseDomainMap = {};
    
    // Create reverse mapping
    for (const [domain, id] of Object.entries(domainMap)) {
      reverseDomainMap[id] = domain;
    }
    
    const parts = compressedUrl.split('/');
    const domainId = parseInt(parts[0]);
    const path = parts.slice(1).join('/');
    
    const domain = reverseDomainMap[domainId];
    return path ? `${domain}/${path}` : domain;
  }

  function getDB() {
    try {
      const compressedDB = GM_getValue('visitDB', {});
      const decompressedDB = {};
      
      // Decompress URLs and timestamps
      for (const [compressedUrl, data] of Object.entries(compressedDB)) {
        const originalUrl = decompressUrl(compressedUrl);
        decompressedDB[originalUrl] = {
          count: data.count,
          visits: data.visits.map(timestamp => formatTimestamp(timestamp))
        };
      }
      
      return decompressedDB;
    } catch (error) {
      console.warn('Failed to read visit database:', error);
      return {};
    }
  }

  function setDB(db) {
    try {
      const compressedDB = {};
      
      // Compress URLs and timestamps
      for (const [originalUrl, data] of Object.entries(db)) {
        const compressedUrl = compressUrl(originalUrl);
        compressedDB[compressedUrl] = {
          count: data.count,
          visits: data.visits.map(visitStr => {
            // Convert string back to timestamp if needed
            if (typeof visitStr === 'string') {
              // Parse the formatted date string back to timestamp
              const [time, date] = visitStr.split(' ');
              const [hours, minutes] = time.split(':').map(Number);
              const [day, month, year] = date.split('/').map(Number);
              return new Date(year, month - 1, day, hours, minutes).getTime();
            }
            return visitStr; // Already a timestamp
          })
        };
      }
      
      GM_setValue('visitDB', compressedDB);
    } catch (error) {
      console.warn('Failed to save visit database:', error);
    }
  }

  let currentUrl = normalizeUrl(location.href);

  // Migration function for old data format
  function migrateOldData() {
    try {
      const oldDB = GM_getValue('visitDB', {});
      const oldDomainMap = GM_getValue('domainMap', {});
      
      // Check if migration is needed (old format detection)
      const needsMigration = Object.keys(oldDB).some(key => {
        return key.includes('.') || // Contains domain
               (oldDB[key].visits && oldDB[key].visits.some(visit => 
                 typeof visit === 'string' && visit.includes(':')
               ));
      });
      
      if (needsMigration) {
        console.log('Migrating visit data to optimized format...');
        
        // Convert old format to new format
        const newDB = {};
        const newDomainMap = {};
        let domainIdCounter = 1;
        
        for (const [url, data] of Object.entries(oldDB)) {
          // Skip if already migrated
          if (!isNaN(parseInt(url.split('/')[0]))) continue;
          
          // Convert URL to compressed format
          const parts = url.split('/');
          const domain = parts[0];
          
          if (!newDomainMap[domain]) {
            newDomainMap[domain] = domainIdCounter++;
          }
          
          const compressedUrl = parts.length > 1 ? 
            `${newDomainMap[domain]}/${parts.slice(1).join('/')}` : 
            `${newDomainMap[domain]}`;
          
          // Convert visits to timestamps
          const convertedVisits = data.visits.map(visit => {
            if (typeof visit === 'number') return visit; // Already timestamp
            
            // Parse "HH:MM DD/MM/YYYY" format
            const [time, date] = visit.split(' ');
            const [hours, minutes] = time.split(':').map(Number);
            const [day, month, year] = date.split('/').map(Number);
            return new Date(year, month - 1, day, hours, minutes).getTime();
          });
          
          newDB[compressedUrl] = {
            count: data.count,
            visits: convertedVisits
          };
        }
        
        // Save migrated data
        GM_setValue('visitDB', newDB);
        GM_setValue('domainMap', newDomainMap);
        console.log('Migration completed successfully!');
      }
    } catch (error) {
      console.warn('Migration failed:', error);
    }
  }

  function updateVisit() {
    const db = getDB();
    const now = new Date();
    const nowTimestamp = storeTimestamp(now);
    const nowStr = formatTimestamp(nowTimestamp);

    if (!db[currentUrl]) {
      db[currentUrl] = { count: 1, visits: [nowStr] };
    } else {
      db[currentUrl].count += 1;
      db[currentUrl].visits.unshift(nowStr);
      if (db[currentUrl].visits.length > CONFIG.MAX_VISITS_STORED) {
        db[currentUrl].visits.length = CONFIG.MAX_VISITS_STORED;
      }
    }

    setDB(db);
    renderBadge(db[currentUrl]);
    registerMenu(db[currentUrl]);
  }

  function registerMenu(data) {
    GM_registerMenuCommand(`Visit: ${shortenNumber(data.count)}`, () => { });
    
    // Handle case when no visits exist
    const lastVisit = (data.visits && data.visits.length > 0) ? data.visits[0] : 'Never';
    GM_registerMenuCommand(`Last: ${lastVisit}`, () => { });
    
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

    // Calculate storage optimization
    const rawDB = GM_getValue('visitDB', {});
    const domainMapSize = JSON.stringify(GM_getValue('domainMap', {})).length;
    const compressedSize = JSON.stringify(rawDB).length + domainMapSize;
    
    const stats = `
📈 Visit Tracker Statistics (v2.0)

🌐 Total websites tracked: ${totalUrls}
👆 Total visits recorded: ${totalVisits}
🏆 Most visited: ${mostVisited} (${db[mostVisited] ? db[mostVisited].count : 0} visits)
⏰ Oldest tracked site: ${oldestEntry}
📅 Current page visits: ${db[currentUrl] ? db[currentUrl].count : 0}

💾 Storage Optimization:
📦 Compressed size: ${Math.round(compressedSize / 1024)} KB
🗜️ Domain mappings: ${Object.keys(GM_getValue('domainMap', {})).length}
⚡ Timestamp format: Optimized
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
      const nowTimestamp = storeTimestamp(now);
      const nowStr = formatTimestamp(nowTimestamp);
      db[currentUrl] = { count: 1, visits: [nowStr] };
      setDB(db);
      
      // Update UI immediately with new data
      renderBadge(db[currentUrl]);
      registerMenu(db[currentUrl]);
      
      alert('Current page data cleared! Counter reset to 1.');
    }
  }

  function clearAllData() {
    if (confirm('⚠️ WARNING: This will clear ALL visit data from ALL websites!\n\nAre you absolutely sure?')) {
      // Clear all data
      setDB({});
      
      // Immediately create new entry for current page
      const now = new Date();
      const nowTimestamp = storeTimestamp(now);
      const nowStr = formatTimestamp(nowTimestamp);
      const db = {};
      db[currentUrl] = { count: 1, visits: [nowStr] };
      setDB(db);
      
      // Update UI immediately with new data
      renderBadge(db[currentUrl]);
      registerMenu(db[currentUrl]);
      
      alert('All visit data cleared! Current page counter reset to 1.');
    }
  }

  function ensureBadgeStyles() {
    if (document.getElementById('vt-hover-styles')) return;
    const css = `
      .vt-badge {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 2147483647;
        font-family: system-ui, sans-serif;
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
      document.documentElement.appendChild(badge);
    }

    badge.querySelector('.vt-link').textContent = `Visit: ${shortenNumber(data.count)}`;

    const tooltip = badge.querySelector('.vt-tooltip');
    tooltip.innerHTML = `<span class="vt-line">Visit: ${data.count}</span>`;
    
    // Handle empty visits array
    if (data.visits && data.visits.length > 0) {
      data.visits.forEach((v, i) => {
        tooltip.innerHTML += `<span class="vt-line">${i + 1}. ${v}</span>`;
      });
    } else {
      tooltip.innerHTML += `<span class="vt-line">No visit history</span>`;
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
      lastLine.textContent = `Last: ${data.visits[0]}`;
      
      tooltip.appendChild(visitLine);
      tooltip.appendChild(lastLine);
    }
    tooltip.style.left = e.clientX + 12 + 'px';
    tooltip.style.top = e.clientY + 12 + 'px';
    tooltip.style.opacity = 1;
  }

  function hideTooltip() {
    tooltip.style.opacity = 0;
    currentHoveredLink = null;
    document.removeEventListener('mousemove', moveTooltip);
  }

  function moveTooltip(e) {
    tooltip.style.left = e.clientX + 12 + 'px';
    tooltip.style.top = e.clientY + 12 + 'px';
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
    // Run migration first
    migrateOldData();
    
    const db = getDB();
    
    // If current page has no data, show initial state
    if (!db[currentUrl]) {
      const initialData = { count: 0, visits: [] };
      renderBadge(initialData);
      registerMenu(initialData);
    }
    
    updateVisit();
    installUrlObservers();
  }

  initializeTracker();

})();
