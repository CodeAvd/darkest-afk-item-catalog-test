# Darkest AFK - Item Catalog

An internal support tool for managing game items and resources in Darkest AFK. This tool helps support managers quickly find and copy item codes when processing player requests.

## Features

- **Visual Item Catalog**: Browse all game items in a responsive grid layout
- **Search & Filter**: Find items by name, code, or category
- **Bilingual Support**: Toggle between English and Russian labels
- **Quick Copy**: Click any item to copy its internal code to clipboard
- **JSON Templates**: View and copy ready-to-use JSON snippets for admin panel
- **Responsive Design**: Works on desktop and mobile devices

## Files

- `index.html` - Main catalog page with detail panel
- `items.html` - Simple list view of all items
- `styles.css` - Shared stylesheet with design tokens
- `script.js` - JavaScript for index.html functionality
- `items.json` - Item data (extendable JSON format)

## Usage

1. Open `index.html` or `items.html` in a web browser
2. Use the search bar to find items by name or code
3. Filter by category using the dropdown
4. Click any item card to copy its code or view JSON snippet
5. Toggle Russian labels if needed

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

## Technical Details

- Pure vanilla JavaScript (no frameworks)
- Static HTML/CSS/JS (no build step required)
- Responsive grid layout (mobile-first)
- Accessible with ARIA labels and keyboard navigation

## Browser Support

Works in all modern browsers that support:
- ES6 JavaScript
- CSS Grid
- Fetch API
- Clipboard API

## License

Internal tool for Darkest AFK support team.

