// ==UserScript==
// @name        Visited Links Enhanced
// @namespace   iFantz7E.VisitedLiteEnhanced
// @description Enhanced userscript to mark visited links with custom colors and improved performance
// @version     1.0.0
// @include     http*
// @icon        https://cdn.jsdelivr.net/gh/hongmd/cdn-web@main/logo.svg
// @run-at      document-start
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_registerMenuCommand
// @copyright   2025, Enhanced by AI Assistant
// ==/UserScript==

(function() {
    'use strict';

    //// Enhanced Configuration with Storage
    const CONFIG = {
        STORAGE_KEYS: {
            COLOR: 'visited_color',
            EXCEPT_SITES: 'except_sites',
            ENABLED: 'script_enabled'
        },
        DEFAULTS: {
            COLOR: 'LightCoral',
            EXCEPT_SITES: 'mail.live.com,gmail.com',
            ENABLED: true
        },
        STYLE_ID: 'visited-lite-enhanced-style',
        CSS_TEMPLATE: 'a:visited, a:visited * { color: %COLOR% !important; transition: color 0.2s ease; }'
    };

    // Enhanced color palette with better accessibility
    const COLOR_PALETTE = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
        '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
        '#EE5A24', '#0984E3', '#A29BFE', '#FD79A8', '#E17055',
        '#00B894', '#FDCB6E', '#6C5CE7', '#74B9FF', '#00CEC9'
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
            return s.color !== '';
        },

        // Get domain from URL
        getDomain(url) {
            try {
                return new URL(url).hostname;
            } catch (e) {
                return '';
            }
        },

        // Sanitize input
        sanitizeInput(input) {
            return input.replace(/[<>'"]/g, '');
        }
    };

    //// Configuration Manager
    const ConfigManager = {
        get(key) {
            try {
                return GM_getValue(CONFIG.STORAGE_KEYS[key], CONFIG.DEFAULTS[key]);
            } catch (e) {
                return CONFIG.DEFAULTS[key];
            }
        },

        set(key, value) {
            try {
                GM_setValue(CONFIG.STORAGE_KEYS[key], value);
                return true;
            } catch (e) {
                console.warn('Failed to save config:', e);
                return false;
            }
        },

        isExceptSite(url) {
            const exceptSites = this.get('EXCEPT_SITES').split(',')
                .map(site => site.trim().toLowerCase())
                .filter(site => site.length > 0);
            
            const currentDomain = Utils.getDomain(url).toLowerCase();
            
            return exceptSites.some(site => {
                // Remove protocol and www prefix for comparison
                const cleanSite = site.replace(/^(https?:\/\/)?(www\.)?/, '');
                const cleanDomain = currentDomain.replace(/^www\./, '');
                
                return cleanDomain.includes(cleanSite) || cleanSite.includes(cleanDomain);
            });
        }
    };

    //// Style Manager
    const StyleManager = {
        styleElement: null,

        init() {
            this.createStyleElement();
        },

        createStyleElement() {
            // Remove existing style if present
            const existing = document.getElementById(CONFIG.STYLE_ID);
            if (existing) {
                existing.remove();
            }

            this.styleElement = document.createElement('style');
            this.styleElement.id = CONFIG.STYLE_ID;
            this.styleElement.type = 'text/css';
            
            // Try to append to head, fallback to document
            const target = document.head || document.documentElement;
            if (target) {
                target.appendChild(this.styleElement);
            }
        },

        updateStyles() {
            if (!this.styleElement) {
                this.createStyleElement();
            }

            const color = ConfigManager.get('COLOR');
            if (Utils.isValidColor(color)) {
                const css = CONFIG.CSS_TEMPLATE.replace('%COLOR%', color);
                this.styleElement.textContent = css;
            }
        },

        removeStyles() {
            if (this.styleElement) {
                this.styleElement.textContent = '';
            }
        }
    };

    //// Menu System
    const MenuManager = {
        init() {
            try {
                GM_registerMenuCommand('Toggle Visited Links', this.toggleScript.bind(this));
                GM_registerMenuCommand('Change Color', this.changeColor.bind(this));
                GM_registerMenuCommand('Manage Exception Sites', this.manageExceptions.bind(this));
            } catch (e) {
                console.warn('Menu commands not available');
            }
        },

        toggleScript() {
            const currentState = ConfigManager.get('ENABLED');
            const newState = !currentState;
            ConfigManager.set('ENABLED', newState);
            
            if (newState) {
                StyleManager.updateStyles();
                alert('Visited Links Enhanced: Enabled');
            } else {
                StyleManager.removeStyles();
                alert('Visited Links Enhanced: Disabled');
            }
        },

        changeColor() {
            const currentColor = ConfigManager.get('COLOR');
            const newColor = prompt(`Enter a new color for visited links (current: ${currentColor}):\n\nYou can use:\n- Color names (red, blue, etc.)\n- Hex codes (#FF0000)\n- RGB values (rgb(255,0,0))`, currentColor);
            
            if (newColor && newColor.trim() !== '') {
                const sanitizedColor = Utils.sanitizeInput(newColor.trim());
                if (Utils.isValidColor(sanitizedColor)) {
                    ConfigManager.set('COLOR', sanitizedColor);
                    StyleManager.updateStyles();
                    alert(`Color changed to: ${sanitizedColor}`);
                } else {
                    alert('Invalid color format. Please try again.');
                }
            }
        },

        manageExceptions() {
            const currentExceptions = ConfigManager.get('EXCEPT_SITES');
            const newExceptions = prompt(
                'Enter domains to exclude (comma-separated):\n\nExample: gmail.com, facebook.com, twitter.com',
                currentExceptions
            );
            
            if (newExceptions !== null) {
                const sanitizedExceptions = Utils.sanitizeInput(newExceptions.trim());
                ConfigManager.set('EXCEPT_SITES', sanitizedExceptions);
                alert('Exception sites updated!');
                
                // Reapply styles based on new exceptions
                App.checkAndApplyStyles();
            }
        }
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
            const isEnabled = ConfigManager.get('ENABLED');
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
                    subtree: true
                });
            }

            // Handle SPA navigation
            window.addEventListener('popstate', debouncedUpdate);
            
            // Handle hash changes
            window.addEventListener('hashchange', debouncedUpdate);
        }
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
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Export for debugging (optional)
    if (typeof window !== 'undefined') {
        window.VisitedLinksEnhanced = {
            config: ConfigManager,
            style: StyleManager,
            utils: Utils
        };
    }

})();

// Enhanced Features Added:
// 1. Modern ES6+ syntax and best practices
// 2. Persistent configuration storage
// 3. User-friendly menu system for settings
// 4. Better error handling and validation
// 5. Performance optimizations with debouncing
// 6. Support for dynamic content (SPAs)
// 7. Enhanced color validation
// 8. Better domain matching for exceptions
// 9. Improved CSS with transitions
// 10. Modular, maintainable code structure
