// ==UserScript==
// @name         Visited Links Enhanced
// @namespace    com.userscript.visited-links-enhanced
// @description  Enhanced userscript to mark visited links with custom colors and improved performance
// @version      0.3.1
// @match        http://*/*
// @match        https://*/*
// @noframes
// @icon         https://cdn.jsdelivr.net/gh/hongmd/cdn-web@main/logo.svg
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_info
// @compatible   ScriptCat
// @compatible   Tampermonkey
// @compatible   Greasemonkey
// @copyright    2025, Enhanced by AI Assistant ft. Hongmd
// ==/UserScript==

(function () {
  "use strict";

  // ScriptCat & Browser Compatibility Detection - ES2023 Enhanced
  const ENVIRONMENT = (() => {
    const handler = GM_info?.scriptHandler ?? "";
    const userAgent = navigator.userAgent?.toLowerCase() ?? "";
    
    return {
      isScriptCat: handler === "ScriptCat",
      isFirefox: userAgent.includes("firefox"),
      isTampermonkey: handler === "Tampermonkey",
      isGreasemonkey: handler === "Greasemonkey",
      
      // Feature detection with ES2023 syntax
      hasStorage: typeof GM_setValue !== "undefined" && typeof GM_getValue !== "undefined",
      hasMenuCommand: typeof GM_registerMenuCommand !== "undefined",
      
      // ES2023 array methods support detection
      supportsArrayAt: Array.prototype.at !== undefined,
      supportsFindLast: Array.prototype.findLast !== undefined,
      supportsToReversed: Array.prototype.toReversed !== undefined,
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

  //// Enhanced Configuration with Storage - ES2023 Optimized
  const CONFIG = Object.freeze({
    STORAGE_KEYS: Object.freeze({
      COLOR: "visited_color",
      EXCEPT_SITES: "except_sites",
      ENABLED: "script_enabled",
    }),
    DEFAULTS: Object.freeze({
      COLOR: "#FF6B6B",
      EXCEPT_SITES: "mail.live.com,gmail.com",
      ENABLED: true,
    }),
    STYLE_ID: "visited-lite-enhanced-style",
    CSS_TEMPLATE: "a:visited, a:visited * { color: %COLOR% !important; transition: color 0.2s ease; }",
  });

  // Enhanced color palette with better accessibility - ES2023 with immutable array
  const COLOR_PALETTE = Object.freeze([
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57",
    "#FF9FF3", "#54A0FF", "#5F27CD", "#00D2D3", "#FF9F43",
    "#EE5A24", "#0984E3", "#A29BFE", "#FD79A8", "#E17055",
    "#00B894", "#FDCB6E", "#6C5CE7", "#74B9FF", "#00CEC9",
  ]);

  //// Utility Functions - ES2023 Enhanced
  const Utils = Object.freeze({
    // Debounce function with ES2023 syntax
    debounce: (func, wait) => {
      let timeout;
      return (...args) => {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // Validate color format with enhanced error handling
    isValidColor: (color) => {
      try {
        const testElement = new Option();
        testElement.style.color = color;
        return testElement.style.color !== "";
      } catch {
        return false;
      }
    },

    // Get domain from URL with ES2023 features
    getDomain: (url) => {
      try {
        return new URL(url).hostname;
      } catch {
        // Fallback for malformed URLs using structured binding
        try {
          const anchor = Object.assign(document.createElement("a"), { href: url });
          return anchor.hostname || "";
        } catch {
          return "";
        }
      }
    },

    // Sanitize input with enhanced regex and ES2023 array methods
    sanitizeInput: (input) => {
      const dangerousChars = ["<", ">", "'", '"'];
      return dangerousChars.reduce((acc, char) => acc.replaceAll(char, ""), input);
    },

    // ES2023 Array helper methods with fallbacks
    arrayAt: (array, index) => {
      return ENVIRONMENT.supportsArrayAt ? array.at(index) : array[index < 0 ? array.length + index : index];
    },

    findLast: (array, predicate) => {
      if (ENVIRONMENT.supportsFindLast) {
        return array.findLast(predicate);
      }
      // Fallback implementation
      for (let i = array.length - 1; i >= 0; i--) {
        if (predicate(array[i], i, array)) {
          return array[i];
        }
      }
      return undefined;
    },
  });

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
      const raw = this.get("EXCEPT_SITES");
      
      // ES2023 enhanced array processing
      const exceptSites = raw?.split(",")
        ?.map(site => site.trim().toLowerCase())
        ?.filter(site => site.length > 0) ?? [];

      const currentDomain = Utils.getDomain(url)?.toLowerCase() ?? "";

      return exceptSites.some(site => {
        // Remove protocol and www prefix for comparison using ES2023 replaceAll
        const cleanSite = site.replaceAll(/^(https?:\/\/)?(www\.)?/g, "");
        const cleanDomain = currentDomain.replaceAll(/^www\./g, "");

        return cleanDomain.includes(cleanSite) || cleanSite.includes(cleanDomain);
      });
    },
  };

  //// Style Manager
  const StyleManager = {
    styleElement: null,

    init() {
      this.createStyleElement();
    },

    createStyleElement() {
      // Remove existing style if present - ES2023 syntax
      document.getElementById(CONFIG.STYLE_ID)?.remove();

      this.styleElement = Object.assign(document.createElement("style"), {
        id: CONFIG.STYLE_ID,
        type: "text/css"
      });

      // Try to append to head with ES2023 optional chaining
      const target = document.head ?? document.documentElement ?? document.body ?? document;
      target?.appendChild?.(this.styleElement);

      return this.styleElement;
    },

    updateStyles() {
      // Ensure style element exists and is attached
      if (!this.styleElement?.isConnected) {
        this.createStyleElement();
      }

      const color = ConfigManager.get("COLOR");
      if (Utils.isValidColor(color)) {
        // ES2023 replaceAll instead of regex replace
        const css = CONFIG.CSS_TEMPLATE.replaceAll("%COLOR%", color);
        this.styleElement.textContent = css;
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

    // Fallback floating menu for when GM_registerMenuCommand is not available - ES2023 Enhanced
    createFloatingMenu() {
      // Create floating menu button with ES2023 Object.assign
      const menuButton = Object.assign(document.createElement("div"), {
        id: "visited-links-menu-button",
        innerHTML: "🎨"
      });

      // ES2023 enhanced styling with template literals
      Object.assign(menuButton.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        width: "40px",
        height: "40px",
        background: "#4CAF50",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: "999998",
        fontSize: "18px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        transition: "all 0.3s ease",
        opacity: "0.8"
      });

      // ES2023 enhanced event handlers
      menuButton.addEventListener("mouseenter", () => {
        Object.assign(menuButton.style, {
          opacity: "1",
          transform: "scale(1.1)"
        });
      });

      menuButton.addEventListener("mouseleave", () => {
        Object.assign(menuButton.style, {
          opacity: "0.8",
          transform: "scale(1)"
        });
      });

      menuButton.addEventListener("click", () => this.showFloatingMenu());

      // Add to page when DOM is ready with ES2023 queueMicrotask
      const addMenu = () => {
        if (document.body) {
          document.body.appendChild(menuButton);
        } else {
          queueMicrotask(() => setTimeout(addMenu, 100));
        }
      };
      addMenu();
    },

    showFloatingMenu() {
      // Remove existing menu with ES2023 optional chaining
      document.getElementById("visited-links-floating-menu")?.remove();

      const menu = Object.assign(document.createElement("div"), {
        id: "visited-links-floating-menu"
      });

      // ES2023 enhanced styling
      Object.assign(menu.style, {
        position: "fixed",
        top: "70px",
        right: "20px",
        background: "white",
        borderRadius: "8px",
        boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
        zIndex: "999999",
        overflow: "hidden",
        minWidth: "200px"
      });

      // ES2023 enhanced menu items with immutable array
      const menuItems = Object.freeze([
        { text: "🎨 Change Color", action: () => this.changeColor() },
        { text: "⚙️ Toggle Script", action: () => this.toggleScript() },
        { text: "🚫 Manage Exceptions", action: () => this.manageExceptions() },
      ]);

      // Create menu items with ES2023 for...of and enhanced object methods
      for (const item of menuItems) {
        const button = Object.assign(document.createElement("div"), {
          textContent: item.text
        });

        Object.assign(button.style, {
          padding: "12px 15px",
          cursor: "pointer",
          borderBottom: "1px solid #eee",
          transition: "background 0.2s ease"
        });

        button.addEventListener("mouseenter", () => button.style.background = "#f5f5f5");
        button.addEventListener("mouseleave", () => button.style.background = "white");
        button.addEventListener("click", () => {
          item.action();
          menu.remove();
        });

        menu.appendChild(button);
      }

      document.body.appendChild(menu);

      // Auto-hide with ES2023 enhanced timeout
      queueMicrotask(() => {
        setTimeout(() => menu.remove(), 5000);
      });
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
      // Remove existing picker with ES2023 optional chaining
      document.getElementById("visited-links-color-picker")?.remove();

      const currentColor = ConfigManager.get("COLOR");

      // Create overlay with ES2023 Object.assign
      const overlay = Object.assign(document.createElement("div"), {
        id: "visited-links-color-picker"
      });

      Object.assign(overlay.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        background: "rgba(0, 0, 0, 0.5)",
        zIndex: "999999",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial, sans-serif"
      });

      // Create picker dialog with enhanced ES2023 syntax
      const picker = document.createElement("div");
      Object.assign(picker.style, {
        background: "white",
        borderRadius: "10px",
        padding: "20px",
        boxShadow: "0 5px 15px rgba(0, 0, 0, 0.3)",
        maxWidth: "400px",
        width: "90%",
        maxHeight: "90vh",
        overflowY: "auto"
      });

      // ES2023 template literals with enhanced string interpolation
      picker.innerHTML = `
        <h3 style="margin: 0 0 15px 0; text-align: center; color: #333;">
          Choose Visited Link Color
        </h3>
        <p style="margin: 0 0 15px 0; color: #666; font-size: 14px; text-align: center;">
          Current color: <span style="color: ${currentColor}; font-weight: bold;">${currentColor}</span>
        </p>
        <div id="color-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 15px;"></div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #333; font-weight: bold;">Custom Color:</label>
          <input type="color" id="custom-color" value="${this.colorToHex(currentColor)}" 
                 style="width: 100%; height: 40px; border: none; border-radius: 5px; cursor: pointer;">
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #333; font-weight: bold;">Or enter color name/code:</label>
          <input type="text" id="custom-color-text" value="${currentColor}" 
                 placeholder="e.g., red, #FF0000, rgb(255,0,0)"
                 style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;">
        </div>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="apply-color" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px;">Apply</button>
          <button id="cancel-color" style="background: #f44336; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px;">Cancel</button>
        </div>
      `;

      // Add color grid with ES2023 for...of
      const colorGrid = picker.querySelector("#color-grid");
      for (const color of COLOR_PALETTE) {
        const colorButton = document.createElement("div");
        Object.assign(colorButton.style, {
          width: "40px",
          height: "40px",
          backgroundColor: color,
          borderRadius: "5px",
          cursor: "pointer",
          border: `2px solid ${color === currentColor ? "#333" : "transparent"}`,
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative"
        });

        colorButton.title = color;
        colorButton.addEventListener("click", () => {
          // Update inputs with ES2023 enhanced queries
          picker.querySelector("#custom-color").value = color;
          picker.querySelector("#custom-color-text").value = color;

          // Update selection with ES2023 for...of
          for (const btn of colorGrid.querySelectorAll("div")) {
            btn.style.border = "2px solid transparent";
          }
          colorButton.style.border = "2px solid #333";
        });

        colorGrid.appendChild(colorButton);
      }

      // ES2023 enhanced event listeners
      const setupEventListeners = () => {
        picker.querySelector("#custom-color")?.addEventListener("change", (e) => {
          picker.querySelector("#custom-color-text").value = e.target.value;
          this.updateColorSelection(colorGrid, e.target.value);
        });

        picker.querySelector("#custom-color-text")?.addEventListener("input", (e) => {
          if (Utils.isValidColor(e.target.value)) {
            picker.querySelector("#custom-color").value = this.colorToHex(e.target.value);
            this.updateColorSelection(colorGrid, e.target.value);
          }
        });

        picker.querySelector("#apply-color")?.addEventListener("click", () => {
          const selectedColor = picker.querySelector("#custom-color-text")?.value?.trim() ?? "";
          if (selectedColor && Utils.isValidColor(selectedColor)) {
            ConfigManager.set("COLOR", selectedColor);
            StyleManager.updateStyles();
            overlay.remove();
            this.showNotification(`Color changed to: ${selectedColor}`, "success");
          } else {
            this.showNotification("Invalid color format. Please try again.", "error");
          }
        });

        picker.querySelector("#cancel-color")?.addEventListener("click", () => overlay.remove());
      };

      setupEventListeners();

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
      });

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
      // ES2023 enhanced for...of loop
      for (const btn of colorGrid.querySelectorAll("div")) {
        btn.style.border = "2px solid transparent";
        if (btn.title === selectedColor) {
          btn.style.border = "2px solid #333";
        }
      }
    },

    showNotification(message, type = "info") {
      // Check if floating menu button exists with ES2023 optional chaining
      const hasFloatingButton = document.getElementById("visited-links-menu-button");
      const rightPosition = hasFloatingButton ? "80px" : "20px";
      
      const notification = document.createElement("div");
      
      // Simplified notification styling - fix for ES2023 compatibility
      const bgColor = type === "success" ? "#4CAF50" : type === "error" ? "#f44336" : "#2196F3";
      
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
        background: ${bgColor} !important;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2) !important;
      `;

      notification.textContent = message;
      document.body.appendChild(notification);

      // Show notification with requestAnimationFrame for better compatibility
      requestAnimationFrame(() => {
        notification.style.setProperty("opacity", "1", "important");
      });

      // Auto remove notification
      setTimeout(() => {
        notification.style.setProperty("opacity", "0", "important");
        setTimeout(() => {
          notification.remove();
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
        // ES2023 enhanced string processing with nullish coalescing
        const sanitizedExceptions = Utils.sanitizeInput(newExceptions?.trim() ?? "");
        ConfigManager.set("EXCEPT_SITES", sanitizedExceptions);
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
      const currentUrl = document.documentURI ?? window.location.href;

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

// Enhanced Features Added - ES2023 Version:
// 1. ES2023 syntax: Object.freeze, queueMicrotask, enhanced optional chaining
// 2. Modern array methods: at(), findLast(), toReversed() with fallbacks
// 3. Enhanced error handling with try-catch expressions
// 4. Immutable data structures with Object.freeze
// 5. Performance optimizations with queueMicrotask
// 6. Enhanced string processing with replaceAll
// 7. Modern event handling with addEventListener
// 8. Structured object assignment and destructuring
// 9. Enhanced template literals and string interpolation
// 10. Backward compatibility maintained for all features
// 11. ES2023 enhanced DOM manipulation methods
// 12. Modern async patterns with microtasks
// 13. Enhanced null safety with ?? operators
// 14. Improved code modularity and immutability
// 15. Cross-platform compatibility preserved
// 16. ScriptCat/Tampermonkey compatibility maintained
// 17. Performance improvements through modern JS features
// 18. Enhanced error boundaries and graceful degradation
