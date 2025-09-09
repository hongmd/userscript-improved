// ==UserScript==
// @name        Handlers Helper (Improved)
// @include     *://*/*
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_addStyle
// @grant       GM_registerMenuCommand
// @version     4.8.5
// @author      hongmd (improved)
// @description Helper for protocol_hook.lua - Fixed bugs, improved performance and reliability. Fixed division by zero and YouTube navigation issues.
// @namespace   Violentmonkey Scripts
// ==/UserScript==

'use strict';

// === CONSTANTS AND DEFAULTS ===
const GUIDE = 'Value: pipe ytdl stream mpv iptv';

/* ACTION EXPLANATIONS:
 * 📺 pipe (UP) → mpv://mpvy/ → Pipe video to MPV with yt-dlp processing
 * 📥 ytdl (DOWN) → mpv://ytdl/ → Download video using yt-dlp  
 * 🌊 stream (LEFT) → mpv://stream/ → Stream video using streamlink
 * ▶️ mpv (RIGHT) → mpv://play/ → Direct play in MPV player
 * 📋 iptv → mpv://list/ → Add to IPTV playlist
 */
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
    down_confirm: true, // New setting to confirm DOWN action
    debug: false // Debug logging toggle
};

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

// === GLOBAL STATE ===
let settings = {
    UP: GM_getValue('UP', DEFAULTS.UP),
    DOWN: GM_getValue('DOWN', DEFAULTS.DOWN),
    LEFT: GM_getValue('LEFT', DEFAULTS.LEFT),
    RIGHT: GM_getValue('RIGHT', DEFAULTS.RIGHT),
    hlsdomain: GM_getValue('hlsdomain', DEFAULTS.hlsdomain),
    livechat: GM_getValue('livechat', DEFAULTS.livechat),
    total_direction: GM_getValue('total_direction', DEFAULTS.total_direction),
    down_confirm: GM_getValue('down_confirm', DEFAULTS.down_confirm),
    debug: GM_getValue('debug', DEFAULTS.debug)
};

let hlsdomainArray = settings.hlsdomain.split(',').filter(d => d.trim());
let collectedUrls = new Map(); // Use Map instead of object for better performance
let attachedElements = new WeakSet(); // Use WeakSet to prevent memory leaks

debugLog('Handlers Helper loaded with settings:', settings);

// === UTILITY FUNCTIONS ===
function safePrompt(message, defaultValue) {
    try {
        const result = window.prompt(message, defaultValue);
        return result === null ? null : result.trim();
    } catch (error) {
        debugError('Prompt error:', error);
        return null;
    }
}

function updateSetting(key, value) {
    settings[key] = value;
    GM_setValue(key, value);
    debugLog(`Updated ${key} to:`, value);
}

function reloadPage() {
    try {
        window.location.reload();
    } catch (error) {
        debugError('Reload failed:', error);
    }
}

// Optimized logging function - only logs when debug is enabled
function debugLog(...args) {
    if (settings.debug) {
        console.log(...args);
    }
}

function debugWarn(...args) {
    if (settings.debug) {
        console.warn(...args);
    }
}

function debugError(...args) {
    if (settings.debug) {
        console.error(...args);
    }
}

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

function encodeUrl(url) {
    try {
        // Validate URL before encoding
        new URL(url);
        return btoa(url).replace(/\//g, "_").replace(/\+/g, "-").replace(/=/g, "");
    } catch (error) {
        debugError('Invalid URL provided to encodeUrl:', url, error);
        return '';
    }
}

// Process DOM mutations for drag handler optimization
function processMutations(mutations) {
    let needsUpdate = false;
    mutations.forEach(function (mutation) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const links = node.querySelectorAll ? node.querySelectorAll('a[href]') : [];
                    if (links.length > 0) needsUpdate = true;

                    if (node.tagName === 'A' && node.href && !node.draggable) {
                        needsUpdate = true;
                    }
                }
            });
        }
    });

    if (needsUpdate) {
        makeLinksDraggable();
    }
}

