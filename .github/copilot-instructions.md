# AI Coding Guidelines for userscript-improved

## Project Overview
This repository contains high-performance userscripts for enhancing web browsing experience. Each script is independent but follows consistent patterns for performance, reliability, and user experience.

## Architecture Patterns

### Core Components
- **URL Visit Tracker** (`URL-Visit-Tracker-Improved.user.js`): Tracks page visits with massive capacity (10K URLs) and performance optimizations
- **Handlers Helper** (`Handlers-Helper/Handlers-Helper-Improved.user.js`): Drag-to-action system for media links with protocol URL handling
- **Page Load Speed Monitor** (`page-load-speed.user.js`): Real-time performance monitoring with LCP tracking
- **External Integration**: Lua script (`protocol_hook.lua`) for MPV media player protocol handling

### Data Flow
- **Storage**: Tampermonkey API (`GM_getValue`/`GM_setValue`) for cross-session persistence
- **URL Processing**: Normalization pipeline (protocol removal, query cleaning, hash removal)
- **Event Handling**: MutationObserver for dynamic content, event delegation for performance
- **Protocol URLs**: Custom `mpv://` schemes for media player integration

## Development Patterns

### Performance Optimizations
```javascript
// Use WeakSet/Map for memory-efficient element tracking
let attachedElements = new WeakSet();

// Throttle expensive operations
let observerTimeout;
const observer = new MutationObserver(function (mutations) {
  if (observerTimeout) return;
  observerTimeout = setTimeout(() => processMutations(mutations), 100);
});

// Skip processing when tab hidden
if (document.hidden) return;
```

### Error Handling
```javascript
function safePrompt(message, defaultValue) {
  try {
    const result = window.prompt(message, defaultValue);
    return result === null ? null : result.trim();
  } catch (error) {
    debugError('Prompt error:', error);
    return null;
  }
}
```

### URL Processing
```javascript
function normalizeUrl(url) {
  // Remove protocol, www, trailing slash, hash
  let normalized = url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .split('#')[0];
  return normalized;
}
```

### Drag Interaction System
```javascript
// Direction calculation with configurable sensitivity
const DRAG_THRESHOLD = 50;
function getDirection(startX, startY, endX, endY) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  if (Math.abs(deltaX) < DRAG_THRESHOLD && Math.abs(deltaY) < DRAG_THRESHOLD) {
    return DirectionEnum.CENTER;
  }
  // 4 or 8 direction logic based on settings
}
```

## Code Quality Standards

### ESLint Configuration
- Strict rules enabled (no-debugger, no-console in production)
- ES2020+ features supported
- Global return allowed for userscript context

### Testing Commands
```bash
# Syntax validation
node -c "scripts/*.user.js"

# Line counting
wc -l scripts/*.user.js
```

### Menu System Pattern
```javascript
GM_registerMenuCommand('Command Name', function () {
  const value = safePrompt('Guide text', currentValue);
  if (value) {
    updateSetting('key', value);
    reloadPage();
  }
});
```

## Integration Points

### MPV Protocol Handler
- Custom URL schemes: `mpv://play/`, `mpv://ytdl/`, `mpv://stream/`
- Base64 URL encoding for special characters
- HLS domain detection for stream processing

### External Dependencies
- **MPV player**: Media playback with yt-dlp integration
- **streamlink**: Live stream processing
- **Tampermonkey/Greasemonkey**: Userscript runtime

## Key Files to Reference

### Core Logic
- `scripts/URL-Visit-Tracker-Improved.user.js`: Visit tracking with 10K URL capacity
- `scripts/Handlers-Helper/Handlers-Helper-Improved.user.js`: Drag system and protocol handling
- `scripts/Handlers-Helper/protocol_hook.lua`: MPV integration logic

### Configuration
- `.eslintrc.json`: Code quality rules
- `README.md`: Project documentation and installation

## Common Patterns

### Settings Management
```javascript
const DEFAULTS = { key: 'value' };
let settings = {
  key: GM_getValue('key', DEFAULTS.key)
};

function updateSetting(key, value) {
  settings[key] = value;
  GM_setValue(key, value);
}
```

### Debug Logging
```javascript
function debugLog(...args) {
  if (settings.debug) console.log(...args);
}
```

### Element Processing
```javascript
// Use querySelectorAll with caching
const links = document.querySelectorAll('a[href]:not([draggable="true"])');
links.forEach(link => link.draggable = true);
```

## Performance Considerations

### Memory Management
- Use `WeakSet` for element references to prevent leaks
- Clear collections on page unload
- Throttle DOM observers

### Event Optimization
- Event delegation over individual handlers
- Passive event listeners where appropriate
- Remove listeners on cleanup

### Polling Efficiency
- Adaptive polling based on activity
- Skip when tab hidden
- Configurable intervals

## Deployment

### Userscript Headers
```javascript
// ==UserScript==
// @name         Script Name
// @match        https://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==
```

### Version Management
- Semantic versioning (major.minor.patch)
- Update version in header and description
- Test across Tampermonkey, scriptcat, violentmonkey and Greasemonkey
<parameter name="filePath">/Users/pink-mb/github/userscript-improved/.github/copilot-instructions.md