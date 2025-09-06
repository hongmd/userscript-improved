# Userscript Improved

A collection of high-performance userscripts for enhanced web browsing experience with advanced tracking and optimization features.

## 🚀 Featured Scripts

### 📊 URL Visit Tracker (Improved) - v1.9.9
**File:** `scripts/URL-Visit-Tracker-Improved.user.js`

An advanced, storage-optimized userscript that intelligently tracks website visits with smart data management and performance enhancements.

#### ✨ Latest Features (v1.9.9)
- **�️ Toggle Badge Visibility** - Click badge or use menu to hide/show with smooth animations
- **🎯 Position Configuration** - Customizable badge position via CONFIG.BADGE_POSITION
- **🚫 No Duplicate Menus** - Fixed menu registration to prevent duplicates
- **�️ Smooth Tooltip Movement** - RequestAnimationFrame for buttery smooth mouse tracking
- **🔧 Enhanced Performance** - Optimized animations and reduced CPU usage

#### 🎯 Core Features
- **🔢 Visit Counter Badge** - Floating badge with toggleable visibility and smooth transitions
- **📈 Real-time Statistics** - Track total visits across all websites with database management
- **🕒 Smart History** - Optimized timestamp storage with hover tooltips
- **💾 Data Export** - Export visit data as JSON with comprehensive error handling
- **🗑️ Intelligent Clearing** - Clear current page or all data with instant UI updates
- **🖱️ Link Hover Info** - Smooth tooltip with visit history and formatted timestamps
- **⚙️ Configurable Interface** - Customizable badge position and visibility settings

---

### 📁 Google Drive Direct Download - Latest
**File:** `scripts/Gdrive-direct-download.user.js`

Automatically converts Google Drive share links to direct download links, bypassing the preview page for faster file downloads.

#### Features:
- **🔗 Direct Download** - Skip Google Drive preview pages
- **⚡ Fast Access** - Instant file downloads without extra clicks
- **�️ Safe Operation** - Works with public Google Drive links
- **🎯 Auto-Detection** - Automatically processes Google Drive URLs

---

### � Handlers Helper (Improved) - Latest  
**File:** `scripts/Handlers-Helper-Improved.user.js`

Enhanced protocol handler management with improved compatibility and user experience.

#### Features:
- **📱 Protocol Management** - Better handling of custom protocols
- **🔄 Improved Compatibility** - Works across different browsers and websites
- **⚙️ Enhanced Configuration** - More flexible handler setup options
- **🛡️ Error Handling** - Robust error management for edge cases

---

### ⏱️ Page Load Speed Monitor - Latest
**File:** `scripts/page-load-speed.user.js`

Real-time page loading performance metrics and monitoring for web development and optimization.

#### Features:
- **� Performance Metrics** - Real-time load time measurement
- **⚡ Speed Analysis** - Detailed breakdown of loading phases
- **📈 Visual Indicators** - Clear performance visualization
- **🔍 Debug Information** - Helpful data for web optimization

---

### 🚫 Service Worker Auto Reject - Latest
**File:** `scripts/Reject-ServiceWorker-Auto.user.js`

Automatically blocks service worker registration to prevent unwanted background processes and improve browser performance.

#### Features:
- **🛡️ Auto Blocking** - Automatic service worker prevention
- **⚡ Performance Boost** - Reduced background processes
- **🔧 Configurable** - Customizable blocking rules
- **📱 Universal** - Works across all HTTPS websites

---

### �️ Visited Links (Improved) - Latest
**File:** `scripts/visited-improved.user.js`

Enhanced visited link tracking and visualization with improved performance and user experience.

#### Features:
- **🎨 Visual Enhancement** - Better visited link styling
- **📊 Advanced Tracking** - Improved visit detection algorithms
- **⚡ Performance Optimized** - Efficient link state management
- **🔧 Customizable** - Flexible configuration options

## 📥 Installation

