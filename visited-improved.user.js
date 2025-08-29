// ==UserScript==
// @name         Visited Links Enhanced - Flat UI
// @namespace    com.userscript.visited-links-enhanced
// @description  Minimalist flat UI userscript for visited links customization
// @version      0.5.9
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

  //// Enhanced Configuration with Storage - Performance Optimized
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
    // Performance settings
    DEBOUNCE_DELAY: 150, // Reduced from 100ms for better performance
    MAX_OBSERVER_NODES: 1000, // Limit observer scope
  });

  // Color palette with names and style descriptions - comprehensive selection
  const COLOR_PALETTE = Object.freeze([
    // Pastel Colors - Soft & Eye-friendly
    { color: "#93c5fd", name: "Pastel Blue", desc: "Soft, calming" },
    { color: "#fca5a5", name: "Pastel Red", desc: "Gentle, warm" },
    { color: "#86efac", name: "Pastel Green", desc: "Fresh, natural" },
    { color: "#fed7aa", name: "Pastel Orange", desc: "Light, cheerful" },
    { color: "#f97316", name: "Vibrant Orange", desc: "Energetic, bold" },
    { color: "#c4b5fd", name: "Pastel Purple", desc: "Elegant, soft" },
    { color: "#f9a8d4", name: "Pastel Pink", desc: "Sweet, feminine" },
    { color: "#7dd3fc", name: "Pastel Sky Blue", desc: "Airy, peaceful" },
    { color: "#bef264", name: "Pastel Lime", desc: "Bright, lively" },
    { color: "#fde047", name: "Pastel Yellow", desc: "Sunny, optimistic" },
    { color: "#fb7185", name: "Pastel Rose", desc: "Romantic, soft" },
    { color: "#a78bfa", name: "Pastel Violet", desc: "Mystical, calm" },
    { color: "#34d399", name: "Pastel Emerald", desc: "Rich, serene" },
    
    // Bold Highlight Colors - Strong Visibility
    { color: "#dc2626", name: "Bold Red", desc: "Strong, attention" },
    { color: "#2563eb", name: "Bold Blue", desc: "Professional, trust" },
    { color: "#059669", name: "Bold Green", desc: "Success, nature" },
    { color: "#7c3aed", name: "Bold Purple", desc: "Creative, luxury" },
    { color: "#db2777", name: "Bold Pink", desc: "Vibrant, modern" },
    { color: "#ea580c", name: "Bold Orange", desc: "Dynamic, warm" },
    { color: "#0891b2", name: "Bold Cyan", desc: "Tech, cool" },
    { color: "#65a30d", name: "Bold Lime", desc: "Electric, fresh" },
    { color: "#ca8a04", name: "Bold Yellow", desc: "Warning, bright" },
    { color: "#be123c", name: "Bold Rose", desc: "Passionate, deep" },
    
    // Primary Colors - Classic & Standard
    { color: "#000000", name: "Black", desc: "Classic, strong" },
    { color: "#ffffff", name: "White", desc: "Clean, minimal" },
    { color: "#6b7280", name: "Gray", desc: "Neutral, subtle" },
    { color: "#ef4444", name: "Pure Red", desc: "Primary, bold" },
    { color: "#3b82f6", name: "Pure Blue", desc: "Primary, reliable" },
    { color: "#10b981", name: "Pure Green", desc: "Primary, fresh" },
    { color: "#8b5cf6", name: "Pure Purple", desc: "Primary, royal" },
    { color: "#f59e0b", name: "Pure Orange", desc: "Primary, energetic" },
    { color: "#eab308", name: "Pure Yellow", desc: "Primary, bright" },
  ]);

  //// Utility Functions - ES2023 Enhanced & Performance Optimized
  const Utils = Object.freeze({
    // Optimized debounce with immediate execution option
    debounce: (func, wait, immediate = false) => {
      let timeout;
      return (...args) => {
        const later = () => {
          timeout = null;
          if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
      };
    },

    // Cached color validation for performance
    _colorCache: new Map(),
    isValidColor: (color) => {
      if (Utils._colorCache.has(color)) {
        return Utils._colorCache.get(color);
      }
      
      try {
        const testElement = new Option();
        testElement.style.color = color;
        const isValid = testElement.style.color !== "";
        
        // Cache result with size limit
        if (Utils._colorCache.size > 100) {
          const firstKey = Utils._colorCache.keys().next().value;
          Utils._colorCache.delete(firstKey);
        }
        Utils._colorCache.set(color, isValid);
        return isValid;
      } catch {
        Utils._colorCache.set(color, false);
        return false;
      }
    },

    // Optimized domain extraction with caching
    _domainExtractionCache: new Map(),
    getDomain: (url) => {
      if (Utils._domainExtractionCache.has(url)) {
        return Utils._domainExtractionCache.get(url);
      }
      
      let domain = "";
      try {
        domain = new URL(url).hostname;
      } catch {
        // Faster fallback without DOM creation
        const match = url.match(/^https?:\/\/([^\/\?#]+)/i);
        domain = match ? match[1] : "";
      }
      
      // Cache with size limit
      if (Utils._domainExtractionCache.size > 200) {
        Utils._domainExtractionCache.clear();
      }
      Utils._domainExtractionCache.set(url, domain);
      return domain;
    },

    // Ultra-fast input sanitization
    sanitizeInput: (input) => {
      // Pre-compiled regex for better performance
      return input?.replace(/[<>"']/g, "") ?? "";
    },

    // ES2023 Array helper methods with fallbacks (unchanged for compatibility)
    arrayAt: (array, index) => {
      return ENVIRONMENT.supportsArrayAt ? array.at(index) : array[index < 0 ? array.length + index : index];
    },

    findLast: (array, predicate) => {
      if (ENVIRONMENT.supportsFindLast) {
        return array.findLast(predicate);
      }
      // Optimized fallback
      for (let i = array.length - 1; i >= 0; i--) {
        if (predicate(array[i], i, array)) {
          return array[i];
        }
      }
      return undefined;
    },

    // Always return light theme (no computation needed)
    getCurrentTheme: () => "light",
    
    // Clear all utility caches
    clearCaches: () => {
      Utils._colorCache.clear();
      Utils._domainExtractionCache.clear();
    },
  });

  //// Configuration Manager with Memory Optimization
  const ConfigManager = {
    // Cached values for performance
    _cache: new Map(),
    _storagePrefix: "visited_links_enhanced_",

    get(key) {
      // Return cached value if available
      if (this._cache.has(key)) {
        return this._cache.get(key);
      }

      const storageKey = CONFIG.STORAGE_KEYS[key];
      const defaultValue = CONFIG.DEFAULTS[key];
      let value = defaultValue;

      // Try GM_getValue first (ScriptCat/Tampermonkey)
      if (ENVIRONMENT.hasStorage) {
        try {
          value = GM_getValue(storageKey, defaultValue);
        } catch (e) {
          console.warn("[ScriptCat Compatibility] GM_getValue failed, trying localStorage:", e);
          
          // Fallback to localStorage
          try {
            const stored = localStorage.getItem(this._storagePrefix + storageKey);
            value = stored ? JSON.parse(stored) : defaultValue;
          } catch (e2) {
            console.warn("[Storage] Both GM and localStorage failed:", e2);
          }
        }
      }

      // Cache the value
      this._cache.set(key, value);
      return value;
    },

    set(key, value) {
      // Update cache first
      this._cache.set(key, value);
      
      const storageKey = CONFIG.STORAGE_KEYS[key];

      // Try GM_setValue first
      if (ENVIRONMENT.hasStorage) {
        try {
          GM_setValue(storageKey, value);
          return true;
        } catch (e) {
          console.warn("[ScriptCat Compatibility] GM_setValue failed, trying localStorage:", e);
        }
      }

      // Fallback to localStorage
      try {
        localStorage.setItem(this._storagePrefix + storageKey, JSON.stringify(value));
        return true;
      } catch (e) {
        console.warn("[Storage] Both GM and localStorage failed:", e);
        return false;
      }
    },

    // Optimized domain checking with memoization
    _domainCache: new Map(),
    
    isExceptSite(url) {
      // Check cache first
      if (this._domainCache.has(url)) {
        return this._domainCache.get(url);
      }

      const raw = this.get("EXCEPT_SITES");
      
      // Early return if no exceptions
      if (!raw?.trim()) {
        this._domainCache.set(url, false);
        return false;
      }
      
      // ES2023 enhanced array processing - optimized
      const exceptSites = raw.split(",")
        .map(site => site.trim().toLowerCase())
        .filter(Boolean); // More efficient than checking length

      const currentDomain = Utils.getDomain(url)?.toLowerCase() ?? "";
      
      // Early return if no domain
      if (!currentDomain) {
        this._domainCache.set(url, false);
        return false;
      }

      const isException = exceptSites.some(site => {
        // Remove protocol and www prefix for comparison using ES2023 replaceAll
        const cleanSite = site.replaceAll(/^(https?:\/\/)?(www\.)?/g, "");
        const cleanDomain = currentDomain.replaceAll(/^www\./g, "");

        return cleanDomain.includes(cleanSite) || cleanSite.includes(cleanDomain);
      });

      // Cache result and limit cache size
      if (this._domainCache.size > 50) {
        const firstKey = this._domainCache.keys().next().value;
        this._domainCache.delete(firstKey);
      }
      this._domainCache.set(url, isException);
      
      return isException;
    },

    // Clear caches when needed
    clearCache() {
      this._cache.clear();
      this._domainCache.clear();
      // Also clear utility caches
      Utils.clearCaches();
    },
  };

  //// Style Manager - Memory & DOM Optimized
  const StyleManager = {
    styleElement: null,
    _lastCSS: "", // Cache to avoid unnecessary DOM updates

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

      // Optimized insertion with priority order
      const target = document.head ?? document.documentElement;
      target?.appendChild?.(this.styleElement);

      return this.styleElement;
    },

    updateStyles() {
      const color = ConfigManager.get("COLOR");
      if (!Utils.isValidColor(color)) return;

      // Generate CSS only if color changed
      const css = CONFIG.CSS_TEMPLATE.replaceAll("%COLOR%", color);
      
      // Skip DOM update if CSS hasn't changed
      if (this._lastCSS === css) return;
      
      // Ensure style element exists
      if (!this.styleElement?.isConnected) {
        this.createStyleElement();
      }

      // Update DOM only when necessary
      this.styleElement.textContent = css;
      this._lastCSS = css;
    },

    removeStyles() {
      if (this.styleElement && this._lastCSS) {
        this.styleElement.textContent = "";
        this._lastCSS = "";
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
      // Ultra-optimized color picker with pre-computed strings
      const currentColor = ConfigManager.get("COLOR");
      
      // Lazy-build color options only when needed
      if (!this._cachedColorOptions) {
        this._cachedColorOptions = COLOR_PALETTE.map((item, index) => 
          `${index + 1}. ${item.name} - ${item.desc} (${item.color})`
        ).join('\n');
      }
      
      const choice = prompt(
        `🎨 Choose a color for visited links:\n\n${this._cachedColorOptions}\n\nEnter number (1-${COLOR_PALETTE.length}) or custom color code:`,
        currentColor
      );

      if (choice === null) return;

      const trimmedChoice = choice.trim();
      if (!trimmedChoice) return;
      
      let selectedColor;
      
      // Fast number parsing with validation
      const num = parseInt(trimmedChoice, 10);
      if (num >= 1 && num <= COLOR_PALETTE.length && trimmedChoice === num.toString()) {
        selectedColor = COLOR_PALETTE[num - 1].color;
      } else if (Utils.isValidColor(trimmedChoice)) {
        selectedColor = trimmedChoice;
      } else {
        alert("Invalid color format. Please try again.");
        return;
      }

      ConfigManager.set("COLOR", selectedColor);
      StyleManager.updateStyles();
      
      // Fast lookup with early return
      const colorItem = COLOR_PALETTE.find(item => item.color === selectedColor);
      const colorInfo = colorItem 
        ? `${colorItem.name} - ${colorItem.desc}`
        : "Custom Color";
      alert(`✅ Color changed to: ${colorInfo} (${selectedColor})`);
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
        
        // Clear caches for immediate effect
        ConfigManager.clearCache();
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
      // Ultra-optimized debounced function with immediate flag
      const debouncedUpdate = Utils.debounce(() => {
        this.checkAndApplyStyles();
      }, CONFIG.DEBOUNCE_DELAY);

      // Highly optimized MutationObserver
      if (window.MutationObserver) {
        const observer = new MutationObserver((mutations) => {
          // Fast-path: Early exit if no mutations
          if (!mutations.length) return;
          
          let hasRelevantChanges = false;
          let nodeCount = 0;
          
          // Optimized loop with early breaks
          for (const mutation of mutations) {
            const addedNodesLength = mutation.addedNodes.length;
            if (!addedNodesLength) continue;
            
            nodeCount += addedNodesLength;
            
            // Performance circuit breaker
            if (nodeCount > CONFIG.MAX_OBSERVER_NODES) {
              hasRelevantChanges = true;
              break;
            }
            
            // Fast link detection
            for (const node of mutation.addedNodes) {
              if (node.nodeType === 1) { // ELEMENT_NODE constant
                const tagName = node.tagName;
                if (tagName === 'A' || (tagName && node.querySelector && node.querySelector('a'))) {
                  hasRelevantChanges = true;
                  break;
                }
              }
            }
            
            if (hasRelevantChanges) break;
          }
          
          // Execute update only for relevant changes
          if (hasRelevantChanges) {
            debouncedUpdate();
          }
        });

        // Minimal observer configuration for maximum performance
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
      }

      // Passive event listeners for navigation changes
      const passiveOptions = { passive: true };
      window.addEventListener("popstate", debouncedUpdate, passiveOptions);
      window.addEventListener("hashchange", debouncedUpdate, passiveOptions);
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

// Ultra-Performance & Memory Optimized Features:
// 1. Simple built-in menu system only (no floating UI)
// 2. Prompt-based color picker with lazy loading
// 3. Alert-based notifications
// 4. No CSS animations or effects
// 5. Multi-level caching system (config, domain, color, CSS)
// 6. Optimized MutationObserver with smart filtering
// 7. Debounced updates with immediate execution option
// 8. Memoized domain checking with size limits
// 9. Passive event listeners for better performance
// 10. Regex optimization and pre-compilation
// 11. Fast-path optimizations and early returns
// 12. DOM update minimization with change detection
// 13. Cross-platform compatibility
// 14. Ultra-lightweight and blazing-fast performance
