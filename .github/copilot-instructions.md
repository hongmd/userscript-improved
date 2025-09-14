# AI Coding Guidelines for userscript-improved

## Project Overview
This repository contains high-performance userscripts for enhancing web browsing experience. Each script is independent but follows consistent patterns for performance, reliability, and user experience.

## Architecture Patterns

### Core Components
- **URL Visit Tracker** (`URL-Visit-Tracker-Improved.user.js`): Tracks page visits with massive capacity (10K URLs) and performance optimizations
- **Handlers Helper** (`Handlers-Helper/Handlers-Helper-Improved.user.js`): Drag-to-action system for media links with protocol URL handling
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

## Security Considerations

### Userscript Security Best Practices
```javascript
// Avoid dangerous patterns
// ❌ DON'T DO THIS:
document.body.innerHTML = userInput; // XSS vulnerability
eval(userCode); // Code injection risk

// ✅ DO THIS INSTEAD:
const safeElement = document.createElement('div');
safeElement.textContent = userInput;
document.body.appendChild(safeElement);
```

### Input Validation
- **Sanitize user inputs** before processing
- **Validate URLs** before creating links or requests
- **Escape special characters** in dynamic content
- **Use Content Security Policy** headers when possible

### Storage Security
- **Encrypt sensitive data** before storing with GM_setValue
- **Validate stored data** on retrieval (JSON.parse safety)
- **Clear sensitive data** on script uninstall
- **Use secure random** for any cryptographic operations

### Network Security
- **Validate all URLs** before making requests
- **Use HTTPS-only** for external communications
- **Implement rate limiting** for API calls
- **Handle CORS properly** for cross-origin requests

## Troubleshooting Guide

### Common Issues & Solutions

**Script Not Loading:**
```javascript
// Check if userscript manager is enabled
console.log('Userscript environment:', typeof GM_getValue);

// Verify @match patterns
console.log('Current URL:', location.href);
console.log('Document readyState:', document.readyState);
```

**Storage Not Working:**
```javascript
// Test storage availability
try {
  GM_setValue('test', 'value');
  const result = GM_getValue('test');
  console.log('Storage test:', result === 'value' ? 'PASS' : 'FAIL');
} catch (error) {
  console.error('Storage error:', error);
}
```

**Performance Issues:**
```javascript
// Monitor memory usage
if (performance.memory) {
  console.log('Memory usage:', {
    used: performance.memory.usedJSHeapSize,
    total: performance.memory.totalJSHeapSize,
    limit: performance.memory.jsHeapSizeLimit
  });
}
```

**DOM Not Found:**
```javascript
// Wait for DOM readiness
function safeExecute() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
}
```

### Debug Commands
```bash
# Check syntax errors
node -c scripts/*.user.js

# Count lines per file
wc -l scripts/*.user.js

# Validate JSON files
python3 -m json.tool .eslintrc.json
```

## Performance Benchmarks

### Optimization Metrics

**URL Processing Performance:**
```javascript
// Benchmark URL normalization
const urls = ['https://example.com/path?query=1', 'http://www.test.com/', /* ... */];
console.time('URL Normalization');
urls.forEach(url => normalizeUrl(url));
console.timeEnd('URL Normalization');
// Expected: < 1ms per URL
```

**Memory Usage Tracking:**
```javascript
// Monitor cache size
function logMemoryStats() {
  const cacheSize = Object.keys(dbCache || {}).length;
  const memoryUsage = JSON.stringify(dbCache || {}).length;
  console.log(`Cache: ${cacheSize} items, ${Math.round(memoryUsage/1024)}KB`);
}
```

**Event Handler Efficiency:**
```javascript
// Measure event processing time
let eventCount = 0;
const startTime = performance.now();

function trackEvent() {
  eventCount++;
  if (eventCount % 100 === 0) {
    const avgTime = (performance.now() - startTime) / eventCount;
    console.log(`Avg event time: ${avgTime.toFixed(2)}ms`);
  }
}
```

### Performance Targets

- **Initial Load**: < 100ms
- **Memory Usage**: < 10MB for 10K URLs
- **Event Processing**: < 5ms per event
- **Storage Operations**: < 50ms for large datasets
- **DOM Queries**: < 10ms for complex selectors

## Migration Guides

### Breaking Changes Migration

**v2.0.0 - Storage Format Change:**
```javascript
// Old format (v1.x)
const oldData = GM_getValue('visits', {});

// New format (v2.x)
const newData = GM_getValue('visitDB', {});
if (oldData && Object.keys(oldData).length > 0) {
  // Migrate old data to new format
  const migrated = Object.entries(oldData).map(([url, data]) => ({
    [normalizeUrl(url)]: {
      count: data.count || 1,
      visits: data.visits || [Date.now()]
    }
  }));
  GM_setValue('visitDB', Object.assign({}, ...migrated));
}
```

**v1.5.0 - URL Normalization Update:**
```javascript
// Before: Basic normalization
function oldNormalize(url) {
  return url.replace(/^https?:\/\//, '');
}

// After: Advanced normalization
function newNormalize(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .split('#')[0];
}
```

### Feature Migration Examples

**Adding Multi-Tab Support:**
```javascript
// Check if multi-tab is enabled
if (CONFIG.MULTI_TAB?.ENABLED) {
  // Add cache invalidation
  window.addEventListener('storage', (e) => {
    if (e.key === 'visitDB') {
      invalidateCache();
    }
  });
}
```

**Implementing Adaptive Polling:**
```javascript
// Old: Fixed interval
setInterval(pollFunction, 5000);

// New: Adaptive polling
function startAdaptivePolling() {
  const interval = activityCount > 0 ? 
    Math.max(2000, CONFIG.POLL_INTERVAL / 2) : 
    CONFIG.POLL_INTERVAL * 2;
  setTimeout(startAdaptivePolling, interval);
}
```

## Testing Strategies

### Unit Testing Patterns
```javascript
// Test utility functions
function testNormalizeUrl() {
  const tests = [
    { input: 'https://example.com/', expected: 'example.com' },
    { input: 'http://www.test.com/path?q=1', expected: 'test.com/path?q=1' }
  ];
  
  tests.forEach(({ input, expected }) => {
    const result = normalizeUrl(input);
    console.assert(result === expected, `Expected ${expected}, got ${result}`);
  });
}
```

### Integration Testing
```javascript
// Test storage operations
function testStorage() {
  const testData = { test: 'value' };
  
  // Test write
  GM_setValue('test_key', testData);
  
  // Test read
  const readData = GM_getValue('test_key');
  console.assert(JSON.stringify(readData) === JSON.stringify(testData), 'Storage test failed');
  
  // Cleanup
  GM_deleteValue('test_key');
}
```

### Performance Testing
```javascript
// Benchmark function execution
function benchmark(func, iterations = 1000) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    func();
  }
  const end = performance.now();
  return (end - start) / iterations;
}

// Usage
const avgTime = benchmark(() => normalizeUrl('https://example.com/test'));
console.log(`Average execution time: ${avgTime.toFixed(4)}ms`);
```