### Prerequisites
Install a userscript manager:
- **[Tampermonkey](https://tampermonkey.net/)** (Chrome, Firefox, Safari, Edge) - Recommended
- **[Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)** (Firefox)
- **[Violentmonkey](https://violentmonkey.github.io/)** (Cross-platform)

### Quick Install
1. **Browse** to `scripts/URL-Visit-Tracker-Improved.user.js`
2. Click **"Raw"** button on GitHub
3. Your userscript manager will **auto-detect** and offer installation
4. Click **"Install"** to confirm and start tracking!

### Manual Installation
1. **Copy** script content from GitHub
2. **Open** your userscript manager dashboard  
3. **Create** new script and paste content
4. **Save** and enable to activate

### ⚠️ Important Notes
- Requires `@grant GM_getValue`, `@grant GM_setValue` permissions
- Works on HTTPS sites only (security requirement)
- Data is stored locally in your browser via Greasemonkey API

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
- **Total Scripts**: 6 userscripts for enhanced web browsing
- **Featured Script**: URL Visit Tracker v1.9.9 (Advanced tracking with toggle features)
- **Performance**: Optimized for speed with smooth animations and RAF movement
- **Compatibility**: Modern browsers with userscript manager support
- **Database Management**: Smart cleanup with configurable badge visibility

## 🔧 Recent Improvements (v1.9.9)

### User Interface Enhancements
- **Toggle Badge Visibility**: Click badge or use menu command to hide/show
- **Smooth Animations**: Improved transitions with scale effects and opacity
- **Configurable Position**: BADGE_POSITION now properly applied from CONFIG
- **No Menu Duplicates**: Fixed registerMenu() to prevent duplicate menu items

### Performance & Animation Optimizations  
- **RequestAnimationFrame**: Smooth tooltip movement using RAF for 60fps
- **Optimized Event Handling**: Reduced CPU usage with smart batching
- **Memory Management**: Proper cleanup of animation frames and pending operations
- **Production Ready**: Enhanced error handling and edge case protection

### Code Quality & Maintenance
- **Clean Menu System**: Static menu registration prevents Tampermonkey/Violentmonkey issues
- **Metadata Complete**: Added homepage, updateURL, supportURL for proper distribution
- **Modern JavaScript**: ES6+ features with backward compatibility
- **Zero Memory Leaks**: Proper cleanup of all event listeners and animations

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Contribution Guidelines
- Follow existing code style and patterns
- Add comprehensive error handling for edge cases
- Optimize for performance and storage efficiency
- Test thoroughly with syntax validation (`node -c script.js`)
- Update README.md and version numbers for new features
- Consider storage optimization and memory management

## 📄 License

This project is open source. See individual script headers for specific licensing information.

## 🔗 Links
- **Issues**: [Report bugs or request features](../../issues)
- **Discussions**: [Community discussions](../../discussions)  
- **Releases**: [Version history](../../releases)

## 📝 Changelog

### v1.9.9 (Latest) - UI/UX & Performance
- ✅ Toggle badge visibility (click or menu)
- ✅ Smooth animations with requestAnimationFrame  
- ✅ Fixed menu duplication issues
- ✅ Configurable badge positioning
- ✅ Enhanced tooltip movement performance

### v1.9.8 - Menu System Fix
- ✅ Resolved duplicate menu registration
- ✅ Static menu items for stability
- ✅ Improved error handling

### v1.9.7 - Animation & Positioning
- ✅ Badge toggle functionality
- ✅ BADGE_POSITION configuration support
- ✅ Smooth visibility transitions

### v1.9.3 - Storage Optimization
- ✅ Timestamp compression (50% storage reduction)
- ✅ Smart auto-cleanup with priority scoring
- ✅ Enhanced URL normalization
- ✅ Production-ready error handling

**See [IMPROVEMENTS.md](IMPROVEMENTS.md) for detailed changelog.**

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### What this means:
- ✅ **Free to use** - Personal and commercial use allowed
- ✅ **Modify freely** - Change code to fit your needs
- ✅ **Distribute** - Share with others or publish modifications
- ✅ **No warranty** - Use at your own risk
- ⚠️ **Keep copyright** - Include original license notice

---

**⭐ Star this repo if these userscripts help improve your browsing experience!**
