# Darkest AFK - Item Catalog

An internal support tool for managing game items and resources in Darkest AFK. This tool helps support managers quickly find and copy item codes when processing player requests.

## ✨ Features

### Core Functionality
- **Visual Item Catalog**: Browse 112+ game items in a responsive grid layout
- **Multi-Selection**: Click items to build compensation packages with multiple items
- **Search & Filter**: Find items by name, code, or category with real-time filtering
- **Bilingual Support**: Toggle between English and Russian labels instantly
- **JSON Generation**: Auto-generate init_info JSON structures for compensation packages
- **Custom Quantities**: Adjust item quantities individually with inline controls
- **Copy to Clipboard**: One-click copy for item codes or complete JSON packages

### New in v2.0
- **⌨️ Keyboard Shortcuts**: Full keyboard navigation (Ctrl+F, Ctrl+A, Esc, etc.)
- **☑️ Bulk Actions**: Select All / Deselect All buttons for quick multi-selection
- **📖 Help Modal**: Built-in keyboard shortcuts guide (press `?`)
- **⚡ Loading Skeleton**: Smooth loading states with animated placeholders
- **♿ Enhanced Accessibility**: Skip links, ARIA labels, improved focus indicators
- **🎨 UX Polish**: Better empty states, smoother transitions, improved feedback

### Responsive Design
Works seamlessly on desktop, tablet, and mobile devices with touch-friendly controls.

## Files

- `index.html` - Main catalog page with detail panel and featured items showcase
- `items.html` - Simple list view of all items
- `styles.css` - Shared stylesheet with design tokens
- `script.js` - JavaScript for index.html functionality
- `items.json` - Item data (extendable JSON format)
- `images/` - Directory containing item images

## 🚀 Quick Start

### Basic Usage
1. Open `index.html` in a modern web browser
2. Use the search bar to find items by name or code
3. Filter by category using the dropdown
4. Click items to select them (checkmark badge appears)
5. View generated JSON in the right panel
6. Click "Copy init_info JSON" to copy the compensation package
7. Toggle Russian labels if needed

### Keyboard Shortcuts
- `Ctrl/Cmd + F` - Focus search input
- `Ctrl/Cmd + A` - Select all visible items
- `Esc` - Clear selection or search
- `Tab` - Navigate between elements
- `Enter` / `Space` - Select/deselect focused item
- `?` - Show keyboard shortcuts help

### Bulk Actions
- Click "Select All (X)" to select all currently visible items
- Click "Deselect All" to clear all selections
- Adjust quantities using the number inputs in the detail panel

## Featured Items

The `index.html` page now includes a featured items showcase section displaying popular game items:
- **Class Summon Scroll** (Классовый свиток) - `items_hero_summon_scroll_class`
- **Blazing Meteorite** (Пылающий метеорит) - `item_meteorite`
- **Magic Beans** (Магические бобы) - `item_magic_bean`
- **Magic Seeds** (Магические семена) - `item_magic_seed`
- **Stardust** (Звездная пыль) - `item_stardust`

These images are displayed prominently at the top of the catalog for quick reference.

## Adding New Items

Edit `items.json` and add new items following this structure:

```json
{
  "id": "item_code_here",
  "displayName": "English Name",
  "displayNameRu": "Russian Name",
  "category": "Category Name",
  "image": "images/item_code_here.png",
  "defaultQuantity": 1,
  "codeSnippet": "{\n  \"type\": \"ITEM\",\n  \"item_name\": \"item_code_here\",\n  \"quantity\": 1\n}"
}
```

### Adding Item Images

1. Save your item images in the `images/` directory
2. Use PNG format for best compatibility
3. Recommended image size: 64x64 to 128x128 pixels
4. Reference the image in `items.json` using the path `images/your_item_name.png`
5. The current placeholder images can be replaced with actual game assets

## 📚 Additional Documentation

- **[IMPROVEMENTS.md](IMPROVEMENTS.md)** - Comprehensive list of v2.0 enhancements
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Original implementation details
- **[QUICK_FIX.md](QUICK_FIX.md)** - Troubleshooting guide for image display issues

## 🛠️ Technical Details

### Architecture
- **Pure vanilla JavaScript** (no frameworks or dependencies)
- **Static HTML/CSS/JS** (no build step or compilation required)
- **Responsive grid layout** (CSS Grid with mobile-first approach)
- **IIFE pattern** for script encapsulation
- **Strict mode** enabled for better error catching

### Code Quality
- JSDoc comments on all major functions
- Modular function design (small, single-purpose functions)
- Consistent error handling with user-friendly feedback
- Semantic HTML with proper ARIA attributes

### Performance
- Local data (no server calls after initial JSON load)
- Lazy loading for images (`loading="lazy"`)
- Efficient DOM manipulation with minimal reflows
- Instant filtering and search (no debouncing needed)

## 🌐 Browser Support

**Minimum Requirements:**
- Chrome 90+ / Edge 90+
- Firefox 88+
- Safari 14+

**Required Browser Features:**
- ES6+ JavaScript (arrow functions, Map, Set, destructuring)
- CSS Grid and Flexbox
- Fetch API
- Clipboard API (with legacy fallback for older browsers)

**Tested On:**
- Chrome 120 (macOS, Windows)
- Firefox 121 (Windows)
- Safari 17 (macOS)
- Edge 120 (Windows)

## License

Internal tool for Darkest AFK support team.