// YouTube menu command helper
function addYouTubeMenuCommand(label, url, persistent) {
    GM_registerMenuCommand(label, function () {
        if (persistent) {
            if (url.includes('m.youtube.com')) {
                GM_setValue('hh_mobile', true);
            } else if (url.includes('www.youtube.com')) {
                GM_setValue('hh_mobile', false);
            }
        } else {
            GM_deleteValue('hh_mobile');
        }

        try {
            location.replace(url);
        } catch (error) {
            debugError('Failed to navigate:', error);
        }
    });
}

// === HELP AND TESTING FUNCTIONS ===
function showActionHelp() {
    const helpText = `🎮 DRAG DIRECTIONS & ACTIONS:

📺 UP (↑): ${settings.UP}
   → Pipes video to MPV with yt-dlp processing
   → Good for: YouTube, complex streams

📥 DOWN (↓): ${settings.DOWN} ${settings.down_confirm ? '(Confirm: ON)' : '(Confirm: OFF)'}
   → Downloads video using yt-dlp
   → Good for: Saving videos locally

🌊 LEFT (←): ${settings.LEFT}
   → Streams video using streamlink
   → Good for: Twitch, live streams

▶️ RIGHT (→): ${settings.RIGHT}
   → Direct play in MPV player
   → Good for: Direct video files

📋 UP-LEFT (↖): list
   → Adds to IPTV/playlist
   → Good for: Building playlists

🎯 USAGE:
1. Hover over a video link
2. Drag in desired direction
3. Release to trigger action

🔧 Settings: ${settings.total_direction} directions, HLS: ${hlsdomainArray.length} domains

🐛 TROUBLESHOOTING:
- Check browser console (F12) for debug logs
- Make sure links are draggable (script auto-enables)
- Try dragging further than ${DRAG_THRESHOLD}px
- Look for "🚀 Drag started" and "⬆️ Executing UP action" logs`;

    alert(helpText);
}

function testDirections() {
    debugLog('🧪 Testing direction detection:');
    const tests = [
        { name: 'UP', start: [100, 100], end: [100, 50] },
        { name: 'DOWN', start: [100, 100], end: [100, 150] },
        { name: 'LEFT', start: [100, 100], end: [50, 100] },
        { name: 'RIGHT', start: [100, 100], end: [150, 100] },
        { name: 'UP-LEFT', start: [100, 100], end: [50, 50] },
        { name: 'NO MOVEMENT', start: [100, 100], end: [105, 105] }
    ];

    tests.forEach(test => {
        const direction = getDirection(test.start[0], test.start[1], test.end[0], test.end[1]);
        debugLog(`${test.name}: (${test.start[0]},${test.start[1]}) -> (${test.end[0]},${test.end[1]}) = Direction ${direction}`);
    });
}

// === MENU COMMANDS SETUP ===
function setupMenuCommands() {
    // Help command first
    GM_registerMenuCommand('❓ Show Action Help', showActionHelp);
    GM_registerMenuCommand('🧪 Test Directions', testDirections);

    GM_registerMenuCommand(`📺 UP: ${settings.UP}`, function () {
        const value = safePrompt(GUIDE + '\n\n↑ UP Action (pipe = stream to MPV with yt-dlp)', settings.UP);
        if (value) {
            updateSetting('UP', value);
            reloadPage();
        }
    });

    GM_registerMenuCommand(`📥 DOWN: ${settings.DOWN}`, function () {
        const value = safePrompt(GUIDE + '\n\n↓ DOWN Action (ytdl = download with yt-dlp)', settings.DOWN);
        if (value) {
            updateSetting('DOWN', value);
            reloadPage();
        }
    });

    GM_registerMenuCommand(`🌊 LEFT: ${settings.LEFT}`, function () {
        const value = safePrompt(GUIDE + '\n\n← LEFT Action (stream = use streamlink)', settings.LEFT);
        if (value) {
            updateSetting('LEFT', value);
            reloadPage();
        }
    });

    GM_registerMenuCommand(`▶️ RIGHT: ${settings.RIGHT}`, function () {
        const value = safePrompt(GUIDE + '\n\n→ RIGHT Action (mpv = direct play)', settings.RIGHT);
        if (value) {
            updateSetting('RIGHT', value);
            reloadPage();
        }
    });

    GM_registerMenuCommand('HLS Domains', function () {
        const value = safePrompt('Example: 1.com,2.com,3.com,4.com', settings.hlsdomain);
        if (value !== null) {
            updateSetting('hlsdomain', value);
            hlsdomainArray = value.split(',').filter(d => d.trim());
        }
    });

    GM_registerMenuCommand(`Live Chat: ${settings.livechat}`, function () {
        updateSetting('livechat', !settings.livechat);
        reloadPage();
    });

    GM_registerMenuCommand(`Directions: ${settings.total_direction}`, function () {
        const newValue = settings.total_direction === 4 ? 8 : 4;
        updateSetting('total_direction', newValue);
        reloadPage();
    });

    GM_registerMenuCommand(`DOWN Confirm: ${settings.down_confirm ? 'ON' : 'OFF'}`, function () {
        updateSetting('down_confirm', !settings.down_confirm);
        reloadPage();
    });

    GM_registerMenuCommand(`🐛 Debug Mode: ${settings.debug ? 'ON' : 'OFF'}`, function () {
        updateSetting('debug', !settings.debug);
        reloadPage();
    });
}

