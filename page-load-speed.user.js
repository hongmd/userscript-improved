// ==UserScript==
// @name         Page Load Speed Monitor
// @namespace    com.userscript.page-load-speed
// @description  Ultra-lightweight page load speed monitor with minimal UI - maximum performance, zero animations
// @version      1.7.0
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
    // LCP not supported
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
      <span id="info-btn" title="Show metrics info" style="float: right; margin-left: 8px; cursor: pointer; opacity: 0.7;">ℹ️</span>
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
    
    // Đóng UI khi click nút đóng
    box.querySelector('#close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      clearTimeout(autoHideTimer);
      clearInterval(countdownInterval);
      box.remove();
    });
    
    // Nút info để hiển thị thông tin metrics
    box.querySelector('#info-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      resetAutoHide();
      
      const infoPanel = document.getElementById('info-panel');
      const details = document.getElementById('details');
      
      if (infoPanel.style.display === 'none' || infoPanel.style.display === '') {
        infoPanel.style.display = 'block';
        details.classList.add('show');
        box.classList.add('expanded');
      } else {
        infoPanel.style.display = 'none';
      }
    });
    
    // Mở rộng/Thu gọn khi click
    let isExpanded = false;
    box.addEventListener('click', (e) => {
      // Bỏ qua nếu click vào nút close hoặc info
      if (e.target.id === 'close-btn' || e.target.id === 'info-btn') return;
      
      resetAutoHide(); // Reset timer khi click
      
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
    
    // Hiện thông tin metrics khi click nút info
    box.querySelector('#info-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const infoPanel = document.getElementById('info-panel');
      const isVisible = infoPanel.style.display === 'block';
      
      // Ẩn hiện thông tin
      infoPanel.style.display = isVisible ? 'none' : 'block';
      
      // Tạm dừng tự động ẩn
      if (isVisible) {
        clearTimeout(autoHideTimer);
        infoPanel.style.opacity = '0.9';
      } else {
        // Đặt lại timer tự động ẩn
        resetAutoHide();
      }
    });
    
    // Reset timer khi hover
    box.addEventListener('mouseenter', resetAutoHide);
    
    document.body.appendChild(box);
    isUICreated = true;
    
    // Bắt đầu tự động tắt
    startAutoHide();
    
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
  
  // ===== TỰ ĐỘNG TẮT =====
  let autoHideTimer;
  let countdownInterval;
  let countdownElement;
  
  function startAutoHide() {
    let countdown = 10;
    
    // Cập nhật countdown display
    countdownElement = document.querySelector('#speed-box div[style*="font-size: 10px"]');
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
    
    // Tự động ẩn sau 10 giây
    autoHideTimer = setTimeout(() => {
      const box = document.getElementById('speed-box');
      if (box) {
        clearInterval(countdownInterval);
        box.remove();
      }
    }, 10000); // 10 giây
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
