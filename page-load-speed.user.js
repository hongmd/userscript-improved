// ==UserScript==
// @name         Page Load Speed Monitor
// @namespace    com.userscript.page-load-speed
// @description  Ultra-lightweight page load speed monitor with dark transparent UI, auto-hide, and performance metrics info - minimal CPU/RAM impact
// @version      1.6.0
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
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
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
      #info-btn {
        float: right;
        margin-left: 8px;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      }
      #info-btn:hover {
        opacity: 1 !important;
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
      #info-panel {
        display: none;
        margin-top: 12px;
        padding: 8px;
        background: rgba(255,255,255,0.1);
        border-radius: 6px;
        font-size: 10px;
        line-height: 1.4;
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
    
    // Hiệu ứng fade-in
    box.style.opacity = '0';
    box.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      box.style.opacity = '0.9';
      box.style.transform = 'translateY(0)';
    }, 100);
    
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
        box.style.opacity = '0.3';
        box.style.transform = 'translateY(-2px) scale(0.95)';
        
        // Tự động xóa sau 2 giây nữa
        setTimeout(() => {
          if (box && box.parentNode) {
            box.style.opacity = '0';
            box.style.transform = 'translateY(-10px) scale(0.9)';
            setTimeout(() => box.remove(), 300);
          }
        }, 2000);
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
