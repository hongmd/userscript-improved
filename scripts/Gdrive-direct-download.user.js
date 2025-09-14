// ==UserScript==
// @name         Google Drive Direct Download - Bypass Virus Scan
// @name:vi      Google Drive Tải Trực Tiếp - Bỏ Qua Quét Virus
// @namespace    gdrive-direct-download
// @version      1.2.2
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

(function() {
    'use strict';
    const originalFetch = window.fetch;
    window.fetch = async function(resource, init) {
        try {
            if (typeof resource === "string" && resource.includes("drive.usercontent.google.com/uc")) {
                let url = new URL(resource);

                let id = url.searchParams.get("id");
                if (id) {
                    const newUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download&authuser=0&confirm=t`;
                    window.open(newUrl, "_blank");
                    return new Response(null, { status: 204 });
                }
            }
        } catch (e) {
            console.error("Error intercepting fetch:", e);
        }
        return originalFetch.apply(this, arguments);
    };

    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        try {
            if (url.includes("drive.usercontent.google.com/uc")) {
                let u = new URL(url);
                let id = u.searchParams.get("id");
                if (id) {
                    const newUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download&authuser=0&confirm=t`;
                    window.open(newUrl, "_blank");
                    return;
                }
            }
        } catch (e) {
            console.error("Error intercepting XHR:", e);
        }
        return origOpen.apply(this, arguments);
    };
})();