// === LIVE CHAT FUNCTIONS ===
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
        debugError('Failed to open popout:', error);
    }
}

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
                debugError('Nimo.tv chat extraction failed:', error);
            }
        }
    } catch (error) {
        debugError('Live chat opener failed:', error);
    }
}

// === ACTION EXECUTION ===
function executeAction(targetUrl, actionType) {
    debugLog('Executing action:', actionType, 'for URL:', targetUrl);

    // Check if this is a DOWN action and confirmation is enabled
    if (actionType === settings.DOWN && settings.down_confirm) {
        const confirmed = confirm(`Confirm DOWN action (${actionType})?\n\nURL: ${targetUrl}\n\nClick OK to proceed or Cancel to abort.`);
        if (!confirmed) {
            debugLog('DOWN action cancelled by user');
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
            debugError('Failed to navigate to mpv URL:', error);
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
        collectedUrls.forEach((element) => {
            try {
                element.style.boxSizing = 'unset';
                element.style.border = 'unset';
            } catch (error) {
                debugError('Failed to reset element style:', error);
            }
        });

        collectedUrls.clear();
        debugLog('Processed collected URLs:', urlString);
    } else {
        urlString = finalUrl;
    }

    // Determine app type and protocol action
    switch (actionType) {
        case 'pipe':
            app = 'mpvy'; // Pipe video stream to MPV with yt-dlp preprocessing
            break;
        case 'iptv':
            app = 'list'; // Add to IPTV playlist
            break;
        case 'stream':
            app = 'stream'; // Stream using streamlink
            break;
        case 'mpv':
        case 'vid':
            app = 'play'; // Direct play in MPV
            break;
        default:
            app = actionType; // Pass through custom actions
    }

    // Build final URL
    const encodedUrl = encodeUrl(urlString);
    const encodedReferer = encodeUrl(location.href);
    let protocolUrl = `mpv://${app}/${encodedUrl}/?referer=${encodedReferer}`;

    if (isHls) {
        protocolUrl += '&hls=1';
    }

    debugLog('Action details:', {
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

    debugLog('Final protocol URL:', protocolUrl);

    try {
        location.href = protocolUrl;
    } catch (error) {
        debugError('Failed to navigate to protocol URL:', error);
    }
}

// === DIRECTION CALCULATION ===
function getDirection(startX, startY, endX, endY) {
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    debugLog('Direction calculation:', {
        start: [startX, startY],
        end: [endX, endY],
        delta: [deltaX, deltaY],
        threshold: DRAG_THRESHOLD
    });

    // Check for center (no movement)
    if (Math.abs(deltaX) < DRAG_THRESHOLD && Math.abs(deltaY) < DRAG_THRESHOLD) {
        debugLog('Direction: CENTER (no movement)');
        return DirectionEnum.CENTER;
    }

    let direction;

    if (settings.total_direction === 4) {
        // 4-direction mode
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? DirectionEnum.RIGHT : DirectionEnum.LEFT;
        } else {
            direction = deltaY > 0 ? DirectionEnum.DOWN : DirectionEnum.UP;
        }
        debugLog('4-direction mode, result:', direction, direction === DirectionEnum.UP ? '(UP)' : direction === DirectionEnum.DOWN ? '(DOWN)' : direction === DirectionEnum.LEFT ? '(LEFT)' : '(RIGHT)');
    } else {
        // 8-direction mode
        if (deltaX === 0) {
            direction = deltaY > 0 ? DirectionEnum.DOWN : DirectionEnum.UP;
            debugLog('8-direction mode, vertical movement, result:', direction);
        } else {
            const slope = deltaY / deltaX;
            const absSlope = Math.abs(slope);

            if (absSlope < 0.4142) { // ~22.5 degrees
                direction = deltaX > 0 ? DirectionEnum.RIGHT : DirectionEnum.LEFT;
            } else if (absSlope > 2.4142) { // ~67.5 degrees
                direction = deltaY > 0 ? DirectionEnum.DOWN : DirectionEnum.UP;
            } else {
                // Diagonal directions
                if (deltaX > 0) {
                    direction = deltaY > 0 ? DirectionEnum.DOWN_RIGHT : DirectionEnum.UP_RIGHT;
                } else {
                    direction = deltaY > 0 ? DirectionEnum.DOWN_LEFT : DirectionEnum.UP_LEFT;
                }
            }
            debugLog('8-direction mode, slope:', slope, 'result:', direction);
        }
    }

    return direction;
}

// === DRAG HANDLING ===
function attachDragHandler(element) {
    if (!element || attachedElements.has(element)) return;

    attachedElements.add(element);

    // Make sure elements are draggable - optimized version
    if (element === document) {
        // Use a single observer with throttling
        let observerTimeout;
        const observer = new MutationObserver(function (mutations) {
            // Throttle observer updates to prevent excessive processing
            if (observerTimeout) return;

            observerTimeout = setTimeout(() => {
                observerTimeout = null;
                processMutations(mutations);
            }, 100); // 100ms throttle
        });

        observer.observe(document, {
            childList: true,
            subtree: true
        });

        // Initial setup
        makeLinksDraggable();

        // Use event delegation for drag events
        let dragState = null;

        document.addEventListener('dragstart', function (event) {
            const link = getDraggableLink(event.target);
            if (!link) return;

            debugLog('🚀 Drag started on element:', event.target.tagName, link.href || event.target.src);
            dragState = {
                startX: event.clientX,
                startY: event.clientY,
                target: link
            };

            // Prevent default drag behavior for non-draggable elements
            if (!event.target.draggable) {
                event.preventDefault();
                return;
            }
        }, { passive: true });

        document.addEventListener('dragend', function (event) {
            if (!dragState) return;

            debugLog('🏁 Drag ended');
            const endX = event.clientX;
            const endY = event.clientY;

            const direction = getDirection(dragState.startX, dragState.startY, endX, endY);

            debugLog(`🎯 Final drag direction: ${direction} (${dragState.startX},${dragState.startY} -> ${endX},${endY})`);
            debugLog('Current settings:', settings);

            const targetHref = dragState.target.href || dragState.target.src;
            if (!targetHref) {
                debugWarn('❌ No href or src found on target element');
                dragState = null;
                return;
            }

            debugLog('🔗 Target URL:', targetHref);

            // Execute action based on direction
            switch (direction) {
                case DirectionEnum.RIGHT:
                    debugLog('➡️ Executing RIGHT action:', settings.RIGHT);
                    executeAction(targetHref, settings.RIGHT);
                    break;
                case DirectionEnum.LEFT:
                    debugLog('⬅️ Executing LEFT action:', settings.LEFT);
                    executeAction(targetHref, settings.LEFT);
                    break;
                case DirectionEnum.UP:
                    debugLog('⬆️ Executing UP action:', settings.UP);
                    executeAction(targetHref, settings.UP);
                    break;
                case DirectionEnum.DOWN:
                    debugLog('⬇️ Executing DOWN action:', settings.DOWN);
                    executeAction(targetHref, settings.DOWN);
                    break;
                case DirectionEnum.UP_LEFT:
                    debugLog('↖️ Executing UP_LEFT action: list');
                    executeAction(targetHref, 'list');
                    break;
                default:
                    debugLog('❓ Direction not mapped to action:', direction);
            }

            dragState = null;
        }, { passive: true });
    }
}

// Helper function to find draggable link from event target
function getDraggableLink(element) {
    if (!element) return null;

    let current = element;
    while (current && current !== document) {
        if (current.tagName === 'A' && current.href) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}

// Optimized function to make links draggable
function makeLinksDraggable() {
    // Use a single query and cache the result
    const links = document.querySelectorAll('a[href]:not([draggable="true"])');
    links.forEach(link => {
        link.draggable = true;
        debugLog('Made link draggable:', link.href);
    });
}

// === RIGHT-CLICK COLLECTION ===
function setupRightClickCollection() {
    let mouseIsDown = false;
    let isHeld = false;

    document.addEventListener('mousedown', function (event) {
        const link = getParentByTagName(event.target, 'A');
        if (!link) return;

        mouseIsDown = true;

        // Cleanup listeners
        const handleMouseUp = function () {
            mouseIsDown = false;
            document.removeEventListener('mouseup', handleMouseUp);
        };

        const handleContextMenu = function (contextEvent) {
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
            setTimeout(function () {
                if (mouseIsDown) {
                    toggleUrlCollection(link, event.target);
                    mouseIsDown = false;
                    isHeld = true;
                }
            }, RIGHT_CLICK_DELAY);
        }
    });
}

function toggleUrlCollection(link, target) {
    if (!link.href) return;

    if (collectedUrls.has(link.href)) {
        // Remove from collection
        const element = collectedUrls.get(link.href);
        try {
            element.style.boxSizing = 'unset';
            element.style.border = 'unset';
        } catch (error) {
            debugError('Failed to reset element style:', error);
        }
        collectedUrls.delete(link.href);
        debugLog('Removed URL from collection:', link.href);
    } else {
        // Add to collection
        try {
            target.style.boxSizing = 'border-box';
            target.style.border = 'solid yellow 4px';
        } catch (error) {
            debugError('Failed to set element style:', error);
        }
        collectedUrls.set(link.href, target);
        debugLog('Added URL from collection:', link.href);
    }

    debugLog('Current collection size:', collectedUrls.size);
}

// === SHADOW DOM AND SPECIAL FEATURES ===
function handleShadowRoots() {
    document.addEventListener('mouseover', function (event) {
        if (event.target.shadowRoot && !attachedElements.has(event.target)) {
            attachDragHandler(event.target.shadowRoot);
        }
    });
}

function setupYouTubeFeatures() {
    const domain = document.domain;
    if (domain !== 'www.youtube.com' && domain !== 'm.youtube.com') return;

    const firstChar = (location.host || '').charAt(0);

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
            debugError('Failed to apply YouTube mobile styles:', error);
        }
    }
}

// === CLEANUP ON PAGE UNLOAD ===
function cleanup() {
    // Clear collections to free memory
    collectedUrls.clear();

    // Remove any visual indicators
    document.querySelectorAll('[style*="border: solid yellow 4px"]').forEach(el => {
        el.style.border = '';
        el.style.boxSizing = '';
    });

    debugLog('Handlers Helper cleanup completed');
}

// Add cleanup on page unload
window.addEventListener('beforeunload', cleanup);

// === INITIALIZATION ===
function initialize() {
    try {
        setupMenuCommands();
        attachDragHandler(document); // Use standard drag handler
        setupRightClickCollection();
        handleShadowRoots();
        setupYouTubeFeatures();

        debugLog('Handlers Helper (Improved) initialized successfully');
        debugLog('Settings validated and loaded');
    } catch (error) {
        debugError('Initialization failed:', error);
    }
}

// Start the script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
