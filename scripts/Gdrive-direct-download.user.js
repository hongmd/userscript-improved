// ==UserScript==
// @name         Google Drive Direct Download - Bypass Virus Scan
// @name:vi      Google Drive Tải Trực Tiếp - Bỏ Qua Quét Virus
// @namespace    gdrive-direct-download
// @version      1.3
// @description  Enhanced Google Drive direct download with virus scan bypass. Supports multiple URL patterns, popup blocker fallback, user notifications, and improved reliability.
// @description:vi Tải trực tiếp Google Drive nâng cao với bỏ qua quét virus. Hỗ trợ nhiều pattern URL, fallback khi popup bị chặn, thông báo người dùng và độ tin cậy cải thiện.
// @author       hongmd
// @license      MIT
// @homepageURL  https://github.com/hongmd/userscript-improved
// @supportURL   https://github.com/hongmd/userscript-improved/issues
// @match        https://drive.google.com/*
// @match        https://drive.usercontent.google.com/*
// @grant        none
// @run-at       document-start
// @noframes
// @updateURL    https://raw.githubusercontent.com/hongmd/userscript-improved/master/scripts/Gdrive-direct-download.user.js
// @downloadURL  https://raw.githubusercontent.com/hongmd/userscript-improved/master/scripts/Gdrive-direct-download.user.js
// ==/UserScript==

