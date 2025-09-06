# Userscript Improved

A collection of improved userscripts for better web browsing experience.

## 🚀 Featured Scripts

### 📊 URL Visit Tracker (Improved) - v1.7
**File:** `scripts/URL-Visit-Tracker-Improved.user.js`

Track your website visits with a powerful, performance-optimized userscript that shows real-time statistics and provides comprehensive visit history management.

#### ✨ Key Features
- **🔢 Visit Counter Badge** - Floating badge showing visit count for current page
- **📈 Real-time Statistics** - Track total visits across all websites  
- **🕒 Visit History** - Detailed timestamp history for each URL
- **💾 Data Management** - Export/Import visit data as JSON
- **🗑️ Selective Clearing** - Clear current page or all data
- **🖱️ Link Hover Info** - Hover over links to see visit history
- **⚡ Performance Optimized** - Minimal CPU/memory footprint
- **🛡️ Security Enhanced** - XSS protection and safe DOM operations

#### 🎯 How It Works
1. **Automatic Tracking**: Counts every page visit automatically
2. **Smart URL Detection**: Handles SPA navigation and URL changes  
3. **Persistent Storage**: Data saved using Greasemonkey API
4. **Visual Feedback**: Corner badge with visit count and hover tooltips

#### 📱 User Interface
- **Corner Badge**: Shows visit count (e.g., "Visit: 15")
- **Hover Tooltip**: Displays visit history when hovering badge
- **Menu Commands**: Right-click userscript manager icon for options:
  - 📊 Export Data
  - 📥 Import Data  
  - 📈 Show Statistics
  - 🗑️ Clear Current Page
  - 💥 Clear All Data

#### ⚙️ Configuration
Edit the `CONFIG` object in the script to customize:
```javascript
const CONFIG = {
  MAX_VISITS_STORED: 20,    // Max visit timestamps to keep
  HOVER_DELAY: 200,         // Hover delay in ms
  POLL_INTERVAL: 2000,      // URL change detection interval
  BADGE_POSITION: { right: '14px', bottom: '14px' }
};
```

---

### 🔗 Other Scripts
- `Gdrive-direct-download.user.js` - Direct download for Google Drive files
- `Handlers-Helper-Improved.user.js` - Enhanced protocol handler management
- `page-load-speed.user.js` - Page loading performance metrics
- `Reject-ServiceWorker-Auto.user.js` - Automatic service worker blocking
- `visited-improved.user.js` - Enhanced visited link tracking

## 📥 Installation

### Prerequisites
Install a userscript manager:
- **[Tampermonkey](https://tampermonkey.net/)** (Chrome, Firefox, Safari, Edge)
- **[Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)** (Firefox)
- **[Violentmonkey](https://violentmonkey.github.io/)** (Cross-platform)

### Install Scripts
1. Browse to the script file in the `scripts/` directory
2. Click **"Raw"** button on GitHub
3. Your userscript manager will automatically detect and offer installation
4. Click **"Install"** to confirm

### Alternative Installation
1. Copy script content from GitHub
2. Open your userscript manager dashboard
3. Create new script and paste content
4. Save and enable

## 🛠️ Development

### Testing
```bash
# Check syntax
node -c "scripts/URL-Visit-Tracker-Improved.user.js"

# Count lines
wc -l scripts/*.user.js
```

### File Structure
```
userscript-improved/
├── scripts/              # All userscripts
├── README.md            # This file
├── IMPROVEMENTS.md      # Detailed changelog
└── SCRIPTCAT_GUIDE.md   # ScriptCat installation guide
```

## 📊 Statistics
- **Total Scripts**: 6
- **Latest Version**: URL Visit Tracker v1.7
- **Performance**: Optimized for minimal resource usage
- **Compatibility**: Modern browsers with userscript manager support

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Contribution Guidelines
- Follow existing code style and patterns
- Add comments for complex logic
- Test thoroughly before submitting
- Update README.md if adding new features

## 📄 License

This project is open source. See individual script headers for specific licensing information.

## 🔗 Links
- **Issues**: [Report bugs or request features](../../issues)
- **Discussions**: [Community discussions](../../discussions)
- **Releases**: [Version history](../../releases)
