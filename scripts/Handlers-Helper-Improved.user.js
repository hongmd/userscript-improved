// ==UserScript==
// @name        Handlers Helper (Improved)
// @include     *://*/*
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_addStyle
// @grant       GM_registerMenuCommand
// @version     4.2
// @author      hongmd (improved)
// @description Helper for protocol_hook.lua - Fixed bugs, improved performance and reliability. Added DOWN action confirmation and fixed LEFT (stream) action.
// @namespace   Violentmonkey Scripts
// ==/UserScript==

'use strict';

// Constants
const GUIDE = 'Value: pipe ytdl stream mpv iptv';
const LIVE_WINDOW_WIDTH = 400;
const LIVE_WINDOW_HEIGHT = 640;
const DRAG_THRESHOLD = 50;
const RIGHT_CLICK_DELAY = 200;

// Default values
const DEFAULTS = {
    UP: 'pipe',
    DOWN: 'ytdl',
    LEFT: 'stream',
    RIGHT: 'mpv',
    hlsdomain: 'cdn.animevui.com',
    livechat: false,
    total_direction: 4,
    down_confirm: true // New setting to confirm DOWN action
};

// Initialize settings (fixed variable redeclaration)
let settings = {
    UP: GM_getValue('UP', DEFAULTS.UP),
    DOWN: GM_getValue('DOWN', DEFAULTS.DOWN),
    LEFT: GM_getValue('LEFT', DEFAULTS.LEFT),
    RIGHT: GM_getValue('RIGHT', DEFAULTS.RIGHT),
    hlsdomain: GM_getValue('hlsdomain', DEFAULTS.hlsdomain),
    livechat: GM_getValue('livechat', DEFAULTS.livechat),
    total_direction: GM_getValue('total_direction', DEFAULTS.total_direction),
    down_confirm: GM_getValue('down_confirm', DEFAULTS.down_confirm)
};

// Global state
let hlsdomainArray = settings.hlsdomain.split(',').filter(d => d.trim());
let collectedUrls = new Map(); // Use Map instead of object for better performance
let attachedElements = new WeakSet(); // Use WeakSet to prevent memory leaks

console.log('Handlers Helper loaded with settings:', settings);

// Direction enum
const DirectionEnum = Object.freeze({
    CENTER: 5,
    RIGHT: 6,
    LEFT: 4,
    UP: 2,
    DOWN: 8,
    UP_LEFT: 1,
    UP_RIGHT: 3,
    DOWN_LEFT: 7,
    DOWN_RIGHT: 9
});

// Utility functions
function safePrompt(message, defaultValue) {
    try {
        const result = window.prompt(message, defaultValue);
        return result === null ? null : result.trim();
    } catch (error) {
        console.error('Prompt error:', error);
        return null;
    }
}

function updateSetting(key, value) {
    settings[key] = value;
    GM_setValue(key, value);
    console.log(`Updated ${key} to:`, value);
}

function reloadPage() {
    try {
        window.location.reload();
    } catch (error) {
        console.error('Reload failed:', error);
    }
}

// Menu commands with improved validation
function setupMenuCommands() {
    GM_registerMenuCommand(`↑: ${settings.UP}`, function() {
        const value = safePrompt(GUIDE, settings.UP);
        if (value) {
            updateSetting('UP', value);
            reloadPage();
        }
    });
    
    GM_registerMenuCommand(`↓: ${settings.DOWN}`, function() {
        const value = safePrompt(GUIDE, settings.DOWN);
        if (value) {
            updateSetting('DOWN', value);
            reloadPage();
        }
    });
    
    GM_registerMenuCommand(`←: ${settings.LEFT}`, function() {
        const value = safePrompt(GUIDE, settings.LEFT);
        if (value) {
            updateSetting('LEFT', value);
            reloadPage();
        }
    });
    
    GM_registerMenuCommand(`→: ${settings.RIGHT}`, function() {
        const value = safePrompt(GUIDE, settings.RIGHT);
        if (value) {
            updateSetting('RIGHT', value);
            reloadPage();
        }
    });
    
    GM_registerMenuCommand('HLS Domains', function() {
        const value = safePrompt('Example: 1.com,2.com,3.com,4.com', settings.hlsdomain);
        if (value !== null) {
            updateSetting('hlsdomain', value);
            hlsdomainArray = value.split(',').filter(d => d.trim());
        }
    });
    
    GM_registerMenuCommand(`Live Chat: ${settings.livechat}`, function() {
        updateSetting('livechat', !settings.livechat);
        reloadPage();
    });
    
    GM_registerMenuCommand(`Directions: ${settings.total_direction}`, function() {
        const newValue = settings.total_direction === 4 ? 8 : 4;
        updateSetting('total_direction', newValue);
        reloadPage();
    });
    
    GM_registerMenuCommand(`DOWN Confirm: ${settings.down_confirm ? 'ON' : 'OFF'}`, function() {
        updateSetting('down_confirm', !settings.down_confirm);
        reloadPage();
    });
}

