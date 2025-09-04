// ==UserScript==
// @name        Reject ServiceWorker Auto (Simple)
// @namespace   rejectserviceWorkerAuto
// @match       *://*/*
// @run-at      document-start
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @version     1.6
// @author      hongmd (simplified)
// @description Blocks ServiceWorker on all websites. Simple whitelist management with clear menu options.
// ==/UserScript==

var name = 'rejectserviceWorkerAuto';
var prefix = "autoinject" + name;
console.log('RSA Script loaded for:', document.domain);
var injectedStatus = false;
var hostarray = [];

function inject() {
    // Skip if running in frames or already injected
    if (window.self !== window.top) return;
    if (injectedStatus === true) return;
    
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
            console.log('RSA: ServiceWorker blocked on', document.domain);
        } catch (e) {
            // Fallback method for older browsers
            navigator.serviceWorker.register = () => Promise.reject(new Error("ServiceWorker registration blocked"));
            console.log('RSA: ServiceWorker blocked (fallback method) on', document.domain);
        }
    }
    injectedStatus = true;
}

function addHost() {
    if (!hostarray.includes(location.hostname)) {
        hostarray.push(location.hostname);
        GM_setValue(prefix, JSON.stringify(hostarray));
        console.log('RSA: Added', location.hostname, 'to whitelist');
        alert('✅ Added "' + location.hostname + '" to whitelist!\n\nServiceWorker will NOT be blocked here.\nReload page to take effect.');
    } else {
        alert('ℹ️ "' + location.hostname + '" is already in whitelist.');
    }
}

function showWhitelistInfo() {
    var currentStatus = hostarray.includes(location.hostname) ? "WHITELISTED" : "BLOCKED";
    var statusIcon = hostarray.includes(location.hostname) ? "✅" : "🚫";
    var totalSites = hostarray.length;
    
    var message = statusIcon + " Current domain: " + location.hostname + "\n";
    message += "Status: " + currentStatus + "\n\n";
    message += "📋 Total whitelisted sites: " + totalSites + "\n";
    
    if (totalSites > 0) {
        message += "🔸 " + hostarray.join("\n🔸 ");
    }
    
    alert(message);
}

function removeHost() {
    var index = hostarray.indexOf(location.hostname);
    if (index > -1) {
        hostarray.splice(index, 1);
        GM_setValue(prefix, JSON.stringify(hostarray));
        console.log('RSA: Removed', location.hostname, 'from whitelist');
        alert('❌ Removed "' + location.hostname + '" from whitelist!\n\nServiceWorker will be blocked here.\nReload page to take effect.');
    } else {
        alert('ℹ️ "' + location.hostname + '" is not in whitelist.');
    }
}
// Initialize and setup menu commands
try {
    hostarray = JSON.parse(GM_getValue(prefix, "[]"));
    
    // Always show status info
    GM_registerMenuCommand("📋 Show Whitelist Info", showWhitelistInfo);
    
    if (hostarray.includes(location.hostname)) {
        // Current domain is whitelisted
        GM_registerMenuCommand("🚫 Block ServiceWorker Here", removeHost);
        GM_registerMenuCommand("🔧 Manual Block Now", inject);
        console.log('RSA:', location.hostname, 'is whitelisted - ServiceWorker allowed');
    } else {
        // Current domain is not whitelisted (blocked by default)
        inject();
        GM_registerMenuCommand("✅ Allow ServiceWorker Here", addHost);
        console.log('RSA: Auto-blocked ServiceWorker for', location.hostname);
    }
} catch (err) {
    console.error("RSA Error: Failed to initialize menu items");
    console.error(err);
    // Fallback: always inject if there's an error
    inject();
}
