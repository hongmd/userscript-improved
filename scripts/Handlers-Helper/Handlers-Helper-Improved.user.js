// ==UserScript==
// @name        Handlers Helper (Improved)
// @include     *://*/*
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_addStyle
// @grant       GM_registerMenuCommand
// @version     4.8.1
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
    down_confirm: true // New setting to confirm DOWN action
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
    down_confirm: GM_getValue('down_confirm', DEFAULTS.down_confirm)
};

let hlsdomainArray = settings.hlsdomain.split(',').filter(d => d.trim());
let collectedUrls = new Map(); // Use Map instead of object for better performance
let attachedElements = new WeakSet(); // Use WeakSet to prevent memory leaks

console.log('Handlers Helper loaded with settings:', settings);

// === UTILITY FUNCTIONS ===
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
        console.error('Invalid URL provided to encodeUrl:', url, error);
        return '';
    }
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
    console.log('🧪 Testing direction detection:');
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
        console.log(`${test.name}: (${test.start[0]},${test.start[1]}) -> (${test.end[0]},${test.end[1]}) = Direction ${direction}`);
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
        console.error('Failed to open popout:', error);
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
                console.error('Nimo.tv chat extraction failed:', error);
            }
        }
    } catch (error) {
        console.error('Live chat opener failed:', error);
    }
}

