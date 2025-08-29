// ==UserScript==
// @name         Visited Links Enhanced - Flat UI
// @namespace    com.userscript.visited-links-enhanced
// @description  Minimalist flat UI userscript for visited links customization
// @version      0.5.2
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

  //// Enhanced Configuration with Storage - Flat UI
  const CONFIG = Object.freeze({
    STORAGE_KEYS: Object.freeze({
      COLOR: "visited_color",
      EXCEPT_SITES: "except_sites",
      ENABLED: "script_enabled",
    }),
    DEFAULTS: Object.freeze({
      COLOR: "#f97316", // orange color
      EXCEPT_SITES: "mail.live.com,gmail.com",
      ENABLED: true,
    }),
    STYLE_ID: "visited-lite-enhanced-style",
    CSS_TEMPLATE: "a:visited, a:visited * { color: %COLOR% !important; }",
  });

  // Pastel color palette with names - soft and eye-friendly colors
  const COLOR_PALETTE = Object.freeze([
    { color: "#93c5fd", name: "Pastel Blue" },
    { color: "#fca5a5", name: "Pastel Red" },
    { color: "#86efac", name: "Pastel Green" },
    { color: "#fed7aa", name: "Pastel Orange" },
    { color: "#c4b5fd", name: "Pastel Purple" },
    { color: "#f9a8d4", name: "Pastel Pink" },
    { color: "#7dd3fc", name: "Pastel Sky Blue" },
    { color: "#bef264", name: "Pastel Lime" },
    { color: "#fde047", name: "Pastel Yellow" },
    { color: "#fb7185", name: "Pastel Rose" },
    { color: "#a78bfa", name: "Pastel Violet" },
    { color: "#34d399", name: "Pastel Emerald" },
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

    // Get current theme based on settings
    getCurrentTheme: () => {
      return "light"; // Always use light theme for flat UI
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

  //// Menu System - Simple Built-in Menu Only
  const MenuManager = {
    init() {
      console.log("[Visited Links Enhanced] Initializing simple menu system...");
      
      // Only use built-in GM menu commands - no floating UI
      if (ENVIRONMENT.hasMenuCommand) {
        try {
          GM_registerMenuCommand("🎨 Change Color", this.changeColor.bind(this));
          GM_registerMenuCommand("⚙️ Toggle Script", this.toggleScript.bind(this));
          GM_registerMenuCommand("🚫 Manage Exceptions", this.manageExceptions.bind(this));
          GM_registerMenuCommand("🔄 Reset Settings", this.resetSettings.bind(this));

          console.log("[Visited Links Enhanced] Menu commands registered successfully");
        } catch (e) {
          console.warn("[Menu] Menu registration failed:", e);
        }
      } else {
        console.log("[Menu] GM_registerMenuCommand not available");
      }
    },

    toggleScript() {
      const currentState = ConfigManager.get("ENABLED");
      const newState = !currentState;
      ConfigManager.set("ENABLED", newState);

      if (newState) {
        StyleManager.updateStyles();
        alert(`Visited Links Enhanced: Enabled`);
      } else {
        StyleManager.removeStyles();
        alert(`Visited Links Enhanced: Disabled`);
      }
    },

    changeColor() {
      this.createSimpleColorPicker();
    },

    createSimpleColorPicker() {
      // Simple prompt-based color picker with color names
      const currentColor = ConfigManager.get("COLOR");
      
      const colorOptions = COLOR_PALETTE.map((item, index) => 
        `${index + 1}. ${item.name} (${item.color})`
      ).join('\n');
      
      const choice = prompt(
        `Choose a color for visited links:\n\n${colorOptions}\n\nEnter number (1-${COLOR_PALETTE.length}) or custom color code:`,
        currentColor
      );

      if (choice !== null) {
        let selectedColor;
        
        // Check if it's a number selection
        const num = parseInt(choice);
        if (num >= 1 && num <= COLOR_PALETTE.length) {
          selectedColor = COLOR_PALETTE[num - 1].color;
        } else if (Utils.isValidColor(choice.trim())) {
          selectedColor = choice.trim();
        } else {
          alert("Invalid color format. Please try again.");
          return;
        }

        ConfigManager.set("COLOR", selectedColor);
        StyleManager.updateStyles();
        
        // Find color name for confirmation message
        const colorItem = COLOR_PALETTE.find(item => item.color === selectedColor);
        const colorName = colorItem ? colorItem.name : "Custom Color";
        alert(`Color changed to: ${colorName} (${selectedColor})`);
      }
    },

    manageExceptions() {
      const currentExceptions = ConfigManager.get("EXCEPT_SITES");
      const newExceptions = prompt(
        "Enter domains to exclude (comma-separated):\n\nExample: gmail.com, facebook.com, twitter.com",
        currentExceptions
      );

      if (newExceptions !== null) {
        const sanitizedExceptions = Utils.sanitizeInput(newExceptions?.trim() ?? "");
        ConfigManager.set("EXCEPT_SITES", sanitizedExceptions);
        alert("Exception sites updated!");
        App.checkAndApplyStyles();
      }
    },

    resetSettings() {
      if (confirm("Reset all settings to defaults?")) {
        ConfigManager.set("COLOR", CONFIG.DEFAULTS.COLOR);
        ConfigManager.set("EXCEPT_SITES", CONFIG.DEFAULTS.EXCEPT_SITES);
        ConfigManager.set("ENABLED", CONFIG.DEFAULTS.ENABLED);
        StyleManager.updateStyles();
        alert("Settings reset to defaults");
      }
    },
  };

  //// Main Application - Simplified
  const App = {
    init() {
      console.log("[Visited Links Enhanced] Initializing flat UI app...");
      
      // Initialize components
      StyleManager.init();
      MenuManager.init();

      // Apply styles if enabled and not on exception site
      this.checkAndApplyStyles();

      // Handle dynamic content changes
      this.observeChanges();
      
      console.log("[Visited Links Enhanced] Flat UI app initialization complete");
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

  //// Initialization - Simplified
  function initialize() {
    if (document.documentElement) {
      App.init();
      console.log("[Visited Links Enhanced] Flat UI script initialized successfully");
    } else {
      setTimeout(initialize, 50);
    }
  }

  // Start the script
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  // Export for debugging
  if (typeof window !== "undefined") {
    window.VisitedLinksEnhanced = {
      config: ConfigManager,
      style: StyleManager,
      utils: Utils,
    };
  }
})();

// Flat UI Features:
// 1. Simple built-in menu system only (no floating UI)
// 2. Prompt-based color picker for simplicity  
// 3. Alert-based notifications
// 4. No CSS animations or effects
// 5. Minimal memory footprint
// 6. Essential functionality only
// 7. Cross-platform compatibility
// 8. Lightweight and fast performance