(function () {
    "use strict";

    // Configuration
    const CONFIG = {
        POPUP_FALLBACK: true, // Use programmatic download if popup blocked
        NOTIFICATION_DURATION: 3000, // ms
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000, // ms
        DEBUG: false
    };

    // Enhanced URL pattern matching for Google Drive
    const GDRIVE_PATTERNS = [
        // Standard sharing links
        /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/view/,
        /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
        // Direct download links
        /drive\.usercontent\.google\.com\/download\?id=([a-zA-Z0-9_-]+)/,
        /drive\.usercontent\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/,
        // Alternative patterns
        /docs\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/
    ];

    // State management
    let notificationElement = null;
    let processedUrls = new Set(); // Prevent duplicate processing
    let retryCount = 0;

    // Enhanced URL validation with multiple patterns
    function isGoogleDriveUrl(url) {
        if (!url || typeof url !== 'string') return false;

        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();

            // Check if it's a Google Drive related domain
            if (!hostname.includes('google.com') ||
                (!hostname.includes('drive.') && !hostname.includes('docs.'))) {
                return false;
            }

            // Check against known patterns
            const fullUrl = url.toLowerCase();
            return GDRIVE_PATTERNS.some(pattern => pattern.test(fullUrl));
        } catch (e) {
            CONFIG.DEBUG && console.log('URL validation error:', e.message);
            return false;
        }
    }

    // Enhanced file ID extraction with multiple pattern support
    function extractFileId(url) {
        if (!url || typeof url !== 'string') return null;

        try {
            const urlObj = new URL(url);
            let fileId = null;

            // Try URL search params first
            fileId = urlObj.searchParams.get('id');

            // If not found, try pathname patterns
            if (!fileId) {
                const pathname = urlObj.pathname;
                for (const pattern of GDRIVE_PATTERNS) {
                    const match = url.match(pattern);
                    if (match && match[1]) {
                        fileId = match[1];
                        break;
                    }
                }
            }

            // Validate file ID format (Google Drive IDs are typically 28-33 chars)
            if (fileId && /^[a-zA-Z0-9_-]{20,50}$/.test(fileId)) {
                return fileId;
            }
        } catch (e) {
            CONFIG.DEBUG && console.log('File ID extraction error:', e.message);
        }
        return null;
    }

    // Create direct download URL with multiple fallback methods
    function createDirectDownloadUrl(originalUrl) {
        const fileId = extractFileId(originalUrl);
        if (!fileId) {
            CONFIG.DEBUG && console.log('Could not extract file ID from:', originalUrl);
            return null;
        }

        // Try multiple download URL formats
        const downloadUrls = [
            `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`,
            `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
            `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`
        ];

        // Return primary URL, others as fallbacks
        return downloadUrls[0];
    }

    // User notification system
    function createNotificationElement() {
        if (notificationElement) return;

        notificationElement = document.createElement('div');
        Object.assign(notificationElement.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '10000',
            padding: '12px 16px',
            borderRadius: '8px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'all 0.3s ease',
            opacity: '0',
            transform: 'translateY(-10px)',
            pointerEvents: 'none',
            maxWidth: '300px',
            wordWrap: 'break-word'
        });

        document.body.appendChild(notificationElement);
    }

    function showNotification(message, type = 'success') {
        if (!notificationElement) createNotificationElement();

        const colors = {
            success: { bg: '#10b981', text: '#ffffff' },
            error: { bg: '#ef4444', text: '#ffffff' },
            info: { bg: '#3b82f6', text: '#ffffff' }
        };

        const color = colors[type] || colors.info;

        Object.assign(notificationElement.style, {
            backgroundColor: color.bg,
            color: color.text,
            opacity: '1',
            transform: 'translateY(0)',
            pointerEvents: 'auto'
        });

        notificationElement.textContent = message;

        // Auto-hide after duration
        setTimeout(() => {
            if (notificationElement) {
                notificationElement.style.opacity = '0';
                notificationElement.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    if (notificationElement) {
                        notificationElement.style.pointerEvents = 'none';
                    }
                }, 300);
            }
        }, CONFIG.NOTIFICATION_DURATION);
    }

    // Enhanced download function with fallback methods
    function downloadFile(url, filename = 'download') {
        // Prevent duplicate processing
        if (processedUrls.has(url)) {
            CONFIG.DEBUG && console.log('URL already processed:', url);
            return;
        }
        processedUrls.add(url);

        // Clean up old processed URLs (keep last 10)
        if (processedUrls.size > 10) {
            const urlsArray = Array.from(processedUrls);
            processedUrls.clear();
            urlsArray.slice(-10).forEach(url => processedUrls.add(url));
        }

        try {
            // Method 1: Try popup window (most reliable for large files)
            const popup = window.open(url, '_blank', 'noopener,noreferrer');

            if (!popup || popup.closed) {
                // Popup blocked, try programmatic download
                CONFIG.DEBUG && console.log('Popup blocked, trying programmatic download');

                if (CONFIG.POPUP_FALLBACK) {
                    programmaticDownload(url, filename);
                } else {
                    showNotification('Popup blocked! Please allow popups for direct downloads.', 'error');
                }
            } else {
                showNotification('Download started! Check your downloads folder.', 'success');
                popup.focus();
            }
        } catch (e) {
            CONFIG.DEBUG && console.error('Download error:', e);
            showNotification('Download failed. Please try again.', 'error');
        }
    }

    // Programmatic download fallback
    function programmaticDownload(url, filename) {
        try {
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showNotification('Download initiated via fallback method.', 'info');
        } catch (e) {
            CONFIG.DEBUG && console.error('Programmatic download failed:', e);
            showNotification('All download methods failed.', 'error');
        }
    }

    // Enhanced fetch interceptor with better error handling
    const originalFetch = window.fetch;
    window.fetch = async function (resource, init) {
        try {
            if (typeof resource === "string" && isGoogleDriveUrl(resource)) {
                const directUrl = createDirectDownloadUrl(resource);
                if (directUrl) {
                    CONFIG.DEBUG && console.log("Intercepting fetch, bypassing virus scan:", directUrl);
                    downloadFile(directUrl);
                    return new Response(null, { status: 204, statusText: 'No Content' });
                }
            }
        } catch (e) {
            CONFIG.DEBUG && console.error("Fetch interception error:", e);
        }
        return originalFetch.apply(this, arguments);
    };

    // Enhanced XHR interceptor with improved simulation
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this._originalUrl = url;
        this._method = method;
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (data) {
        try {
            if (this._originalUrl && typeof this._originalUrl === "string" && isGoogleDriveUrl(this._originalUrl)) {
                const directUrl = createDirectDownloadUrl(this._originalUrl);
                if (directUrl) {
                    CONFIG.DEBUG && console.log("Intercepting XHR, bypassing virus scan:", directUrl);
                    downloadFile(directUrl);

                    // Simulate successful response without breaking apps
                    setTimeout(() => {
                        try {
                            if (this.readyState !== 4) {
                                Object.defineProperty(this, 'readyState', { value: 4, writable: true });
                                Object.defineProperty(this, 'status', { value: 200, writable: true });
                                Object.defineProperty(this, 'statusText', { value: 'OK', writable: true });
                                Object.defineProperty(this, 'responseText', { value: '{"success": true}', writable: true });

                                if (typeof this.onload === 'function') {
                                    this.onload();
                                }
                                if (typeof this.onreadystatechange === 'function') {
                                    this.onreadystatechange();
                                }
                            }
                        } catch (e) {
                            CONFIG.DEBUG && console.error('XHR simulation error:', e);
                        }
                    }, 100);
                    return;
                }
            }
        } catch (e) {
            CONFIG.DEBUG && console.error("XHR interception error:", e);
        }
        return originalXHRSend.apply(this, arguments);
    };

    // Enhanced click handler with better target detection
    document.addEventListener('click', function (event) {
        try {
            // Find the actual link element (handle nested elements)
            let target = event.target;
            while (target && target !== document.body) {
                if (target.tagName === 'A' && target.href) {
                    break;
                }
                target = target.parentElement;
            }

            if (target && target.href && isGoogleDriveUrl(target.href)) {
                const directUrl = createDirectDownloadUrl(target.href);
                if (directUrl) {
                    event.preventDefault();
                    event.stopPropagation();

                    CONFIG.DEBUG && console.log("Intercepting link click, bypassing virus scan:", directUrl);
                    downloadFile(directUrl, target.textContent?.trim() || 'Google Drive File');
                }
            }
        } catch (e) {
            CONFIG.DEBUG && console.error("Click handler error:", e);
        }
    }, true);

    // Cleanup function for memory management
    function cleanup() {
        try {
            // Clear processed URLs set
            processedUrls.clear();

            // Remove notification element
            if (notificationElement && notificationElement.parentNode) {
                notificationElement.parentNode.removeChild(notificationElement);
                notificationElement = null;
            }

            CONFIG.DEBUG && console.log('GDrive Direct Download cleanup completed');
        } catch (e) {
            CONFIG.DEBUG && console.error('Cleanup error:', e);
        }
    }

    // Add cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

    // Initialize notification system
    function initialize() {
        try {
            createNotificationElement();
            showNotification('Google Drive Direct Download active - Virus scan bypass enabled!', 'info');

            // Test URL patterns (optional debug)
            if (CONFIG.DEBUG) {
                console.log('Supported URL patterns:', GDRIVE_PATTERNS.length);
                console.log('Configuration:', CONFIG);
            }
        } catch (e) {
            console.error('Initialization error:', e);
        }
    }

    // Start the script
    initialize();

    console.log("Enhanced Google Drive Direct Download loaded - Multiple URL patterns supported, popup fallback enabled");
})();