// === ACTION EXECUTION ===
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
        collectedUrls.forEach((element) => {
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

// === DIRECTION CALCULATION ===
function getDirection(startX, startY, endX, endY) {
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    console.log('Direction calculation:', {
        start: [startX, startY],
        end: [endX, endY],
        delta: [deltaX, deltaY],
        threshold: DRAG_THRESHOLD
    });

    // Check for center (no movement)
    if (Math.abs(deltaX) < DRAG_THRESHOLD && Math.abs(deltaY) < DRAG_THRESHOLD) {
        console.log('Direction: CENTER (no movement)');
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
        console.log('4-direction mode, result:', direction, direction === DirectionEnum.UP ? '(UP)' : direction === DirectionEnum.DOWN ? '(DOWN)' : direction === DirectionEnum.LEFT ? '(LEFT)' : '(RIGHT)');
    } else {
        // 8-direction mode
        if (deltaX === 0) {
            direction = deltaY > 0 ? DirectionEnum.DOWN : DirectionEnum.UP;
            console.log('8-direction mode, vertical movement, result:', direction);
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
            console.log('8-direction mode, slope:', slope, 'result:', direction);
        }
    }

    return direction;
}

// === DRAG HANDLING ===
function attachDragHandler(element) {
    if (!element || attachedElements.has(element)) return;

    attachedElements.add(element);

    // Make sure elements are draggable
    if (element === document) {
        // For document, we need to make links draggable
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const links = node.querySelectorAll ? node.querySelectorAll('a') : [];
                        links.forEach(link => {
                            if (link.href && !link.draggable) {
                                link.draggable = true;
                                console.log('Made link draggable:', link.href);
                            }
                        });

                        if (node.tagName === 'A' && node.href && !node.draggable) {
                            node.draggable = true;
                            console.log('Made link draggable:', node.href);
                        }
                    }
                });
            });
        });

        observer.observe(document, {
            childList: true,
            subtree: true
        });

        // Make existing links draggable
        document.querySelectorAll('a').forEach(link => {
            if (link.href && !link.draggable) {
                link.draggable = true;
                console.log('Made existing link draggable:', link.href);
            }
        });
    }

    element.addEventListener('dragstart', function (event) {
        console.log('🚀 Drag started on element:', event.target.tagName, event.target.href || event.target.src);
        const startX = event.clientX;
        const startY = event.clientY;

        console.log('Drag start coordinates:', startX, startY);

        const handleDragEnd = function (endEvent) {
            console.log('🏁 Drag ended');
            const endX = endEvent.clientX;
            const endY = endEvent.clientY;

            console.log('Drag end coordinates:', endX, endY);

            const direction = getDirection(startX, startY, endX, endY);

            console.log(`🎯 Final drag direction: ${direction} (${startX},${startY} -> ${endX},${endY})`);
            console.log('Current settings:', settings);

            const targetHref = endEvent.target.href || endEvent.target.src;
            if (!targetHref) {
                console.warn('❌ No href or src found on target element');
                return;
            }

            console.log('🔗 Target URL:', targetHref);

            // Execute action based on direction
            switch (direction) {
                case DirectionEnum.RIGHT:
                    console.log('➡️ Executing RIGHT action:', settings.RIGHT);
                    executeAction(targetHref, settings.RIGHT);
                    break;
                case DirectionEnum.LEFT:
                    console.log('⬅️ Executing LEFT action:', settings.LEFT);
                    executeAction(targetHref, settings.LEFT);
                    break;
                case DirectionEnum.UP:
                    console.log('⬆️ Executing UP action:', settings.UP);
                    executeAction(targetHref, settings.UP);
                    break;
                case DirectionEnum.DOWN:
                    console.log('⬇️ Executing DOWN action:', settings.DOWN);
                    executeAction(targetHref, settings.DOWN);
                    break;
                case DirectionEnum.UP_LEFT:
                    console.log('↖️ Executing UP_LEFT action: list');
                    executeAction(targetHref, 'list');
                    break;
                default:
                    console.log('❓ Direction not mapped to action:', direction);
            }

            // Cleanup
            element.removeEventListener('dragend', handleDragEnd);
        };

        element.addEventListener('dragend', handleDragEnd, { once: true });
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

// === ENHANCED USER FEEDBACK ===
function showNotification(message, type = 'info', duration = 3000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff'};
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        max-width: 300px;
        word-wrap: break-word;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto-remove after duration
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, duration);
}

// Enhanced error handling
function handleError(error, context = '') {
    console.error(`Handlers Helper Error${context ? ` (${context})` : ''}:`, error);
    showNotification(`Error: ${error.message || error}`, 'error');
}

// === SETTINGS VALIDATION ===
function validateSettings() {
    const validActions = ['pipe', 'ytdl', 'stream', 'mpv', 'iptv', 'list'];
    const directions = [4, 8];

    // Validate action settings
    ['UP', 'DOWN', 'LEFT', 'RIGHT'].forEach(dir => {
        if (!validActions.includes(settings[dir])) {
            console.warn(`Invalid ${dir} action: ${settings[dir]}, resetting to default`);
            settings[dir] = DEFAULTS[dir];
            GM_setValue(dir, DEFAULTS[dir]);
        }
    });

    // Validate direction count
    if (!directions.includes(settings.total_direction)) {
        console.warn(`Invalid total_direction: ${settings.total_direction}, resetting to default`);
        settings.total_direction = DEFAULTS.total_direction;
        GM_setValue('total_direction', DEFAULTS.total_direction);
    }

    // Validate HLS domains
    if (!settings.hlsdomain || typeof settings.hlsdomain !== 'string') {
        console.warn('Invalid hlsdomain setting, resetting to default');
        settings.hlsdomain = DEFAULTS.hlsdomain;
        GM_setValue('hlsdomain', DEFAULTS.hlsdomain);
    }
    hlsdomainArray = settings.hlsdomain.split(',').filter(d => d.trim());
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

    console.log('Handlers Helper cleanup completed');
}

// Add cleanup on page unload
window.addEventListener('beforeunload', cleanup);

// === INITIALIZATION ===
function initialize() {
    try {
        // Validate settings first
        validateSettings();

        setupMenuCommands();
        attachDragHandler(document); // Use standard drag handler
        setupRightClickCollection();
        handleShadowRoots();
        setupYouTubeFeatures();

        console.log('Handlers Helper (Improved) initialized successfully');
        console.log('Settings validated and loaded');
    } catch (error) {
        console.error('Initialization failed:', error);
        handleError(error, 'initialization');
    }
}

// Start the script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
