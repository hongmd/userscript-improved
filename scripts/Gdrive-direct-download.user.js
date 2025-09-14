// ==UserScript==
// @name         Google Drive Direct Download - Bypass Virus Scan
// @name:vi      Google Drive Tải Trực Tiếp - Bỏ Qua Quét Virus
// @namespace    gdrive-direct-download
// @version      1.2.6
// @description  Bypass Google Drive virus scan warning and download files directly. Automatically redirects to direct download links, skipping the annoying virus scan page.
// @description:vi Bỏ qua cảnh báo quét virus của Google Drive và tải file trực tiếp. Tự động chuyển hướng đến liên kết tải trực tiếp, bỏ qua trang quét virus khó chịu.
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

    // Helper function to validate Google Drive URLs
    function isGoogleDriveUrl(url) {
        try {
            const urlObj = new URL(url);
            // Support multiple Google Drive domains and URL patterns
            return (
                urlObj.hostname === 'drive.usercontent.google.com' ||
                urlObj.hostname === 'drive.google.com'
            ) && (
                urlObj.pathname.includes('/uc') ||
                urlObj.search.includes('id=') ||
                urlObj.pathname.includes('/file/d/') ||
                urlObj.pathname.includes('/open')
            );
        } catch (e) {
            return false;
        }
    }

    // Helper function to extract file ID and create direct download URL
    function createDirectDownloadUrl(originalUrl) {
        try {
            const url = new URL(originalUrl);
            let fileId = url.searchParams.get("id");

            if (!fileId) {
                // Try to extract ID from different URL patterns
                const pathMatch = url.pathname.match(/\/uc\?id=([^&]+)/);
                if (pathMatch) {
                    fileId = pathMatch[1];
                } else {
                    // Handle /file/d/FILE_ID/view pattern
                    const fileMatch = url.pathname.match(/\/file\/d\/([^\/]+)/);
                    if (fileMatch) {
                        fileId = fileMatch[1];
                    } else {
                        // Handle /open?id=FILE_ID pattern
                        const openMatch = url.search.match(/id=([^&]+)/);
                        if (openMatch) {
                            fileId = openMatch[1];
                        }
                    }
                }
            }

            if (fileId) {
                // Create direct download URL with virus scan bypass
                // Check if URL already has direct download format but missing confirm parameter
                const hasDownloadPath = url.pathname.includes('/download');
                const hasConfirm = url.search.includes('confirm=');
                
                if (hasDownloadPath && !hasConfirm) {
                    // Add confirm=t to existing direct download URL
                    const newUrl = new URL(url);
                    newUrl.searchParams.set('confirm', 't');
                    return newUrl.toString();
                } else {
                    // Use drive.google.com/uc format which is most reliable
                    return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
                }
            }
        } catch (e) {
            console.error("Error creating direct download URL:", e);
        }
        return null;
    }

    // Helper function to open download with multiple fallback methods
    function openDownload(url) {
        console.log("Attempting to open download:", url);
        
        // Method 1: Try window.open (may be blocked by popup blocker)
        try {
            const newWindow = window.open(url, '_blank');
            if (newWindow) {
                console.log("✅ Download opened successfully with window.open");
                return true;
            } else {
                console.warn("⚠️ window.open was blocked by popup blocker");
            }
        } catch (e) {
            console.warn("⚠️ window.open failed:", e);
        }
        
        // Method 2: Try location.href (redirect current page)
        try {
            console.log("🔄 Trying location.href redirect...");
            window.location.href = url;
            console.log("✅ Download initiated with location.href");
            return true;
        } catch (e) {
            console.warn("⚠️ location.href failed:", e);
        }
        
        // Method 3: Create temporary link and click it
        try {
            console.log("🔗 Trying programmatic link click...");
            const link = document.createElement('a');
            link.href = url;
            link.download = ''; // Let browser determine filename
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            console.log("✅ Download initiated with link click");
            return true;
        } catch (e) {
            console.warn("⚠️ Link click failed:", e);
        }
        
        // Method 4: Copy to clipboard as fallback
        try {
            console.log("📋 Copying URL to clipboard as fallback...");
            navigator.clipboard.writeText(url).then(() => {
                alert(`Download URL copied to clipboard:\n\n${url}\n\nPaste this URL into a new tab to download.`);
                console.log("✅ URL copied to clipboard");
            });
        } catch (e) {
            console.error("❌ All download methods failed!");
            alert(`Failed to open download automatically.\n\nPlease manually open this URL in a new tab:\n\n${url}`);
        }
        
        return false;
    }

    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async function (resource, init) {
        try {
            if (typeof resource === "string" && isGoogleDriveUrl(resource)) {
                console.log("🚀 Intercepting fetch request:", resource);
                const directUrl = createDirectDownloadUrl(resource);
                if (directUrl) {
                    console.log("Bypassing virus scan, opening direct download:", directUrl);
                    openDownload(directUrl);
                    return new Response(null, { status: 204 });
                }
            }
        } catch (e) {
            console.error("Error intercepting fetch:", e);
        }
        return originalFetch.apply(this, arguments);
    };

    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this._url = url;
        this._method = method;
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (data) {
        try {
            if (this._url && typeof this._url === "string" && isGoogleDriveUrl(this._url)) {
                console.log("🚀 Intercepting XHR request:", this._url);
                const directUrl = createDirectDownloadUrl(this._url);
                if (directUrl) {
                    console.log("Bypassing virus scan via XHR, opening direct download:", directUrl);
                    
                    // Try multiple methods to open download
                    openDownload(directUrl);
                    
                    // Prevent the original request and simulate a successful response
                    setTimeout(() => {
                        Object.defineProperty(this, 'readyState', { value: 4 });
                        Object.defineProperty(this, 'status', { value: 204 });
                        Object.defineProperty(this, 'statusText', { value: 'No Content' });
                        Object.defineProperty(this, 'responseText', { value: '' });

                        if (typeof this.onreadystatechange === 'function') {
                            this.onreadystatechange();
                        }
                    }, 0);
                    return;
                }
            }
        } catch (e) {
            console.error("Error intercepting XHR:", e);
        }
        return originalXHRSend.apply(this, arguments);
    };

    // Additional: Handle direct clicks on download links
    document.addEventListener('click', function (event) {
        try {
            const target = event.target.closest('a');
            if (target && target.href && isGoogleDriveUrl(target.href)) {
                console.log("🚀 Intercepting click on link:", target.href);
                const directUrl = createDirectDownloadUrl(target.href);
                if (directUrl) {
                    event.preventDefault();
                    console.log("Bypassing virus scan via link click, opening direct download:", directUrl);
                    openDownload(directUrl);
                }
            }
        } catch (e) {
            console.error("Error handling link click:", e);
        }
    }, true);

    console.log("Google Drive Direct Download script loaded - Virus scan bypass enabled");
    
    // Test the specific URL provided by user
    const testUrl = "https://drive.usercontent.google.com/download?id=1MExRoVwC9nwWn5LviZbJ8GgjEjp8syhz&export=download&authuser=0";
    console.log("Testing URL:", testUrl);
    console.log("Is Google Drive URL:", isGoogleDriveUrl(testUrl));
    
    if (isGoogleDriveUrl(testUrl)) {
        const directUrl = createDirectDownloadUrl(testUrl);
        console.log("Direct download URL:", directUrl);
    }
    
    // Add global function for manual testing
    window.testGDriveDownload = function(url) {
        console.log("Manual test for URL:", url);
        if (isGoogleDriveUrl(url)) {
            const directUrl = createDirectDownloadUrl(url);
            console.log("Opening direct download:", directUrl);
            openDownload(directUrl);
            return directUrl;
        } else {
            console.log("Not a Google Drive URL");
            return null;
        }
    };
    
    console.log("💡 Manual test: Copy and run in console: testGDriveDownload('YOUR_URL_HERE')");
})();