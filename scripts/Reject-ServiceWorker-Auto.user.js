// ==UserScript==
// @name        Reject ServiceWorker Auto (Simple)
// @name:vi     Từ Chối ServiceWorker Tự Động (Đơn Giản)
// @namespace   rejectserviceWorkerAuto
// @version     1.7.2
// @description Blocks ServiceWorker on all websites. Simple whitelist management with clear menu options. Prevents PWA installations and background sync.
// @description:vi Chặn ServiceWorker trên tất cả websites. Quản lý whitelist đơn giản với các tùy chọn menu rõ ràng. Ngăn chặn cài đặt PWA và đồng bộ nền.
// @author      hongmd
// @license     MIT
// @homepageURL https://github.com/hongmd/userscript-improved
// @supportURL  https://github.com/hongmd/userscript-improved/issues
// @match       *://*/*
// @run-at      document-start
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @compatible  ScriptCat
// @compatible  Tampermonkey
// @compatible  Greasemonkey
// @noframes
// @updateURL   https://raw.githubusercontent.com/hongmd/userscript-improved/master/scripts/Reject-ServiceWorker-Auto.user.js
// @downloadURL https://raw.githubusercontent.com/hongmd/userscript-improved/master/scripts/Reject-ServiceWorker-Auto.user.js
// ==/UserScript==

'use strict';

const SCRIPT_NAME = 'rejectserviceWorkerAuto';
const STORAGE_PREFIX = `autoinject${SCRIPT_NAME}`;
const LOG_PREFIX = 'RSA:';

console.log(`${LOG_PREFIX} Script loaded for:`, document.domain);

let injectedStatus = false;
let hostArray = [];

function inject() {
    // Skip if running in frames or already injected
    if (window.self !== window.top) return;
    if (injectedStatus) return;

    // Block ServiceWorker registration
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        try {
            Object.defineProperty(navigator, 'serviceWorker', {
                value: {
                    register: () => Promise.reject(new Error("ServiceWorker registration blocked by RSA script")),
                    getRegistration: () => Promise.resolve(undefined),
                    getRegistrations: () => Promise.resolve([]),
                    ready: Promise.reject(new Error("ServiceWorker blocked"))
                },
                writable: false,
                configurable: false
            });
            console.log(`${LOG_PREFIX} ServiceWorker blocked on`, document.domain);
        } catch (e) {
            // Fallback method for older browsers
            navigator.serviceWorker.register = () => Promise.reject(new Error("ServiceWorker registration blocked"));
            console.log(`${LOG_PREFIX} ServiceWorker blocked (fallback method) on`, document.domain);
        }
    }
    injectedStatus = true;
}

function addHost() {
    const hostname = location.hostname;
    if (!hostArray.includes(hostname)) {
        hostArray.push(hostname);
        GM_setValue(STORAGE_PREFIX, JSON.stringify(hostArray));
        console.log(`${LOG_PREFIX} Added`, hostname, 'to whitelist');
        alert(`✅ Added "${hostname}" to whitelist!\n\nServiceWorker will NOT be blocked here.\nReload page to take effect.`);
    } else {
        alert(`ℹ️ "${hostname}" is already in whitelist.`);
    }
}

function showWhitelistInfo() {
    const hostname = location.hostname;
    const isWhitelisted = hostArray.includes(hostname);
    const currentStatus = isWhitelisted ? "WHITELISTED" : "BLOCKED";
    const statusIcon = isWhitelisted ? "✅" : "🚫";
    const totalSites = hostArray.length;

    let message = `${statusIcon} Current domain: ${hostname}\n`;
    message += `Status: ${currentStatus}\n\n`;
    message += `📋 Total whitelisted sites: ${totalSites}\n`;

    if (totalSites > 0) {
        message += "🔸 " + hostArray.join("\n🔸 ");
    }

    alert(message);
}

function removeHost() {
    const hostname = location.hostname;
    const index = hostArray.indexOf(hostname);
    if (index > -1) {
        hostArray.splice(index, 1);
        GM_setValue(STORAGE_PREFIX, JSON.stringify(hostArray));
        console.log(`${LOG_PREFIX} Removed`, hostname, 'from whitelist');
        alert(`❌ Removed "${hostname}" from whitelist!\n\nServiceWorker will be blocked here.\nReload page to take effect.`);
    } else {
        alert(`"${hostname}" is not in whitelist.`);
    }
}

// Initialize and setup menu commands
function initializeScript() {
    try {
        // Safe JSON parsing with validation
        const storedData = GM_getValue(STORAGE_PREFIX, "[]");
        if (typeof storedData === 'string' && storedData.trim()) {
            hostArray = JSON.parse(storedData);
            // Validate that result is an array
            if (!Array.isArray(hostArray)) {
                console.warn(`${LOG_PREFIX} Invalid stored data, resetting to empty array`);
                hostArray = [];
            }
        } else {
            hostArray = [];
        }

        const hostname = location.hostname;
        const isWhitelisted = hostArray.includes(hostname);

        // Always show status info
        GM_registerMenuCommand("📋 Show Whitelist Info", showWhitelistInfo);

        if (isWhitelisted) {
            // Current domain is whitelisted
            GM_registerMenuCommand("🚫 Block ServiceWorker Here", removeHost);
            GM_registerMenuCommand("🔧 Manual Block Now", inject);
            console.log(`${LOG_PREFIX}`, hostname, 'is whitelisted - ServiceWorker allowed');
        } else {
            // Current domain is not whitelisted (blocked by default)
            inject();
            GM_registerMenuCommand("✅ Allow ServiceWorker Here", addHost);
            console.log(`${LOG_PREFIX} Auto-blocked ServiceWorker for`, hostname);
        }
    } catch (err) {
        console.error(`${LOG_PREFIX} Error: Failed to initialize menu items`);
        console.error(err);
        // Fallback: always inject if there's an error
        inject();
    }
}

// Start the script
initializeScript();
