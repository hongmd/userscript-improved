// ==UserScript==
// @name        Reject ServiceWorker Auto (Improved)
// @namespace   rejectserviceWorkerAuto
// @match       *://*/*
// @run-at      document-start
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @version     1.4
// @author      hongmd (improved)
// @description Automatically blocks ServiceWorker registration on all websites. Optimized for Firefox with better error handling and logging.
// ==/UserScript==

var defaultvalue = 0; // Changed to number for consistency
var name = 'rejectserviceWorkerAuto';
var prefix = "autoinject" + name;
var value = GM_getValue("value" + name + document.domain, defaultvalue);
console.log('RSA Script loaded for:', document.domain, 'Value:', value);
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
    var val = window.prompt("Enter " + name + " value for " + document.domain + " (number)", value.toString());
    if (val === null) return false; // User cancelled
    
    val = parseInt(val, 10);
    if (isNaN(val)) {
        alert("Please enter a valid number");
        return false;
    }
    GM_setValue("value" + name + document.domain, val);
    console.log('RSA: Set value for', document.domain, 'to', val);
}

function plus() {
    var currentValue = GM_getValue("value" + name + document.domain, defaultvalue);
    var newValue = (typeof currentValue === 'number' ? currentValue : 0) + 1;
    GM_setValue("value" + name + document.domain, newValue);
    console.log('RSA: Increased value for', document.domain, 'to', newValue);
}

function minus() {
    var currentValue = GM_getValue("value" + name + document.domain, defaultvalue);
    var newValue = (typeof currentValue === 'number' ? currentValue : 0) - 1;
    GM_setValue("value" + name + document.domain, newValue);
    console.log('RSA: Decreased value for', document.domain, 'to', newValue);
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
    
    if (typeof value === 'number') {
        GM_registerMenuCommand("RSA: Value +", plus);
        GM_registerMenuCommand("RSA: Value -", minus);
    }
    GM_registerMenuCommand("RSA: Set Value", set);
    
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