// Utility function to find parent by tag name
function getParentByTagName(element, tagName) {
    if (!element || typeof tagName !== 'string') return null;
    
    tagName = tagName.toLowerCase();
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
        if (current.tagName && current.tagName.toLowerCase() === tagName) {
            return current;
        }
        current = current.parentNode;
    }
    return null;
}

// Base64 URL encoding
function encodeUrl(url) {
    try {
        return btoa(url).replace(/\//g, "_").replace(/\+/g, "-").replace(/=/g, "");
    } catch (error) {
        console.error('URL encoding failed:', error);
        return '';
    }
}

// Popup window for live chat
function openPopout(chatUrl) {
    try {
        const features = [
            'fullscreen=no',
            'toolbar=no', 
            'titlebar=no',
            'menubar=no',
            'location=no',
            `width=${LIVE_WINDOW_WIDTH}`,
            `height=${LIVE_WINDOW_HEIGHT}`
        ].join(',');
        
        window.open(chatUrl, '', features);
    } catch (error) {
        console.error('Failed to open popout:', error);
    }
}

// Live chat opener with improved error handling
function openLiveChat(url) {
    try {
        const urlObj = new URL(url);
        const href = urlObj.href;
        
        if (href.includes('www.youtube.com/watch') || href.includes('m.youtube.com/watch')) {
            const videoId = urlObj.searchParams.get('v');
            if (videoId) {
                openPopout(`https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`);
            }
        } else if (href.match(/https:\/\/.*?\.twitch\.tv\//)) {
            openPopout(`https://www.twitch.tv/popout${urlObj.pathname}/chat?popout=`);
        } else if (href.match(/https:\/\/.*?\.nimo\.tv\//)) {
            try {
                const selector = `a[href="${urlObj.pathname}"] .nimo-player.n-as-full`;
                const element = document.querySelector(selector);
                if (element && element.id) {
                    const streamId = element.id.replace('home-hot-', '');
                    openPopout(`https://www.nimo.tv/popout/chat/${streamId}`);
                }
            } catch (error) {
                console.error('Nimo.tv chat extraction failed:', error);
            }
        }
    } catch (error) {
        console.error('Live chat opener failed:', error);
    }
}

// Enhanced action handler
function executeAction(targetUrl, actionType) {
    console.log('Executing action:', actionType, 'for URL:', targetUrl);
    
    // Check if this is a DOWN action and confirmation is enabled
    if (actionType === settings.DOWN && settings.down_confirm) {
        const confirmed = confirm(`Confirm DOWN action (${actionType})?\n\nURL: ${targetUrl}\n\nClick OK to proceed or Cancel to abort.`);
        if (!confirmed) {
            console.log('DOWN action cancelled by user');
            return;
        }
    }
    
    let finalUrl = '';
    let app = 'play';
    let isHls = false;
    
    // Check HLS domains
    for (const domain of hlsdomainArray) {
        if (domain && (targetUrl.includes(domain) || document.domain.includes(domain))) {
            if (actionType === 'stream') {
                targetUrl = targetUrl.replace(/^https?:/, 'hls:');
            }
            isHls = true;
            break;
        }
    }
    
    // Handle different URL types
    if (targetUrl.startsWith('http') || targetUrl.startsWith('hls:')) {
        finalUrl = targetUrl;
    } else if (targetUrl.startsWith('mpv://')) {
        try {
            location.href = targetUrl;
        } catch (error) {
            console.error('Failed to navigate to mpv URL:', error);
        }
        return;
    } else {
        finalUrl = location.href;
    }
    
    // Process collected URLs
    let urlString = '';
    if (collectedUrls.size > 0) {
        const urls = Array.from(collectedUrls.keys());
        urlString = urls.join(' ');
        
        // Reset visual indicators
        collectedUrls.forEach((element, url) => {
            try {
                element.style.boxSizing = 'unset';
                element.style.border = 'unset';
            } catch (error) {
                console.error('Failed to reset element style:', error);
            }
        });
        
        collectedUrls.clear();
        console.log('Processed collected URLs:', urlString);
    } else {
        urlString = finalUrl;
    }
    
    // Determine app type
    switch (actionType) {
        case 'pipe':
            app = 'mpvy';
            break;
        case 'iptv':
            app = 'list';
            break;
        case 'stream':
            app = 'stream';
            break;
        case 'mpv':
        case 'vid':
            app = 'play';
            break;
        default:
            app = actionType;
    }
    
    // Build final URL
    const encodedUrl = encodeUrl(urlString);
    const encodedReferer = encodeUrl(location.href);
    let protocolUrl = `mpv://${app}/${encodedUrl}/?referer=${encodedReferer}`;
    
    if (isHls) {
        protocolUrl += '&hls=1';
    }
    
    console.log('Action details:', {
        actionType,
        app,
        finalUrl,
        urlString,
        isHls,
        protocolUrl
    });
    
    // Open live chat if needed
    if (actionType === 'stream' && settings.livechat) {
        openLiveChat(finalUrl);
    }
    
    console.log('Final protocol URL:', protocolUrl);
    
    try {
        location.href = protocolUrl;
    } catch (error) {
        console.error('Failed to navigate to protocol URL:', error);
    }
}

// Direction calculation
function getDirection(startX, startY, endX, endY) {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    
    // Check for center (no movement)
    if (Math.abs(deltaX) < DRAG_THRESHOLD && Math.abs(deltaY) < DRAG_THRESHOLD) {
        return DirectionEnum.CENTER;
    }
    
    if (settings.total_direction === 4) {
        // 4-direction mode
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            return deltaX > 0 ? DirectionEnum.RIGHT : DirectionEnum.LEFT;
        } else {
            return deltaY > 0 ? DirectionEnum.DOWN : DirectionEnum.UP;
        }
    } else {
        // 8-direction mode
        if (deltaX === 0) {
            return deltaY > 0 ? DirectionEnum.DOWN : DirectionEnum.UP;
        }
        
        const slope = deltaY / deltaX;
        const absSlope = Math.abs(slope);
        
        if (absSlope < 0.4142) { // ~22.5 degrees
            return deltaX > 0 ? DirectionEnum.RIGHT : DirectionEnum.LEFT;
        } else if (absSlope > 2.4142) { // ~67.5 degrees
            return deltaY > 0 ? DirectionEnum.DOWN : DirectionEnum.UP;
        } else {
            // Diagonal directions
            if (deltaX > 0) {
                return deltaY > 0 ? DirectionEnum.DOWN_RIGHT : DirectionEnum.UP_RIGHT;
            } else {
                return deltaY > 0 ? DirectionEnum.DOWN_LEFT : DirectionEnum.UP_LEFT;
            }
        }
    }
}

// Enhanced drag handler
function attachDragHandler(element) {
    if (!element || attachedElements.has(element)) return;
    
    attachedElements.add(element);
    
    element.addEventListener('dragstart', function(event) {
        console.log('Drag started');
        const startX = event.clientX;
        const startY = event.clientY;
        
        const handleDragEnd = function(endEvent) {
            const endX = endEvent.clientX;
            const endY = endEvent.clientY;
            const direction = getDirection(startX, startY, endX, endY);
            
            console.log(`Drag direction: ${direction} (${startX},${startY} -> ${endX},${endY})`);
            console.log('Current settings:', settings);
            
            const targetHref = endEvent.target.href || endEvent.target.src;
            if (!targetHref) {
                console.warn('No href or src found on target element');
                return;
            }
            
            console.log('Target URL:', targetHref);
            
            // Execute action based on direction
            switch (direction) {
                case DirectionEnum.RIGHT:
                    executeAction(targetHref, settings.RIGHT);
                    break;
                case DirectionEnum.LEFT:
                    executeAction(targetHref, settings.LEFT);
                    break;
                case DirectionEnum.UP:
                    executeAction(targetHref, settings.UP);
                    break;
                case DirectionEnum.DOWN:
                    executeAction(targetHref, settings.DOWN);
                    break;
                case DirectionEnum.UP_LEFT:
                    executeAction(targetHref, 'list');
                    break;
                default:
                    console.log('Direction not mapped to action:', direction);
            }
            
            // Cleanup
            element.removeEventListener('dragend', handleDragEnd);
        };
        
        element.addEventListener('dragend', handleDragEnd, { once: true });
    });
}

// Enhanced right-click collection
function setupRightClickCollection() {
    let mouseIsDown = false;
    let isHeld = false;
    
    document.addEventListener('mousedown', function(event) {
        const link = getParentByTagName(event.target, 'A');
        if (!link) return;
        
        mouseIsDown = true;
        
        // Cleanup listeners
        const handleMouseUp = function() {
            mouseIsDown = false;
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        const handleContextMenu = function(contextEvent) {
            if (isHeld) {
                contextEvent.preventDefault();
                isHeld = false;
            }
            document.removeEventListener('contextmenu', handleContextMenu);
        };
        
        document.addEventListener('mouseup', handleMouseUp, { once: true });
        document.addEventListener('contextmenu', handleContextMenu, { once: true });
        
        // Handle right-click
        if (event.button === 2) {
            setTimeout(function() {
                if (mouseIsDown) {
                    toggleUrlCollection(link, event.target);
                    mouseIsDown = false;
                    isHeld = true;
                }
            }, RIGHT_CLICK_DELAY);
        }
    });
}

// URL collection toggle
function toggleUrlCollection(link, target) {
    if (!link.href) return;
    
    if (collectedUrls.has(link.href)) {
        // Remove from collection
        const element = collectedUrls.get(link.href);
        try {
            element.style.boxSizing = 'unset';
            element.style.border = 'unset';
        } catch (error) {
            console.error('Failed to reset element style:', error);
        }
        collectedUrls.delete(link.href);
        console.log('Removed URL from collection:', link.href);
    } else {
        // Add to collection
        try {
            target.style.boxSizing = 'border-box';
            target.style.border = 'solid yellow 4px';
        } catch (error) {
            console.error('Failed to set element style:', error);
        }
        collectedUrls.set(link.href, target);
        console.log('Added URL to collection:', link.href);
    }
    
    console.log('Current collection size:', collectedUrls.size);
}

// Shadow DOM handler
function handleShadowRoots() {
    document.addEventListener('mouseover', function(event) {
        if (event.target.shadowRoot && !attachedElements.has(event.target)) {
            attachDragHandler(event.target.shadowRoot);
        }
    });
}

// YouTube-specific enhancements
function setupYouTubeFeatures() {
    const domain = document.domain;
    if (domain !== 'www.youtube.com' && domain !== 'm.youtube.com') return;
    
    const state = GM_getValue('hh_mobile', 'unset');
    const firstChar = (location.host || '').charAt(0);
    
    function addYouTubeMenuCommand(label, url, persistent) {
        GM_registerMenuCommand(label, function() {
            if (persistent) {
                if (url.includes('m.youtube.com')) {
                    updateSetting('hh_mobile', true);
                } else if (url.includes('www.youtube.com')) {
                    updateSetting('hh_mobile', false);
                }
            } else {
                GM_deleteValue('hh_mobile');
            }
            
            try {
                location.replace(url);
            } catch (error) {
                console.error('Failed to navigate:', error);
            }
        });
    }
    
    if (firstChar === 'w') {
        addYouTubeMenuCommand(
            "Switch to YouTube Mobile (Persistent)",
            "https://m.youtube.com/?persist_app=1&app=m",
            true
        );
        addYouTubeMenuCommand(
            "Switch to YouTube Mobile (Temporary)",
            "https://m.youtube.com/?persist_app=0&app=m",
            false
        );
    } else if (firstChar === 'm') {
        addYouTubeMenuCommand(
            "Switch to YouTube Desktop (Persistent)",
            "https://www.youtube.com/?persist_app=1&app=desktop",
            true
        );
        addYouTubeMenuCommand(
            "Switch to YouTube Desktop (Temporary)",
            "https://www.youtube.com/?persist_app=0&app=desktop",
            false
        );
        
        // Mobile layout improvements
        try {
            GM_addStyle(`
                ytm-rich-item-renderer {
                    width: 33% !important;
                    margin: 1px !important;
                    padding: 0px !important;
                }
            `);
        } catch (error) {
            console.error('Failed to apply YouTube mobile styles:', error);
        }
    }
}

// Initialize everything
function initialize() {
    try {
        setupMenuCommands();
        attachDragHandler(document);
        setupRightClickCollection();
        handleShadowRoots();
        setupYouTubeFeatures();
        
        console.log('Handlers Helper (Improved) initialized successfully');
    } catch (error) {
        console.error('Initialization failed:', error);
    }
}

// Start the script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
