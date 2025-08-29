// ==UserScript==
// @name         Page Load Speed Monitor
// @namespace    com.userscript.page-load-speed
// @description  Ultra-lightweight page load speed monitor - minimal CPU/RAM impact
// @version      1.1.0
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

(function () {
  "use strict";

  // Lightweight Performance Tracker
  const PerformanceTracker = {
    startTime: performance.now(),
    lcpValue: 0,
    
    // Minimal LCP observer
    initLCP: () => {
      if (!window.PerformanceObserver) return;
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            PerformanceTracker.lcpValue = Math.round(entries[entries.length - 1].startTime);
          }
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Auto-disconnect after 5 seconds to save memory
        setTimeout(() => observer.disconnect(), 5000);
      } catch (e) {
        // LCP not supported
      }
    },
    
    // Get essential metrics only
    getMetrics: () => {
      const nav = performance.getEntriesByType('navigation')[0];
      if (!nav) return null;
      
      const paint = performance.getEntriesByType('paint');
      let firstPaint = 0, firstContentfulPaint = 0;
      
      paint.forEach(entry => {
        if (entry.name === 'first-paint') firstPaint = Math.round(entry.startTime);
        else if (entry.name === 'first-contentful-paint') firstContentfulPaint = Math.round(entry.startTime);
      });
      
      return {
        total: Math.round(nav.loadEventEnd - nav.navigationStart) || 0,
        dcl: Math.round(nav.domContentLoadedEventEnd - nav.navigationStart) || 0,
        interactive: Math.round(nav.domInteractive - nav.navigationStart) || 0,
        fp: firstPaint,
        fcp: firstContentfulPaint,
        lcp: PerformanceTracker.lcpValue,
      };
    }
  };

  // Minimal UI
  const UI = {
    container: null,
    isMinimized: true,
    
    // Lightweight styles
    injectStyles: () => {
      const styles = `
        #page-speed-monitor {
          position: fixed; top: 20px; right: 20px; z-index: 999999;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white; padding: 8px 12px; border-radius: 8px;
          font: 12px system-ui; cursor: pointer; transition: all 0.2s ease;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        #page-speed-monitor:hover { transform: translateY(-1px); }
        #page-speed-monitor.expanded { padding: 12px 16px; min-width: 240px; }
        .speed-metrics { margin-top: 8px; display: none; }
        .speed-metrics.show { display: block; }
        .metric { display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; }
        .good { color: #4ade80; } .medium { color: #fbbf24; } .poor { color: #f87171; }
        .close { float: right; cursor: pointer; margin-left: 10px; }
      `;
      
      const styleEl = document.createElement('style');
      styleEl.textContent = styles;
      document.head.appendChild(styleEl);
    },
    
    // Create minimal container
    create: () => {
      UI.container = document.createElement('div');
      UI.container.id = 'page-speed-monitor';
      UI.container.innerHTML = `
        <span id="main-time">⚡ Measuring...</span>
        <span class="close" onclick="this.parentElement.remove()">×</span>
        <div class="speed-metrics" id="metrics">
          <div class="metric">DCL: <span id="dcl">-</span></div>
          <div class="metric">FCP: <span id="fcp">-</span></div>
          <div class="metric">LCP: <span id="lcp">-</span></div>
        </div>
      `;
      
      // Toggle on click
      UI.container.addEventListener('click', (e) => {
        if (e.target.classList.contains('close')) return;
        
        const metrics = document.getElementById('metrics');
        if (UI.isMinimized) {
          metrics.classList.add('show');
          UI.container.classList.add('expanded');
          UI.isMinimized = false;
        } else {
          metrics.classList.remove('show');
          UI.container.classList.remove('expanded');
          UI.isMinimized = true;
        }
      });
      
      document.body.appendChild(UI.container);
    },
    
    // Get color class
    getColor: (value, good, medium) => {
      if (value <= good) return 'good';
      if (value <= medium) return 'medium';
      return 'poor';
    },
    
    // Update metrics
    update: (data) => {
      if (!data || data.total <= 0) return;
      
      const mainTime = document.getElementById('main-time');
      const color = UI.getColor(data.total, 1000, 3000);
      mainTime.innerHTML = `⚡ ${data.total}ms`;
      mainTime.className = color;
      
      // Update details
      document.getElementById('dcl').innerHTML = `<span class="${UI.getColor(data.dcl, 800, 1600)}">${data.dcl}ms</span>`;
      document.getElementById('fcp').innerHTML = `<span class="${UI.getColor(data.fcp, 1800, 3000)}">${data.fcp}ms</span>`;
      document.getElementById('lcp').innerHTML = `<span class="${UI.getColor(data.lcp, 2500, 4000)}">${data.lcp}ms</span>`;
    }
  };

  // Lightweight App
  const App = {
    init: () => {
      UI.injectStyles();
      PerformanceTracker.initLCP();
      
      // Create UI when DOM ready
      if (document.body) {
        UI.create();
      } else {
        document.addEventListener('DOMContentLoaded', UI.create);
      }
      
      // Single update after load
      window.addEventListener('load', () => {
        setTimeout(() => {
          const data = PerformanceTracker.getMetrics();
          UI.update(data);
          
          // Auto-hide after 5 seconds
          setTimeout(() => {
            if (UI.isMinimized && UI.container) {
              UI.container.style.opacity = '0.6';
            }
          }, 5000);
        }, 100);
      });
      
      // Performance report menu (optional)
      if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('📊 Performance Report', () => {
          const data = PerformanceTracker.getMetrics();
          if (data && data.total > 0) {
            alert(`🚀 Performance Report:
            
⏱️ Total: ${data.total}ms
📄 DCL: ${data.dcl}ms  
🖼️ FCP: ${data.fcp}ms
📸 LCP: ${data.lcp}ms

🌐 ${window.location.hostname}
📅 ${new Date().toLocaleTimeString()}`);
          } else {
            alert('⏳ Data not ready. Please wait.');
          }
        });
      }
    }
  };

  // Initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
  } else {
    App.init();
  }

})();
