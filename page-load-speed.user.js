// ==UserScript==
// @name         Page Load Speed Monitor
// @namespace    com.userscript.page-load-speed
// @description  Ultra-lightweight page load speed monitor with dark transparent UI - minimal CPU/RAM impact
// @version      1.4.0
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
  
  // ===== THỜI GIAN BẮT ĐẦU =====
  const START_TIME = performance.now();
  let lcpTime = 0;
  let isUICreated = false;
  
  // ===== THEO DÕI LCP =====
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
    console.log('LCP not supported');
  }
  
  // ===== TẠO CSS =====
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
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: #ffffff;
        padding: 12px 16px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        z-index: 9999999;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
        opacity: 0.9;
      }
      #speed-box:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
        opacity: 1;
        background: rgba(0, 0, 0, 0.9);
      }
      #speed-box.expanded {
        min-width: 280px;
        padding: 16px 20px;
      }
      #close-btn {
        float: right;
        margin-left: 12px;
        cursor: pointer;
        font-weight: bold;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      }
      #close-btn:hover {
        opacity: 1;
        color: #ff6b6b;
      }
      #details {
        display: none;
        margin-top: 12px;
        font-size: 11px;
        opacity: 0.9;
      }
      #details.show {
        display: block;
      }
      .metric {
        display: flex;
        justify-content: space-between;
        margin: 6px 0;
        padding: 2px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .metric:last-child {
        border-bottom: none;
      }
      .good { color: #4ade80; }
      .medium { color: #fbbf24; }
      .poor { color: #f87171; }
      .metric-label {
        opacity: 0.8;
      }
    `;
    
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
  
  // ===== TẠO UI =====
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
      <div id="details">
        <div class="metric">
          <span class="metric-label">DOM Content Loaded:</span>
          <span id="dcl-time">-</span>
        </div>
        <div class="metric">
          <span class="metric-label">First Paint:</span>
          <span id="fp-time">-</span>
        </div>
        <div class="metric">
          <span class="metric-label">First Contentful Paint:</span>
          <span id="fcp-time">-</span>
        </div>
        <div class="metric">
          <span class="metric-label">Largest Contentful Paint:</span>
          <span id="lcp-time">-</span>
        </div>
      </div>
    `;
    
    // Đóng UI khi click nút đóng
    box.querySelector('#close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      box.remove();
    });
    
    // Mở rộng/Thu gọn khi click
    let isExpanded = false;
    box.addEventListener('click', () => {
      const details = document.getElementById('details');
      if (isExpanded) {
        details.classList.remove('show');
        box.classList.remove('expanded');
      } else {
        details.classList.add('show');
        box.classList.add('expanded');
      }
      isExpanded = !isExpanded;
    });
    
    document.body.appendChild(box);
    isUICreated = true;
    
    // Cập nhật ngay sau khi tạo UI
    updateDisplay();
  }
  
  // ===== CẬP NHẬT HIỂN THỊ =====
  function updateDisplay() {
    if (!isUICreated) return;
    
    const mainEl = document.getElementById('main');
    if (!mainEl) return;
    
    // Lấy thời gian
    const timings = getPageTimings();
    const totalTime = timings.loadTime;
    
    // Cập nhật hiển thị chính
    if (totalTime > 0) {
      let speedClass = getSpeedClass(totalTime, 1000, 3000);
      mainEl.innerHTML = `⚡ ${totalTime}ms`;
      mainEl.className = speedClass;
    }
    
    // Cập nhật chi tiết
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
  
  // ===== LẤY SỐ LIỆU HIỆU SUẤT =====
  function getPageTimings() {
    // Khởi tạo kết quả
    const result = {
      loadTime: 0,
      dcl: 0,
      fp: 0,
      fcp: 0
    };
    
    // Thử lấy từ Navigation API mới
    try {
      const navEntry = performance.getEntriesByType('navigation')[0];
      if (navEntry) {
        result.loadTime = Math.round(navEntry.loadEventEnd);
        result.dcl = Math.round(navEntry.domContentLoadedEventEnd);
      }
    } catch (e) {
      // Không hỗ trợ Navigation API mới
    }
    
    // Thử lấy từ timing API cũ
    if (!result.loadTime && performance.timing) {
      const t = performance.timing;
      result.loadTime = Math.round(t.loadEventEnd - t.navigationStart);
      result.dcl = Math.round(t.domContentLoadedEventEnd - t.navigationStart);
    }
    
    // Thử lấy paint metrics
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
      // Không hỗ trợ Paint Timing API
    }
    
    // Dự phòng nếu không có timing APIs
    if (!result.loadTime) {
      result.loadTime = Math.round(performance.now() - START_TIME);
      result.dcl = Math.round(result.loadTime * 0.8);
    }
    
    return result;
  }
  
  // ===== KHỞI TẠO =====
  // CSS trước
  injectStyles();
  
  // Tạo UI khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createUI);
  } else {
    createUI();
  }
  
  // Cập nhật số liệu khi trang tải xong
  window.addEventListener('load', () => {
    // Cập nhật ngay khi load
    setTimeout(updateDisplay, 0);
    
    // Cập nhật lại sau một lúc để có metrics chính xác hơn
    setTimeout(updateDisplay, 200);
    setTimeout(updateDisplay, 1000);
    setTimeout(updateDisplay, 2000);
  });
  
  // Menu báo cáo hiệu suất
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
  
})();
