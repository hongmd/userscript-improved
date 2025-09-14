// ==UserScript==
// @name         Google Drive Direct Download - Bypass Virus Scan
// @name:vi      Google Drive Tải Trực Tiếp - Bỏ Qua Quét Virus
// @namespace    gdrive-direct-download
// @version      1.2.12
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

            console.log("🔍 Processing URL:", originalUrl);
            console.log("🔍 URL pathname:", url.pathname);
            console.log("🔍 URL search:", url.search);

            if (!fileId) {
                // Try to extract ID from different URL patterns
                const pathMatch = url.pathname.match(/\/uc\?id=([^&]+)/);
                if (pathMatch) {
                    fileId = pathMatch[1];
                    console.log("🔍 Extracted ID from /uc path:", fileId);
                } else {
                    // Handle /file/d/FILE_ID/view pattern
                    const fileMatch = url.pathname.match(/\/file\/d\/([^\/]+)/);
                    if (fileMatch) {
                        fileId = fileMatch[1];
                        console.log("🔍 Extracted ID from /file/d/ path:", fileId);
                    } else {
                        // Handle /open?id=FILE_ID pattern
                        const openMatch = url.search.match(/id=([^&]+)/);
                        if (openMatch) {
                            fileId = openMatch[1];
                            console.log("🔍 Extracted ID from search params:", fileId);
                        }
                    }
                }
            } else {
                console.log("🔍 Found ID in search params:", fileId);
            }

            if (fileId) {
                // Create direct download URL with virus scan bypass
                // Check if URL already has direct download format but missing confirm parameter
                const hasDownloadPath = url.pathname.includes('/download');
                const hasConfirm = url.search.includes('confirm=');
                
                console.log("🔍 hasDownloadPath:", hasDownloadPath);
                console.log("🔍 hasConfirm:", hasConfirm);
                
                if (hasDownloadPath && !hasConfirm) {
                    // Add confirm=t to existing direct download URL
                    const newUrl = new URL(url);
                    newUrl.searchParams.set('confirm', 't');
                    const resultUrl = newUrl.toString();
                    console.log("🔍 Added confirm=t to existing URL:", resultUrl);
                    return resultUrl;
                } else {
                    // Use drive.google.com/uc format which is most reliable
                    const resultUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
                    console.log("🔍 Using drive.google.com/uc format:", resultUrl);
                    return resultUrl;
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
        
        // Method 1: PRIORITIZE location.href redirect (most reliable for downloads)
        try {
            console.log("🔄 Using location.href redirect (most reliable for downloads)...");
            // Small delay to show user what's happening
            alert("🚀 Starting download... Page will redirect to download URL.");
            setTimeout(() => {
                window.location.href = url;
            }, 100);
            console.log("✅ Download initiated with location.href");
            return true;
        } catch (e) {
            console.warn("⚠️ location.href failed:", e);
        }
        
        // Method 2: Try window.open as fallback
        try {
            const newWindow = window.open(url, '_blank');
            if (newWindow) {
                console.log("✅ Download opened successfully with window.open");
                // Close the popup after a short delay
                setTimeout(() => {
                    try {
                        newWindow.close();
                    } catch (e) {
                        // Ignore errors when closing
                    }
                }, 1000);
                return true;
            } else {
                console.warn("⚠️ window.open was blocked by popup blocker");
            }
        } catch (e) {
            console.warn("⚠️ window.open failed:", e);
        }
        
        // Method 3: Create temporary link and click it
        try {
            console.log("🔗 Trying programmatic link click...");
            const link = document.createElement('a');
            link.href = url;
            link.download = '';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            console.log("✅ Download initiated with link click");
            return true;
        } catch (e) {
            console.warn("⚠️ Link click failed:", e);
        }
        
        // Method 4: Copy to clipboard as last resort
        try {
            console.log("📋 Copying URL to clipboard as fallback...");
            navigator.clipboard.writeText(url).then(() => {
                alert(`🚀 Download URL copied to clipboard!\n\n📄 ${url}\n\n🔗 Paste this URL into a new tab to download directly.`);
                console.log("✅ URL copied to clipboard");
            });
        } catch (e) {
            console.error("❌ All download methods failed!");
            alert(`❌ Failed to open download automatically.\n\n📄 Please manually copy and open this URL:\n\n${url}`);
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

    // Additional: Handle direct clicks on download links - PRIORITIZE THIS
    document.addEventListener('click', function (event) {
        try {
            const target = event.target.closest('a');
            if (target && target.href && isGoogleDriveUrl(target.href)) {
                console.log("🚀 Intercepting click on link:", target.href);
                event.preventDefault(); // Stop the default click behavior
                event.stopPropagation();
                
                const directUrl = createDirectDownloadUrl(target.href);
                if (directUrl) {
                    console.log("Bypassing virus scan via link click, redirecting to:", directUrl);
                    
                    // Show alert and redirect immediately
                    alert("🚀 Starting Google Drive download... Page will redirect.");
                    setTimeout(() => {
                        window.location.href = directUrl;
                    }, 100);
                    
                    return false; // Prevent any further processing
                }
            }
        } catch (e) {
            console.error("Error handling link click:", e);
        }
    }, true); // Use capture phase to intercept before other handlers

    console.log("Google Drive Direct Download script loaded - Virus scan bypass enabled");
    
    // ===== VIRUS SCAN PAGE DETECTION =====
    // If user lands on virus scan page, automatically redirect to direct download
    function checkForVirusScanPage() {
        const currentUrl = window.location.href;
        
        // Check if we're on a Google Drive page with virus scan
        if (currentUrl.includes('drive.google.com') && 
            (document.title.includes('Virus scan') || 
             document.body?.textContent?.includes('virus scan') ||
             document.querySelector('[data-target="virus-scan"]') ||
             document.querySelector('.virus-scan-warning'))) {
            
            console.log("🔍 Detected virus scan page, attempting to bypass...");
            
            // Try to extract file ID from current URL
            const urlMatch = currentUrl.match(/\/file\/d\/([^\/]+)/) || currentUrl.match(/id=([^&]+)/);
            if (urlMatch) {
                const fileId = urlMatch[1];
                const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
                
                console.log("🚀 Redirecting from virus scan page to direct download:", directUrl);
                alert("🚀 Bypassing Google Drive virus scan... Redirecting to direct download.");
                
                setTimeout(() => {
                    window.location.href = directUrl;
                }, 500);
                
                return true;
            }
        }
        
        return false;
    }
    
    // Check immediately and also after page loads
    if (!checkForVirusScanPage()) {
        // If not on virus scan page, set up monitoring for dynamic content
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if virus scan content was added
                    setTimeout(checkForVirusScanPage, 100);
                }
            });
        });
        
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }
    
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
    
    // Add test button to page for easy testing
    function addTestButton() {
        if (!document.body) {
            setTimeout(addTestButton, 100);
            return;
        }
        
        // Check if button already exists
        if (document.getElementById('gdrive-test-btn')) return;
        
        const testBtn = document.createElement('button');
        testBtn.id = 'gdrive-test-btn';
        testBtn.innerHTML = '🗂️ Test GDrive Download';
        testBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: #4285f4;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        testBtn.onclick = function() {
            const testUrl = prompt('Enter Google Drive URL to test:', 'https://drive.usercontent.google.com/download?id=1MExRoVwC9nwWn5LviZbJ8GgjEjp8syhz&export=download&authuser=0');
            if (testUrl) {
                console.log('🧪 Manual test triggered for:', testUrl);
                openDownload(createDirectDownloadUrl(testUrl));
            }
        };
        
        document.body.appendChild(testBtn);
        console.log('✅ Test button added to page');
    }
    
    // Add button after page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addTestButton);
    } else {
        addTestButton();
    }
})();