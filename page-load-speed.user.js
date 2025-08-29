// ==UserScript==
// @name         Page Load Speed Monitor
// @namespace    com.userscript.page-load-speed
// @description  Ultra-lightweight page load speed monitor with minimal UI - maximum performance, zero animations
// @version      1.8.0
// @match        http://*/*
// @match        https://*/*
// @noframes
// @icon         ⚡
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @compatible   ScriptCat
// @compatible   Tampermonkey
// @compatible   Greasemonkey
// @copyright    2025, Enhanced by AI Assistant
// ==/UserScript==

(function() {
  'use strict';
  
  // ===== START TIME =====
  const START_TIME = performance.now();
  let lcpTime = 0;
  let isUICreated = false;
  
  // ===== LCP TRACKING =====
  try {
    if (window.PerformanceObserver) {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          lcpTime = Math.round(entries[entries.length - 1].startTime);
          updateDisplay();
        }
      });
      lcpObserver.observe({entryTypes: ['largest-contentful-paint']});
      setTimeout(() => lcpObserver.disconnect(), 8000);
    }
  } catch (e) {
    // LCP not supported
  }
  
  // ===== CREATE CSS =====
  function injectStyles() {
    if (!document.head) {
      setTimeout(injectStyles, 10);
      return;
    }
    
    const css = `
      #speed-box {
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.9);
        color: #ffffff;
        padding: 10px 14px;
        border-radius: 6px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        font-weight: bold;
        z-index: 9999999;
        border: 1px solid #333;
        cursor: pointer;
        user-select: none;
      }
      #speed-box.expanded {
        min-width: 240px;
        padding: 12px 16px;
      }
      #close-btn {
        float: right;
        margin-left: 8px;
        cursor: pointer;
        font-weight: bold;
        color: #ff6b6b;
      }
      #info-btn {
        float: right;
        margin-left: 6px;
        cursor: pointer;
        opacity: 0.8;
      }
      #info-btn:hover {
        opacity: 1 !important;
      }
      #details {
        display: none;
        margin-top: 8px;
        font-size: 11px;
      }
      #details.show {
        display: block;
      }
      .metric {
        display: flex;
        justify-content: space-between;
        margin: 4px 0;
      }
      .good { color: #4ade80; }
      .medium { color: #fbbf24; }
      .poor { color: #f87171; }
      .metric-label {
        opacity: 0.9;
      }
      #info-panel {
        display: none;
        margin-top: 8px;
        padding: 6px;
        background: rgba(255,255,255,0.1);
        border-radius: 4px;
        font-size: 10px;
        line-height: 1.3;
      }
    `;
    
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
  
  // ===== CREATE UI =====
  function createUI() {
    if (isUICreated || !document.body) {
      if (!document.body) setTimeout(createUI, 10);
      return;
    }
    
    const box = document.createElement('div');
    box.id = 'speed-box';
    box.innerHTML = `
      <div id="main">⚡ Measuring...</div>
      <span id="close-btn" title="Close">×</span>
      <span id="info-btn" title="Show metrics info">ℹ️</span>
      <div style="font-size: 10px; opacity: 0.6; margin-top: 4px;">Auto-hide in 10s</div>
      <div id="details">
        <div class="metric">
          <span class="metric-label" title="Time until DOM is fully loaded and parsed">DOM Content Loaded:</span>
          <span id="dcl-time">-</span>
        </div>
        <div class="metric">
          <span class="metric-label" title="Time of first pixel painted on screen">First Paint:</span>
          <span id="fp-time">-</span>
        </div>
        <div class="metric">
          <span class="metric-label" title="Time when first content (text/image) becomes visible">First Contentful Paint:</span>
          <span id="fcp-time">-</span>
        </div>
        <div class="metric">
          <span class="metric-label" title="Time when largest content element becomes visible">Largest Contentful Paint:</span>
          <span id="lcp-time">-</span>
        </div>
      </div>
      <div id="info-panel" style="display: none; margin-top: 12px; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; font-size: 10px; line-height: 1.4;">
        <div style="font-weight: bold; margin-bottom: 6px;">📊 Performance Metrics:</div>
        <div>• <b>Total Load Time:</b> Complete page load duration</div>
        <div>• <b>DOM Content Loaded:</b> HTML parsed, DOM ready</div>
        <div>• <b>First Paint:</b> First visual change on screen</div>
        <div>• <b>First Contentful Paint:</b> First meaningful content visible</div>
        <div>• <b>Largest Contentful Paint:</b> Largest element visible (Core Web Vital)</div>
        <div style="margin-top: 6px; font-size: 9px; opacity: 0.7;">
          🟢 Good: Fast loading | 🟡 Medium: Acceptable | 🔴 Poor: Needs improvement
        </div>
      </div>
    `;
    
    // Close UI when close button clicked
    box.querySelector('#close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      clearTimeout(autoHideTimer);
      clearInterval(countdownInterval);
      box.remove();
    });
    
    // Info button to show metrics info
    const infoBtn = box.querySelector('#info-btn');
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetAutoHide();
      
      const infoPanel = document.getElementById('info-panel');
      const details = document.getElementById('details');
      const isVisible = infoPanel.style.display === 'block';
      
      // Toggle info display
      infoPanel.style.display = isVisible ? 'none' : 'block';
      
      if (!isVisible) {
        details.classList.add('show');
        box.classList.add('expanded');
      }
    });
    
    // Expand/collapse on click
    let isExpanded = false;
    box.addEventListener('click', (e) => {
      // Skip if clicking close or info button
      if (e.target.id === 'close-btn' || e.target.id === 'info-btn') return;
      
      resetAutoHide(); // Reset timer on click
      
      const details = document.getElementById('details');
      const infoPanel = document.getElementById('info-panel');
      
      if (isExpanded) {
        details.classList.remove('show');
        infoPanel.style.display = 'none';
        box.classList.remove('expanded');
      } else {
        details.classList.add('show');
        box.classList.add('expanded');
      }
      isExpanded = !isExpanded;
    });
    
    // Reset timer on hover
    box.addEventListener('mouseenter', resetAutoHide);
    
    document.body.appendChild(box);
    isUICreated = true;
    
    // Start auto-hide
    startAutoHide();
    
    // Update immediately after UI creation
    updateDisplay();
  }
  
  // ===== UPDATE DISPLAY =====
  function updateDisplay() {
    if (!isUICreated) return;
    
    const mainEl = document.getElementById('main');
    if (!mainEl) return;
    
    // Get timing data
    const timings = getPageTimings();
    const totalTime = timings.loadTime;
    
    // Update main display
    if (totalTime > 0) {
      let speedClass = getSpeedClass(totalTime, 1000, 3000);
      mainEl.innerHTML = `⚡ ${totalTime}ms`;
      mainEl.className = speedClass;
    }
    
    // Update details
    updateMetric('dcl-time', timings.dcl, 800, 2000);
    updateMetric('fp-time', timings.fp, 1000, 2500);
    updateMetric('fcp-time', timings.fcp, 1800, 3000);
    updateMetric('lcp-time', lcpTime, 2500, 4000);
  }
  
  // ===== HELPERS =====
  function getSpeedClass(value, good, medium) {
    if (value <= good) return 'good';
    if (value <= medium) return 'medium';
    return 'poor';
  }
  
  function updateMetric(id, value, good, medium) {
    const el = document.getElementById(id);
    if (el) {
      if (value > 0) {
        const cls = getSpeedClass(value, good, medium);
        el.innerHTML = `<span class="${cls}">${value}ms</span>`;
      }
    }
  }
  
  // ===== GET PERFORMANCE DATA =====
  function getPageTimings() {
    const result = {
      loadTime: 0,
      dcl: 0,
      fp: 0,
      fcp: 0
    };
    
    // Try Navigation API Level 2
    try {
      const navEntry = performance.getEntriesByType('navigation')[0];
      if (navEntry) {
        result.loadTime = Math.round(navEntry.loadEventEnd);
        result.dcl = Math.round(navEntry.domContentLoadedEventEnd);
      }
    } catch (e) {
      // Navigation API Level 2 not supported
    }
    
    // Fallback to Level 1 timing API
    if (!result.loadTime && performance.timing) {
      const t = performance.timing;
      result.loadTime = Math.round(t.loadEventEnd - t.navigationStart);
      result.dcl = Math.round(t.domContentLoadedEventEnd - t.navigationStart);
    }
    
    // Get paint metrics
    try {
      const paintEntries = performance.getEntriesByType('paint');
      for (const entry of paintEntries) {
        if (entry.name === 'first-paint') {
          result.fp = Math.round(entry.startTime);
        }
        if (entry.name === 'first-contentful-paint') {
          result.fcp = Math.round(entry.startTime);
        }
      }
    } catch (e) {
      // Paint Timing API not supported
    }
    
    // Fallback if no timing APIs available
    if (!result.loadTime) {
      result.loadTime = Math.round(performance.now() - START_TIME);
      result.dcl = Math.round(result.loadTime * 0.8);
    }
    
    return result;
  }
  
  // ===== INIT =====
  injectStyles();
  
  // Create UI when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createUI);
  } else {
    createUI();
  }
  
  // Update metrics when page loads
  window.addEventListener('load', () => {
    // Update immediately and after delays for accuracy
    updateDisplay();
    setTimeout(updateDisplay, 500);
    setTimeout(updateDisplay, 1500);
  });
  
  // Performance report menu
  if (typeof GM_registerMenuCommand !== 'undefined') {
    GM_registerMenuCommand('📊 Performance Report', () => {
      const timings = getPageTimings();
      
      alert(`🚀 PERFORMANCE REPORT:
      
⏱️ Total Load Time: ${timings.loadTime}ms
📄 DOM Content Loaded: ${timings.dcl}ms
🖼️ First Paint: ${timings.fp}ms
🖌️ First Contentful Paint: ${timings.fcp}ms
📸 Largest Contentful Paint: ${lcpTime}ms

🌐 ${window.location.hostname}
📅 ${new Date().toLocaleTimeString()}`);
    });
  }
  
  // ===== AUTO HIDE =====
  let autoHideTimer;
  let countdownInterval;
  
  function startAutoHide() {
    let countdown = 10;
    
    // Update countdown display
    const countdownElement = document.querySelector('#speed-box div[style*="font-size: 10px"]');
    if (countdownElement) {
      countdownElement.textContent = `Auto-hide in ${countdown}s`;
    }
    
    countdownInterval = setInterval(() => {
      countdown--;
      if (countdownElement) {
        countdownElement.textContent = `Auto-hide in ${countdown}s`;
      }
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);
    
    // Auto-hide after 10 seconds
    autoHideTimer = setTimeout(() => {
      const box = document.getElementById('speed-box');
      if (box) {
        clearInterval(countdownInterval);
        box.remove();
      }
    }, 10000); // 10 seconds
  }
  
  function resetAutoHide() {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    startAutoHide();
  }
  
})();
