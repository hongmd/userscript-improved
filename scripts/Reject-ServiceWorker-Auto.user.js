// ==UserScript==
// @name        Reject ServiceWorker Auto (Clean)
// @namespace   rejectserviceWorkerAuto
// @match       *://*/*
// @run-at      document-start
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @version     1.5
// @author      hongmd (improved)
// @description Automatically blocks ServiceWorker registration on all websites. Simple and clean version optimized for Firefox.
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
    }
    if (injectedStatus === false) {
        inject();
    }
}

function set() {
    var currentHostname = location.hostname;
    var action = confirm("Do you want to add '" + currentHostname + "' to whitelist?\n\nOK = Add to whitelist (disable auto-block)\nCancel = Remove from whitelist (enable auto-block)");
    
    if (action) {
        // Add to whitelist
        if (!hostarray.includes(currentHostname)) {
            addHost();
            alert("Added '" + currentHostname + "' to whitelist. Reload page to take effect.");
        } else {
            alert("'" + currentHostname + "' is already in whitelist.");
        }
    } else {
        // Remove from whitelist
        if (hostarray.includes(currentHostname)) {
            removeHost();
            alert("Removed '" + currentHostname + "' from whitelist. ServiceWorker will be auto-blocked.");
        } else {
            alert("'" + currentHostname + "' is not in whitelist.");
        }
    }
}

function plus() {
    // Function removed - no longer needed
}

function minus() {
    // Function removed - no longer needed
}

function removeHost() {
    var index = hostarray.indexOf(location.hostname);
    if (index > -1) {
        hostarray.splice(index, 1);
        GM_setValue(prefix, JSON.stringify(hostarray));
        console.log('RSA: Removed', location.hostname, 'from whitelist');
    }
}
// Initialize and setup menu commands
// This should work in Violentmonkey and Tampermonkey, but unfortunately not Greasemonkey.
try {
    hostarray = JSON.parse(GM_getValue(prefix, "[]"));
    
    GM_registerMenuCommand("RSA: Manage Whitelist", set);
    
    if (hostarray.includes(location.hostname)) {
        GM_registerMenuCommand("RSA: Manual Inject", inject);
        GM_registerMenuCommand("RSA: Remove from Whitelist", removeHost);
        console.log('RSA:', location.hostname, 'is whitelisted - manual injection required');
    } else {
        inject();
        GM_registerMenuCommand("RSA: Add to Whitelist", addHost);
        console.log('RSA: Auto-injected for', location.hostname);
    }
} catch (err) {
    console.error("RSA Error: Failed to initialize menu items");
    console.error(err);
    // Fallback: always inject if there's an error
    inject();
}
