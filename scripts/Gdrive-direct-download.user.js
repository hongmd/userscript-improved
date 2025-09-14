// ==UserScript==
// @name         Google Drive Direct Download - Bypass Virus Scan
// @name:vi      Google Drive Tải Trực Tiếp - Bỏ Qua Quét Virus
// @namespace    gdrive-direct-download
// @version      1.2.1
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
            return urlObj.hostname === 'drive.usercontent.google.com' &&
                (urlObj.pathname.includes('/uc') || urlObj.search.includes('id='));
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
                }
            }

            if (fileId) {
                // Create direct download URL with virus scan bypass
                return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`;
            }
        } catch (e) {
            console.error("Error creating direct download URL:", e);
        }
        return null;
    }

    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async function (resource, init) {
        try {
            if (typeof resource === "string" && isGoogleDriveUrl(resource)) {
                const directUrl = createDirectDownloadUrl(resource);
                if (directUrl) {
                    console.log("Bypassing virus scan, opening direct download:", directUrl);
                    window.open(directUrl, "_blank");
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
                const directUrl = createDirectDownloadUrl(this._url);
                if (directUrl) {
                    console.log("Bypassing virus scan via XHR, opening direct download:", directUrl);
                    window.open(directUrl, "_blank");

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
                const directUrl = createDirectDownloadUrl(target.href);
                if (directUrl) {
                    event.preventDefault();
                    console.log("Bypassing virus scan via link click, opening direct download:", directUrl);
                    window.open(directUrl, "_blank");
                }
            }
        } catch (e) {
            console.error("Error handling link click:", e);
        }
    }, true);

    console.log("Google Drive Direct Download script loaded - Virus scan bypass enabled");
})();