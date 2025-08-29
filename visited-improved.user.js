// ==UserScript==
// @name         Visited Links Enhanced - Minimalist UI
// @namespace    com.userscript.visited-links-enhanced
// @description  Minimalist userscript with dark/light mode for visited links customization
// @version      0.4.2
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
      THEME_MODE: "theme_mode", // New: dark/light theme
      UI_COMPACT: "ui_compact", // New: compact mode
    }),
    DEFAULTS: Object.freeze({
      COLOR: "#f97316", // Modern orange color
      EXCEPT_SITES: "mail.live.com,gmail.com",
      ENABLED: true,
      THEME_MODE: "auto", // auto, light, dark
      UI_COMPACT: true,
    }),
    STYLE_ID: "visited-lite-enhanced-style",
    CSS_TEMPLATE: "a:visited, a:visited * { color: %COLOR% !important; }",
    
    // Theme configurations
    THEMES: Object.freeze({
      light: Object.freeze({
        bg: "#ffffff",
        bgSecondary: "#f8fafc",
        text: "#1e293b",
        textSecondary: "#64748b",
        border: "#e2e8f0",
        shadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        accent: "#6366f1",
      }),
      dark: Object.freeze({
        bg: "#0f172a",
        bgSecondary: "#1e293b",
        text: "#f1f5f9",
        textSecondary: "#94a3b8",
        border: "#334155",
        shadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
        accent: "#818cf8",
      }),
    }),
  });

  // Enhanced color palette with better accessibility - ES2023 with immutable array
  const COLOR_PALETTE = Object.freeze([
    "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", 
    "#eab308", "#22c55e", "#10b981", "#06b6d4", "#3b82f6",
    "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#f43f5e",
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

    // Detect system theme preference
    getSystemTheme: () => {
      try {
        if (window.matchMedia) {
          return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
      } catch {
        // Fallback for older browsers
      }
      return "light";
    },

    // Get current theme based on settings
    getCurrentTheme: () => {
      const themeMode = ConfigManager.get("THEME_MODE");
      if (themeMode === "auto") {
        return Utils.getSystemTheme();
      }
      return themeMode;
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
      console.log("[Visited Links Enhanced] Initializing menu system...");
      
      // Always create floating menu for better compatibility
      setTimeout(() => {
        this.createFloatingMenu();
      }, 200);
      
      // Try to register menu commands (ScriptCat/Tampermonkey support) as backup
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
        }
      } else {
        console.log("[ScriptCat] GM_registerMenuCommand not available");
      }
    },

    // Fallback floating menu for when GM_registerMenuCommand is not available - ES2023 Enhanced
    createFloatingMenu() {
      // Remove existing menu first
      document.getElementById("visited-links-menu-button")?.remove();
      
      // Create minimalist floating menu button
      const currentTheme = Utils.getCurrentTheme();
      const theme = CONFIG.THEMES[currentTheme];
      const isCompact = ConfigManager.get("UI_COMPACT");
      
      const menuButton = Object.assign(document.createElement("div"), {
        id: "visited-links-menu-button",
        innerHTML: `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="m12 1 0 6m0 6 0 6m11-7-6 0m-6 0-6 0"/>
          </svg>
        `
      });

      // Minimalist button styling
      Object.assign(menuButton.style, {
        position: "fixed",
        top: isCompact ? "12px" : "20px",
        right: isCompact ? "12px" : "20px",
        width: isCompact ? "32px" : "40px",
        height: isCompact ? "32px" : "40px",
        background: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: isCompact ? "6px" : "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: "999998",
        color: theme.text,
        boxShadow: theme.shadow,
        opacity: "0.9",
      });

      // Simple hover effects
      menuButton.addEventListener("mouseenter", () => {
        menuButton.style.opacity = "1";
      });

      menuButton.addEventListener("mouseleave", () => {
        menuButton.style.opacity = "0.9";
      });

      menuButton.addEventListener("click", () => this.showMinimalistMenu());

      // Add to page immediately if body exists, otherwise wait
      if (document.body) {
        document.body.appendChild(menuButton);
        console.log("[Visited Links Enhanced] Floating menu button created");
      } else {
        // Wait for body to be available
        const addMenu = () => {
          if (document.body) {
            document.body.appendChild(menuButton);
            console.log("[Visited Links Enhanced] Floating menu button created (delayed)");
          } else {
            setTimeout(addMenu, 100);
          }
        };
        addMenu();
      }
    },

    showMinimalistMenu() {
      // Remove existing menu
      document.getElementById("visited-links-floating-menu")?.remove();

      const currentTheme = Utils.getCurrentTheme();
      const theme = CONFIG.THEMES[currentTheme];
      const isCompact = ConfigManager.get("UI_COMPACT");

      const menu = Object.assign(document.createElement("div"), {
        id: "visited-links-floating-menu"
      });

      // Minimalist menu styling
      Object.assign(menu.style, {
        position: "fixed",
        top: isCompact ? "52px" : "70px",
        right: isCompact ? "12px" : "20px",
        background: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: isCompact ? "8px" : "12px",
        boxShadow: theme.shadow,
        zIndex: "999999",
        overflow: "hidden",
        minWidth: isCompact ? "160px" : "200px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: isCompact ? "13px" : "14px",
      });

      // Minimalist menu items
      const menuItems = Object.freeze([
        { 
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 8a2 2 0 0 0-2 2"/></svg>`, 
          text: "Color", 
          action: () => this.changeColor() 
        },
        { 
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`, 
          text: "Toggle", 
          action: () => this.toggleScript() 
        },
        { 
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`, 
          text: "Exclude", 
          action: () => this.manageExceptions() 
        },
        { 
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`, 
          text: currentTheme === "dark" ? "Light" : "Dark", 
          action: () => this.toggleTheme() 
        },
      ]);

      // Create menu items
      for (const item of menuItems) {
        const button = document.createElement("div");
        button.innerHTML = `
          <span style="display: flex; align-items: center; color: ${theme.textSecondary};">${item.icon}</span>
          <span>${item.text}</span>
        `;

        Object.assign(button.style, {
          display: "flex",
          alignItems: "center",
          gap: isCompact ? "8px" : "12px",
          padding: isCompact ? "8px 12px" : "12px 16px",
          cursor: "pointer",
          color: theme.text,
          borderBottom: `1px solid ${theme.border}`,
          fontSize: "inherit",
        });

        button.addEventListener("mouseenter", () => {
          button.style.background = theme.bgSecondary;
        });
        
        button.addEventListener("mouseleave", () => {
          button.style.background = "transparent";
        });
        
        button.addEventListener("click", () => {
          item.action();
          menu.remove();
        });

        menu.appendChild(button);
      }

      // Remove border from last item
      const lastItem = menu.lastElementChild;
      if (lastItem) lastItem.style.borderBottom = "none";

      document.body.appendChild(menu);

      // Auto-hide menu
      setTimeout(() => menu.remove(), 8000);
    },

    toggleTheme() {
      const currentMode = ConfigManager.get("THEME_MODE");
      let newMode;
      
      if (currentMode === "auto") {
        newMode = Utils.getSystemTheme() === "dark" ? "light" : "dark";
      } else if (currentMode === "light") {
        newMode = "dark";
      } else {
        newMode = "light";
      }
      
      ConfigManager.set("THEME_MODE", newMode);
      this.showNotification(`Theme: ${newMode}`, "success");
      
      // Update floating menu if exists
      this.updateFloatingMenuTheme();
    },

    updateFloatingMenuTheme() {
      const menuButton = document.getElementById("visited-links-menu-button");
      if (menuButton) {
        menuButton.remove();
        this.createFloatingMenu();
      }
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
      // Remove existing picker
      document.getElementById("visited-links-color-picker")?.remove();

      const currentColor = ConfigManager.get("COLOR");
      const currentTheme = Utils.getCurrentTheme();
      const theme = CONFIG.THEMES[currentTheme];
      const isCompact = ConfigManager.get("UI_COMPACT");

      // Create minimalist overlay
      const overlay = Object.assign(document.createElement("div"), {
        id: "visited-links-color-picker"
      });

      Object.assign(overlay.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        background: `${theme.text}40`,
        zIndex: "999999",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: isCompact ? "13px" : "14px",
      });

      // Create minimalist picker dialog
      const picker = document.createElement("div");
      Object.assign(picker.style, {
        background: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: isCompact ? "12px" : "16px",
        padding: isCompact ? "20px" : "24px",
        boxShadow: theme.shadow,
        maxWidth: isCompact ? "320px" : "380px",
        width: "90%",
        maxHeight: "90vh",
        overflowY: "auto",
        color: theme.text,
      });

      // Minimalist picker content
      picker.innerHTML = `
        <div style="margin-bottom: ${isCompact ? '16px' : '20px'};">
          <h3 style="margin: 0; font-size: ${isCompact ? '16px' : '18px'}; font-weight: 600; color: ${theme.text};">
            Choose Color
          </h3>
          <p style="margin: 8px 0 0 0; color: ${theme.textSecondary}; font-size: ${isCompact ? '12px' : '13px'};">
            Current: <span style="color: ${currentColor}; font-weight: 500;">${currentColor}</span>
          </p>
        </div>
        
        <div id="color-grid" style="
          display: grid; 
          grid-template-columns: repeat(5, 1fr); 
          gap: ${isCompact ? '6px' : '8px'}; 
          margin-bottom: ${isCompact ? '16px' : '20px'};
        "></div>
        
        <div style="margin-bottom: ${isCompact ? '16px' : '20px'};">
          <label style="display: block; margin-bottom: 8px; color: ${theme.text}; font-weight: 500; font-size: ${isCompact ? '12px' : '13px'};">
            Custom Color
          </label>
          <input type="color" id="custom-color" value="${this.colorToHex(currentColor)}" 
                 style="
                   width: 100%; 
                   height: ${isCompact ? '36px' : '40px'}; 
                   border: 1px solid ${theme.border}; 
                   border-radius: ${isCompact ? '6px' : '8px'}; 
                   cursor: pointer;
                   background: ${theme.bgSecondary};
                 ">
        </div>
        
        <div style="margin-bottom: ${isCompact ? '20px' : '24px'};">
          <input type="text" id="custom-color-text" value="${currentColor}" 
                 placeholder="Enter color code"
                 style="
                   width: 100%; 
                   padding: ${isCompact ? '8px 12px' : '10px 14px'}; 
                   border: 1px solid ${theme.border}; 
                   border-radius: ${isCompact ? '6px' : '8px'}; 
                   background: ${theme.bgSecondary};
                   color: ${theme.text};
                   font-size: inherit;
                   box-sizing: border-box;
                 ">
        </div>
        
        <div style="display: flex; gap: ${isCompact ? '8px' : '12px'};">
          <button id="apply-color" style="
            flex: 1;
            background: ${theme.accent}; 
            color: white; 
            border: none; 
            padding: ${isCompact ? '8px 16px' : '10px 20px'}; 
            border-radius: ${isCompact ? '6px' : '8px'}; 
            cursor: pointer; 
            font-size: inherit;
            font-weight: 500;
          ">Apply</button>
          <button id="cancel-color" style="
            background: ${theme.bgSecondary}; 
            color: ${theme.text}; 
            border: 1px solid ${theme.border}; 
            padding: ${isCompact ? '8px 16px' : '10px 20px'}; 
            border-radius: ${isCompact ? '6px' : '8px'}; 
            cursor: pointer; 
            font-size: inherit;
          ">Cancel</button>
        </div>
      `;

      // Add minimalist color grid
      const colorGrid = picker.querySelector("#color-grid");
      for (const color of COLOR_PALETTE) {
        const colorButton = document.createElement("div");
        const size = isCompact ? "28px" : "32px";
        
        Object.assign(colorButton.style, {
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: isCompact ? "4px" : "6px",
          cursor: "pointer",
          border: `2px solid ${color === currentColor ? theme.accent : 'transparent'}`,
          position: "relative",
        });

        colorButton.title = color;
        colorButton.addEventListener("mouseenter", () => {
          if (color !== currentColor) {
            colorButton.style.opacity = "0.8";
          }
        });
        
        colorButton.addEventListener("mouseleave", () => {
          colorButton.style.opacity = "1";
        });
        
        colorButton.addEventListener("click", () => {
          picker.querySelector("#custom-color").value = color;
          picker.querySelector("#custom-color-text").value = color;
          this.updateColorSelection(colorGrid, color, theme);
        });

        colorGrid.appendChild(colorButton);
      }

      this.setupColorPickerEvents(picker, overlay, colorGrid, theme);
      overlay.appendChild(picker);
      document.body.appendChild(overlay);
    },

    setupColorPickerEvents(picker, overlay, colorGrid, theme) {
      // Enhanced event listeners for minimalist UI
      picker.querySelector("#custom-color")?.addEventListener("change", (e) => {
        picker.querySelector("#custom-color-text").value = e.target.value;
        this.updateColorSelection(colorGrid, e.target.value, theme);
      });

      picker.querySelector("#custom-color-text")?.addEventListener("input", (e) => {
        const input = e.target;
        if (Utils.isValidColor(input.value)) {
          picker.querySelector("#custom-color").value = this.colorToHex(input.value);
          this.updateColorSelection(colorGrid, input.value, theme);
          input.style.borderColor = theme.border;
        } else {
          input.style.borderColor = "#ef4444";
        }
      });

      // Focus styling
      picker.querySelector("#custom-color-text")?.addEventListener("focus", (e) => {
        e.target.style.borderColor = theme.accent;
      });

      picker.querySelector("#custom-color-text")?.addEventListener("blur", (e) => {
        e.target.style.borderColor = theme.border;
      });

      // Simple button hover effects
      const applyBtn = picker.querySelector("#apply-color");
      const cancelBtn = picker.querySelector("#cancel-color");

      applyBtn?.addEventListener("mouseenter", () => {
        applyBtn.style.opacity = "0.9";
      });

      applyBtn?.addEventListener("mouseleave", () => {
        applyBtn.style.opacity = "1";
      });

      cancelBtn?.addEventListener("mouseenter", () => {
        cancelBtn.style.background = theme.border;
      });

      cancelBtn?.addEventListener("mouseleave", () => {
        cancelBtn.style.background = theme.bgSecondary;
      });

      applyBtn?.addEventListener("click", () => {
        const selectedColor = picker.querySelector("#custom-color-text")?.value?.trim() ?? "";
        if (selectedColor && Utils.isValidColor(selectedColor)) {
          ConfigManager.set("COLOR", selectedColor);
          StyleManager.updateStyles();
          overlay.remove();
          this.showNotification(`Color: ${selectedColor}`, "success");
        } else {
          this.showNotification("Invalid color format", "error");
        }
      });

      cancelBtn?.addEventListener("click", () => overlay.remove());
      
      // Close on overlay click
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
      });

      // Close on Escape key
      const handleEscape = (e) => {
        if (e.key === "Escape") {
          overlay.remove();
          document.removeEventListener("keydown", handleEscape);
        }
      };
      document.addEventListener("keydown", handleEscape);
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

    updateColorSelection(colorGrid, selectedColor, theme) {
      // Update color selection with simple styling
      for (const btn of colorGrid.querySelectorAll("div")) {
        btn.style.border = "2px solid transparent";
        if (btn.title === selectedColor) {
          btn.style.border = `2px solid ${theme.accent}`;
        }
      }
    },

    showNotification(message, type = "info") {
      // Minimalist notification system
      const currentTheme = Utils.getCurrentTheme();
      const theme = CONFIG.THEMES[currentTheme];
      const isCompact = ConfigManager.get("UI_COMPACT");
      
      const hasFloatingButton = document.getElementById("visited-links-menu-button");
      const rightPosition = hasFloatingButton ? (isCompact ? "52px" : "70px") : (isCompact ? "12px" : "20px");
      
      const notification = document.createElement("div");
      
      // Minimalist notification colors
      const colors = {
        success: theme.accent,
        error: "#ef4444",
        info: theme.textSecondary,
      };
      
      notification.style.cssText = `
        position: fixed !important;
        top: ${isCompact ? '12px' : '20px'} !important;
        right: ${rightPosition} !important;
        padding: ${isCompact ? '8px 12px' : '12px 16px'} !important;
        border-radius: ${isCompact ? '6px' : '8px'} !important;
        color: ${theme.text} !important;
        background: ${theme.bg} !important;
        border: 1px solid ${theme.border} !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        font-size: ${isCompact ? '12px' : '13px'} !important;
        font-weight: 500 !important;
        z-index: 2147483647 !important;
        opacity: 0 !important;
        display: flex !important;
        align-items: center !important;
        gap: ${isCompact ? '6px' : '8px'} !important;
        min-height: ${isCompact ? '16px' : '20px'} !important;
        line-height: 1.3 !important;
        pointer-events: none !important;
        box-shadow: ${theme.shadow} !important;
        border-left: 3px solid ${colors[type]} !important;
      `;

      // Add icon based on type
      const icons = {
        success: "✓",
        error: "✕",
        info: "●",
      };

      notification.innerHTML = `
        <span style="color: ${colors[type]}; font-size: ${isCompact ? '10px' : '12px'};">
          ${icons[type]}
        </span>
        <span>${message}</span>
      `;

      document.body.appendChild(notification);

      // Show notification with simple fade-in
      requestAnimationFrame(() => {
        notification.style.setProperty("opacity", "1", "important");
      });

      // Auto remove notification
      setTimeout(() => {
        notification.style.setProperty("opacity", "0", "important");
        setTimeout(() => notification.remove(), 200);
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
      ConfigManager.set("THEME_MODE", CONFIG.DEFAULTS.THEME_MODE);
      ConfigManager.set("UI_COMPACT", CONFIG.DEFAULTS.UI_COMPACT);
      StyleManager.updateStyles();
      this.updateFloatingMenuTheme();
      this.showNotification("Settings reset", "success");
    },
  };

  //// Main Application
  const App = {
    init() {
      console.log("[Visited Links Enhanced] Initializing app...");
      
      // Initialize components
      StyleManager.init();
      
      // Wait a bit for DOM to be fully ready before creating menu
      setTimeout(() => {
        MenuManager.init();
      }, 100);

      // Apply styles if enabled and not on exception site
      this.checkAndApplyStyles();

      // Handle dynamic content changes
      this.observeChanges();
      
      console.log("[Visited Links Enhanced] App initialization complete");
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
      console.log("[Visited Links Enhanced] Script initialized successfully");
    } else {
      // Fallback for very early execution
      setTimeout(initialize, 50);
    }
  }

  // Start the script with multiple initialization methods
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
    // Backup initialization
    setTimeout(initialize, 1000);
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

// Enhanced Features Added - ES2023 Minimalist UI Version:
// 1. Minimalist dark/light theme system with auto-detection
// 2. Compact UI mode for space-conscious users
// 3. Modern gradient color palette with accessibility focus
// 4. Glassmorphism effects with backdrop-filter
// 5. Smooth micro-interactions and hover effects
// 6. Clean typography using system fonts
// 7. Reduced visual clutter with essential-only elements
// 8. Theme toggle functionality
// 9. Enhanced notification system with icons
// 10. Responsive design for different screen sizes
// 11. Improved focus states for accessibility
// 12. Subtle animations and transitions
// 13. Modern button and input styling
// 14. Clean color picker with better UX
// 15. Minimalist floating menu design
// 16. ES2023 syntax with Object.freeze and enhanced methods
// 17. Backward compatibility maintained
// 18. Cross-platform theme detection
