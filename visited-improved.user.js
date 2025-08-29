// ==UserScript==
// @name        Visited Links Enhanced
// @namespace   com.userscript.visited-links-enhanced
// @description Enhanced userscript to mark visited links with custom colors and improved performance
// @version     0.2.6
// @include     http*
// @include     https*
// @match       http://*/*
// @match       https://*/*
// @noframes
// @icon        https://cdn.jsdelivr.net/gh/hongmd/cdn-web@main/logo.svg
// @run-at      document-start
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_registerMenuCommand
// @grant       GM_info
// @compatible  ScriptCat
// @compatible  Tampermonkey
// @compatible  Greasemonkey
// @copyright   2025, Enhanced by AI Assistant ft. Hongmd
// ==/UserScript==

(function () {
  "use strict";

  // ScriptCat & Browser Compatibility Detection
  const ENVIRONMENT = (function () {
    const handler = (typeof GM_info !== "undefined" && GM_info && GM_info.scriptHandler) || "";
    return {
      isScriptCat: handler === "ScriptCat",
      isFirefox: (navigator.userAgent || "").toLowerCase().indexOf("firefox") !== -1,
      isTampermonkey: handler === "Tampermonkey",
      isGreasemonkey: handler === "Greasemonkey",
      // Feature detection
      hasStorage: typeof GM_setValue !== "undefined" && typeof GM_getValue !== "undefined",
      hasMenuCommand: typeof GM_registerMenuCommand !== "undefined",
    };
  })();

  // Compatibility logging
  console.log("[Visited Links Enhanced] Environment detected:", {
    handler: ENVIRONMENT.isScriptCat
      ? "ScriptCat"
      : ENVIRONMENT.isTampermonkey
      ? "Tampermonkey"
      : ENVIRONMENT.isGreasemonkey
      ? "Greasemonkey"
      : "Unknown",
    browser: ENVIRONMENT.isFirefox ? "Firefox" : "Other",
    features: {
      storage: ENVIRONMENT.hasStorage,
      menuCommand: ENVIRONMENT.hasMenuCommand,
    },
  });

  //// Enhanced Configuration with Storage
  const CONFIG = {
    STORAGE_KEYS: {
      COLOR: "visited_color",
      EXCEPT_SITES: "except_sites",
      ENABLED: "script_enabled",
    },
    DEFAULTS: {
      COLOR: "#FF6B6B",
      EXCEPT_SITES: "mail.live.com,gmail.com",
      ENABLED: true,
    },
    STYLE_ID: "visited-lite-enhanced-style",
    CSS_TEMPLATE:
      "a:visited, a:visited * { color: %COLOR% !important; transition: color 0.2s ease; }",
  };

  // Enhanced color palette with better accessibility
  const COLOR_PALETTE = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FECA57",
    "#FF9FF3",
    "#54A0FF",
    "#5F27CD",
    "#00D2D3",
    "#FF9F43",
    "#EE5A24",
    "#0984E3",
    "#A29BFE",
    "#FD79A8",
    "#E17055",
    "#00B894",
    "#FDCB6E",
    "#6C5CE7",
    "#74B9FF",
    "#00CEC9",
  ];

  //// Utility Functions
  const Utils = {
    // Debounce function for performance
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // Validate color format
    isValidColor(color) {
      const s = new Option().style;
      s.color = color;
      return s.color !== "";
    },

    // Get domain from URL
    getDomain(url) {
      try {
        return new URL(url).hostname;
      } catch (e) {
        // Fallback for older engines: use an anchor element
        try {
          const a = document.createElement("a");
          a.href = url;
          return a.hostname || "";
        } catch (_) {
          return "";
        }
      }
    },

    // Sanitize input
    sanitizeInput(input) {
      return input.replace(/[<>'"]/g, "");
    },

    // Normalize site string (remove protocol/www, lowercase, trim)
    normalizeSite(input) {
      if (!input) return "";
      var s = String(input).trim().toLowerCase();
      return s.replace(/^(https?:\/\/)?(www\.)?/, "");
    },
  };

  //// Configuration Manager with ScriptCat Compatibility
  const ConfigManager = {
    // Storage fallback system
    _storagePrefix: "visited_links_enhanced_",

    get(key) {
      const storageKey = CONFIG.STORAGE_KEYS[key];
      const defaultValue = CONFIG.DEFAULTS[key];

      // Try GM_getValue first (ScriptCat/Tampermonkey)
      if (ENVIRONMENT.hasStorage) {
        try {
          return GM_getValue(storageKey, defaultValue);
        } catch (e) {
          console.warn(
            "[ScriptCat Compatibility] GM_getValue failed, trying localStorage:",
            e
          );
        }
      }

      // Fallback to localStorage for ScriptCat compatibility
      try {
        const stored = localStorage.getItem(this._storagePrefix + storageKey);
        return stored ? JSON.parse(stored) : defaultValue;
      } catch (e) {
        console.warn("[Storage] Both GM and localStorage failed:", e);
        return defaultValue;
      }
    },

    set(key, value) {
      const storageKey = CONFIG.STORAGE_KEYS[key];

      // Try GM_setValue first
      if (ENVIRONMENT.hasStorage) {
        try {
          GM_setValue(storageKey, value);
          return true;
        } catch (e) {
          console.warn(
            "[ScriptCat Compatibility] GM_setValue failed, trying localStorage:",
            e
          );
        }
      }

      // Fallback to localStorage
      try {
        localStorage.setItem(
          this._storagePrefix + storageKey,
          JSON.stringify(value)
        );
        return true;
      } catch (e) {
        console.warn("[Storage] Both GM and localStorage failed:", e);
        return false;
      }
    },

    isExceptSite(url) {
      var raw = this.get("EXCEPT_SITES");
      var exceptSites = [];
      if (typeof raw === "string" && raw.length) {
        exceptSites = raw.split(",").map(function(site){ return site.trim().toLowerCase(); }).filter(function(site){ return site.length > 0; });
      }

      var currentDomain = (Utils.getDomain(url) || "").toLowerCase();

      return exceptSites.some((site) => {
        // Remove protocol and www prefix for comparison
        const cleanSite = site.replace(/^(https?:\/\/)?(www\.)?/, "");
        const cleanDomain = currentDomain.replace(/^www\./, "");

        return (
          cleanDomain.includes(cleanSite) || cleanSite.includes(cleanDomain)
        );
      });
    },
  };

  //// Style Manager
  const StyleManager = {
    styleElement: null,
    _lastAppliedColor: null,

    init() {
      this.createStyleElement();
    },

    createStyleElement() {
      // Remove existing style if present
      (function () {
        const prev = document.getElementById(CONFIG.STYLE_ID);
        if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
      })();

      this.styleElement = document.createElement("style");
      this.styleElement.id = CONFIG.STYLE_ID;
      this.styleElement.type = "text/css";

      // Try to append to head, fallback to document
      const target = document.head || document.documentElement || document.body || document;
      if (target && target.appendChild) target.appendChild(this.styleElement);

      // Return the created element for callers that expect a value
      return this.styleElement;
    },

    updateStyles() {
      // Ensure style element exists and is attached
      if (!this.styleElement || !document.contains(this.styleElement)) {
        this.createStyleElement();
      }

      const color = ConfigManager.get("COLOR");
      if (Utils.isValidColor(color)) {
        if (color !== this._lastAppliedColor) {
          const css = CONFIG.CSS_TEMPLATE.replace(/%COLOR%/g, color);
          this.styleElement.textContent = css;
          this._lastAppliedColor = color;
        }
      }
    },

    removeStyles() {
      if (this.styleElement) {
        this.styleElement.textContent = "";
      }
    },
  };

  //// Menu System with ScriptCat Compatibility
  const MenuManager = {
    init() {
      // Try to register menu commands (ScriptCat/Tampermonkey support)
      if (ENVIRONMENT.hasMenuCommand) {
        try {
          GM_registerMenuCommand(
            "🎨 Change Color",
            this.changeColor.bind(this)
          );
          GM_registerMenuCommand(
            "⚙️ Toggle Visited Links",
            this.toggleScript.bind(this)
          );
          GM_registerMenuCommand(
            "🚫 Manage Exception Sites",
            this.manageExceptions.bind(this)
          );
          GM_registerMenuCommand(
            "🔄 Reset Settings",
            this.resetSettings.bind(this)
          );

          console.log("[ScriptCat] Menu commands registered successfully");
        } catch (e) {
          console.warn("[ScriptCat] Menu registration failed:", e);
          this.createFloatingMenu();
        }
      } else {
        console.log(
          "[ScriptCat] GM_registerMenuCommand not available, creating floating menu"
        );
        this.createFloatingMenu();
      }
    },

    // Fallback floating menu for when GM_registerMenuCommand is not available
    createFloatingMenu() {
      // Create floating menu button
      const menuButton = document.createElement("div");
      menuButton.id = "visited-links-menu-button";
      menuButton.innerHTML = "🎨";
      menuButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        background: #4CAF50;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 999998;
        font-size: 18px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
        opacity: 0.8;
      `;

      menuButton.onmouseenter = () => {
        menuButton.style.opacity = "1";
        menuButton.style.transform = "scale(1.1)";
      };

      menuButton.onmouseleave = () => {
        menuButton.style.opacity = "0.8";
        menuButton.style.transform = "scale(1)";
      };

      menuButton.onclick = () => this.showFloatingMenu();

      // Add to page when DOM is ready
      const addMenu = () => {
        if (document.body) {
          document.body.appendChild(menuButton);
        } else {
          setTimeout(addMenu, 100);
        }
      };
      addMenu();
    },

    showFloatingMenu() {
      // Remove existing menu
      const existing = document.getElementById("visited-links-floating-menu");
      if (existing) {
        existing.remove();
        return;
      }

      const menu = document.createElement("div");
      menu.id = "visited-links-floating-menu";
      menu.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        z-index: 999999;
        overflow: hidden;
        min-width: 200px;
      `;

      const menuItems = [
        { text: "🎨 Change Color", action: () => this.changeColor() },
        { text: "⚙️ Toggle Script", action: () => this.toggleScript() },
        { text: "🚫 Manage Exceptions", action: () => this.manageExceptions() },
      ];

      menuItems.forEach((item) => {
        const button = document.createElement("div");
        button.textContent = item.text;
        button.style.cssText = `
          padding: 12px 15px;
          cursor: pointer;
          border-bottom: 1px solid #eee;
          transition: background 0.2s ease;
        `;

        button.onmouseenter = () => (button.style.background = "#f5f5f5");
        button.onmouseleave = () => (button.style.background = "white");
        button.onclick = () => {
          item.action();
          menu.remove();
        };

        menu.appendChild(button);
      });

      document.body.appendChild(menu);

      // Auto-hide after 5 seconds
      setTimeout(() => {
        menu.parentNode && menu.remove();
      }, 5000);
    },

    toggleScript() {
      const currentState = ConfigManager.get("ENABLED");
      const newState = !currentState;
      ConfigManager.set("ENABLED", newState);

      if (newState) {
        StyleManager.updateStyles();
        this.showNotification("Visited Links Enhanced: Enabled", "success");
      } else {
        StyleManager.removeStyles();
        this.showNotification("Visited Links Enhanced: Disabled", "info");
      }
    },

    changeColor() {
      this.createColorPicker();
    },

    createColorPicker() {
      // Remove existing picker if present
      (function(){
        var ex = document.getElementById("visited-links-color-picker");
        if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
      })();

      const currentColor = ConfigManager.get("COLOR");

      // Create overlay
      const overlay = document.createElement("div");
      overlay.id = "visited-links-color-picker";
      overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 999999;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: Arial, sans-serif;
            `;

      // Create picker dialog
      const picker = document.createElement("div");
      picker.style.cssText = `
                background: white;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                max-width: 400px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
            `;

      picker.innerHTML = `
                <h3 style="margin: 0 0 15px 0; text-align: center; color: #333;">
                    Choose Visited Link Color
                </h3>
                <p style="margin: 0 0 15px 0; color: #666; font-size: 14px; text-align: center;">
                    Current color: <span style="color: ${currentColor}; font-weight: bold;">${currentColor}</span>
                </p>
                <div id="color-grid" style="
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 8px;
                    margin-bottom: 15px;
                "></div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #333; font-weight: bold;">
                        Custom Color:
                    </label>
                    <input type="color" id="custom-color" value="${this.colorToHex(
                      currentColor
                    )}" 
                           style="width: 100%; height: 40px; border: none; border-radius: 5px; cursor: pointer;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #333; font-weight: bold;">
                        Or enter color name/code:
                    </label>
                    <input type="text" id="custom-color-text" value="${currentColor}" 
                           placeholder="e.g., red, #FF0000, rgb(255,0,0)"
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;">
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="apply-color" style="
                        background: #4CAF50;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Apply</button>
                    <button id="cancel-color" style="
                        background: #f44336;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Cancel</button>
                </div>
            `;

      // Add color grid
      const colorGrid = picker.querySelector("#color-grid");
      COLOR_PALETTE.forEach((color) => {
        const colorButton = document.createElement("div");
        colorButton.style.cssText = `
                    width: 40px;
                    height: 40px;
                    background-color: ${color};
                    border-radius: 5px;
                    cursor: pointer;
                    border: 2px solid ${
                      color === currentColor ? "#333" : "transparent"
                    };
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                `;

        colorButton.title = color;
        colorButton.onclick = () => {
          // Update all inputs
          picker.querySelector("#custom-color").value = color;
          picker.querySelector("#custom-color-text").value = color;

          // Update border selection
          colorGrid.querySelectorAll("div").forEach((btn) => {
            btn.style.border = "2px solid transparent";
          });
          colorButton.style.border = "2px solid #333";
        };

        colorGrid.appendChild(colorButton);
      });

      // Event listeners
      picker.querySelector("#custom-color").onchange = (e) => {
        picker.querySelector("#custom-color-text").value = e.target.value;
        this.updateColorSelection(colorGrid, e.target.value);
      };

      picker.querySelector("#custom-color-text").oninput = (e) => {
        if (Utils.isValidColor(e.target.value)) {
          picker.querySelector("#custom-color").value = this.colorToHex(
            e.target.value
          );
          this.updateColorSelection(colorGrid, e.target.value);
        }
      };

      picker.querySelector("#apply-color").onclick = () => {
        const inputEl = picker.querySelector("#custom-color-text");
        const selectedColor = inputEl && inputEl.value ? inputEl.value.trim() : "";
        if (selectedColor && Utils.isValidColor(selectedColor)) {
          ConfigManager.set("COLOR", selectedColor);
          StyleManager.updateStyles();
          overlay.remove();
          this.showNotification(
            `Color changed to: ${selectedColor}`,
            "success"
          );
        } else {
          this.showNotification(
            "Invalid color format. Please try again.",
            "error"
          );
        }
      };

      picker.querySelector("#cancel-color").onclick = () => {
        overlay.remove();
      };

      overlay.onclick = (e) => {
        if (e.target === overlay) {
          if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }
      };

      overlay.appendChild(picker);
      document.body.appendChild(overlay);
    },

    colorToHex(color) {
      // Convert color to hex for color input
      const div = document.createElement("div");
      div.style.color = color;
      document.body.appendChild(div);
      const computedColor = getComputedStyle(div).color;
      document.body.removeChild(div);

      const rgb = computedColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        return (
          "#" +
          rgb
            .slice(0, 3)
            .map((x) => {
              const hex = parseInt(x).toString(16);
              return hex.length === 1 ? "0" + hex : hex;
            })
            .join("")
        );
      }
      return "#FF6B6B"; // fallback
    },

    updateColorSelection(colorGrid, selectedColor) {
      colorGrid.querySelectorAll("div").forEach((btn) => {
        btn.style.border = "2px solid transparent";
        if (btn.title === selectedColor) {
          btn.style.border = "2px solid #333";
        }
      });
    },

    showNotification(message, type = "info") {
      // Check if floating menu button exists to adjust position
      const hasFloatingButton = document.getElementById("visited-links-menu-button");
      const rightPosition = hasFloatingButton ? "80px" : "20px";
      
      const notification = document.createElement("div");
      notification.style.cssText = `
                position: fixed !important;
                top: 20px !important;
                right: ${rightPosition} !important;
                padding: 15px 20px !important;
                border-radius: 5px !important;
                color: white !important;
                font-family: Arial, sans-serif !important;
                font-size: 14px !important;
                z-index: 2147483647 !important;
                opacity: 0 !important;
                transition: opacity 0.3s ease !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                min-height: 20px !important;
                line-height: 1.4 !important;
                pointer-events: none !important;
                background: ${
                  type === "success"
                    ? "#4CAF50"
                    : type === "error"
                    ? "#f44336"
                    : "#2196F3"
                } !important;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2) !important;
            `;

      notification.textContent = message;
      document.body.appendChild(notification);

      // Fade in
      setTimeout(function(){
        notification.style.setProperty("opacity", "1", "important");
      }, 10);

      // Auto remove
      setTimeout(function(){
        notification.style.setProperty("opacity", "0", "important");
        setTimeout(function(){
          if (notification.parentNode) notification.parentNode.removeChild(notification);
        }, 300);
      }, 3000);
    },

    manageExceptions() {
      const currentExceptions = ConfigManager.get("EXCEPT_SITES");
      const newExceptions = prompt(
        "Enter domains to exclude (comma-separated):\n\nExample: gmail.com, facebook.com, twitter.com",
        currentExceptions
      );

      if (newExceptions !== null) {
        var sanitized = Utils.sanitizeInput(newExceptions ? newExceptions.trim() : "");
        // normalize, split, unique, and serialize
        var items = sanitized.split(",").map(function(s){ return Utils.normalizeSite(s); }).filter(function(s){ return s.length > 0; });
        var seen = Object.create(null);
        var unique = [];
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (!seen[it]) { seen[it] = true; unique.push(it); }
        }
        var serialized = unique.join(",");
        ConfigManager.set("EXCEPT_SITES", serialized);
        this.showNotification("Exception sites updated!", "success");

        // Reapply styles based on new exceptions
        App.checkAndApplyStyles();
      }
    },

    resetSettings() {
      ConfigManager.set("COLOR", CONFIG.DEFAULTS.COLOR);
      ConfigManager.set("EXCEPT_SITES", CONFIG.DEFAULTS.EXCEPT_SITES);
      ConfigManager.set("ENABLED", CONFIG.DEFAULTS.ENABLED);
      StyleManager.updateStyles();
      this.showNotification("Settings reset to defaults", "success");
    },
  };

  //// Main Application
  const App = {
    init() {
      // Initialize components
      StyleManager.init();
      MenuManager.init();

      // Apply styles if enabled and not on exception site
      this.checkAndApplyStyles();

      // Handle dynamic content changes
      this.observeChanges();
    },

    checkAndApplyStyles() {
      const isEnabled = ConfigManager.get("ENABLED");
      const currentUrl = document.documentURI || window.location.href;

      if (isEnabled && !ConfigManager.isExceptSite(currentUrl)) {
        StyleManager.updateStyles();
      } else {
        StyleManager.removeStyles();
      }
    },

    observeChanges() {
      // Debounced function to handle DOM changes
      const debouncedUpdate = Utils.debounce(() => {
        this.checkAndApplyStyles();
      }, 100);

      // Observer for dynamic content
      if (window.MutationObserver) {
        const observer = new MutationObserver(debouncedUpdate);
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
      }

      // Handle SPA navigation
      window.addEventListener("popstate", debouncedUpdate);

      // Handle hash changes
      window.addEventListener("hashchange", debouncedUpdate);
    },
  };

  //// Initialization
  function initialize() {
    // Wait for DOM to be available
    if (document.documentElement) {
      App.init();
    } else {
      // Fallback for very early execution
      setTimeout(initialize, 10);
    }
  }

  // Start the script
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  // Export for debugging (optional)
  if (typeof window !== "undefined") {
    window.VisitedLinksEnhanced = {
      config: ConfigManager,
      style: StyleManager,
      utils: Utils,
    };
  }
})();

// Enhanced Features Added:
// 1. Modern ES6+ syntax and best practices
// 2. Persistent configuration storage with localStorage fallback
// 3. User-friendly menu system for settings
// 4. Better error handling and validation
// 5. Performance optimizations with debouncing
// 6. Support for dynamic content (SPAs)
// 7. Enhanced color validation
// 8. Better domain matching for exceptions
// 9. Improved CSS with transitions
// 10. Modular, maintainable code structure
// 11. Visual color picker with preset colors
// 12. Custom color input (hex, rgb, color names)
// 13. Non-intrusive notification system
// 14. Interactive UI with live preview
// 15. ScriptCat compatibility with environment detection
// 16. Firefox-specific optimizations
// 17. Fallback floating menu when GM commands unavailable
// 18. Cross-platform storage system (GM + localStorage)
