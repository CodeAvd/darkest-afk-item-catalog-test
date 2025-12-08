# Phase 0 - Prep & Refactor Documentation

## Completed: Centralized State & Modular Architecture

### Overview
Refactored `docs/script.js` from 845 lines of scattered state and functions into a clean, modular architecture with centralized state management.

---

## Central State Object

All application state is now stored in a single `state` object:

```javascript
const state = {
  // Data
  items: [],                    // Full catalog of all items
  
  // Filters
  filters: {
    search: '',                 // Search query
    category: '',               // Selected category
  },
  
  // View
  density: 'compact',           // 'compact' | 'visual'
  showRussian: false,           // Show Russian labels
  
  // Selection
  selectedItemIds: new Set(),   // Currently selected item IDs in grid
  packageItems: new Map(),      // itemId -> { item, quantity } for compensation package
  
  // UI
  ui: {
    jsonFormatPretty: true,     // JSON format toggle (pretty vs minified)
    loadingState: 'idle',       // 'idle' | 'loading' | 'error' | 'success'
    helpOpen: false,            // Help modal state
    presetModalOpen: false,     // Preset save modal state
  }
};
```

**Key improvements:**
- Single source of truth for all state
- Easier to debug (inspect `state` object in console)
- Clear separation of concerns (data, filters, view, selection, UI)
- Uses appropriate data structures (Set for IDs, Map for item+quantity pairs)

---

## Module Organization

The refactored code is organized into 7 clear modules:

### Module 1: Data Source
**Files:** Lines 94-136  
**Functions:**
- `loadItems()` - Fetch and load items from JSON
- `populateCategories()` - Build category dropdown

**Responsibilities:**
- Loading items from `items.json`
- Populating filter dropdowns
- Managing loading states

### Module 2: Filtering & Search
**Files:** Lines 138-166  
**Functions:**
- `applyFilters()` - Apply search and category filters

**Responsibilities:**
- Filter items by search term
- Filter items by category
- Trigger grid re-render with filtered results

### Module 3: Selection Logic
**Files:** Lines 168-203  
**Functions:**
- `toggleItemSelection(itemId)` - Toggle item selection
- `clearSelection()` - Clear all selections
- `updateItemQuantity(itemId, quantity)` - Update quantity

**Responsibilities:**
- Manage item selection state
- Maintain packageItems map with quantities
- Coordinate grid and panel re-renders

### Module 4: Rendering - Grid
**Files:** Lines 205-289  
**Functions:**
- `renderGrid(filteredItems)` - Render item cards
- `createItemCard(item)` - Create single card element
- `createFallbackIcon(text)` - Fallback when image missing

**Responsibilities:**
- Render the item grid
- Create individual item cards
- Handle card interactions (click, keyboard)
- Show selection state visually

### Module 5: Rendering - Loading/Empty/Error States
**Files:** Lines 291-332  
**Functions:**
- `renderLoadingSkeleton()` - Show loading skeleton
- `renderEmptyState()` - Show empty state
- `renderErrorState()` - Show error state

**Responsibilities:**
- Loading state (skeleton cards)
- Empty state (no items found)
- Error state (failed to load)

### Module 6: Rendering - Compensation Package Panel
**Files:** Lines 334-479  
**Functions:**
- `renderCompensationPanel()` - Main panel render
- `createQuantityControl(itemId, displayName, currentQty)` - Quantity stepper
- `renderJsonBlock(selectedItems)` - JSON code block
- `renderCompensationPanelActions(selectedItems)` - Action buttons

**Responsibilities:**
- Display selected items with quantities
- Render quantity steppers (+ / - buttons)
- Show formatted JSON output
- Provide actions (Copy JSON, Save Preset, Copy IDs, Clear)

### Module 7: JSON Generation & Presets
**Files:** Lines 481-549  
**Functions:**
- `generateInitInfoJson(selectedItems)` - Build init_info structure
- `checkForPresetToApply()` - Check sessionStorage
- `applyPresetToSelection(preset)` - Apply preset to state

**Responsibilities:**
- Generate `init_info` JSON structure
- Handle preset loading from presets page
- Apply presets to current selection

---

## Centralized Rendering Functions

### 1. Grid Rendering
**Function:** `renderGrid(filteredItems)`  
**Called by:** `applyFilters()`, `toggleItemSelection()`  
**Updates:** Item grid with current filtered/selected state

### 2. Compensation Panel Rendering
**Function:** `renderCompensationPanel()`  
**Called by:** `toggleItemSelection()`, `updateItemQuantity()`, language toggle  
**Updates:** Selected items list, JSON block, action buttons

### 3. Loading/Error States
**Functions:** `renderLoadingSkeleton()`, `renderEmptyState()`, `renderErrorState()`  
**Called by:** `loadItems()`, `renderGrid()`  
**Updates:** UI state indicators

---

## Key Architectural Improvements

### Before:
- State scattered across multiple variables
- Functions mixed together without clear organization
- Quantity management split between `customQuantities` Map and item objects
- Hard to understand data flow

### After:
- **Single state object** with clear structure
- **7 clearly defined modules** with specific responsibilities
- **Separation of concerns**: data loading, filtering, selection, rendering, JSON generation
- **Reusable rendering functions** that can be called from anywhere
- **Better data structures**: 
  - `selectedItemIds` (Set) for selection state
  - `packageItems` (Map) for item + quantity pairs
- **Clear event handling** in dedicated `initializeEventListeners()` function

---

## State Flow Diagram

```
User Action (click, type, toggle)
    ↓
Event Listener
    ↓
Update State Object
    ↓
Call Appropriate Render Function(s)
    ↓
DOM Updated
```

**Example: Selecting an item**
```
User clicks item card
    ↓
toggleItemSelection(itemId)
    ↓
Updates state.selectedItemIds (Set)
Updates state.packageItems (Map)
    ↓
Calls renderGrid() + renderCompensationPanel()
    ↓
Grid shows selection visually
Panel shows item + quantity controls + JSON
```

---

## Benefits for Future Development

1. **Easy to extend**: Add new features by adding new state properties and render functions
2. **Easy to debug**: Single state object to inspect
3. **Easy to test**: Pure functions that take state and return DOM
4. **Easy to maintain**: Clear module boundaries
5. **Performance**: Centralized state prevents redundant re-renders
6. **Future-proof**: Ready for state management library (Redux, Zustand) if needed

---

## Next Steps (Beyond Phase 0)

Ready for:
- Advanced filtering (rarity, grade, attributes)
- Sorting options
- Multiple view densities (ultra, compact, comfortable, list)
- Bulk operations
- Undo/redo
- Keyboard shortcuts enhancements
- Drag & drop
- Multi-select

All can be added by:
1. Adding state properties
2. Creating new render functions
3. Updating existing render functions to read new state

---

## Files Modified

- ✅ `docs/script.js` - Complete refactor with centralized state
- ✅ `PHASE_0_REFACTOR_NOTES.md` - This documentation

## Files Not Modified

- `docs/presets.js` - Already well-structured module
- `docs/styles.css` - No changes needed
- `docs/index.html` - No changes needed
- `docs/items.html` - Separate page, can be refactored separately
- `docs/presets.html` - Separate page with inline script

---

## Testing Checklist

- [ ] Items load on page load
- [ ] Search filters items correctly
- [ ] Category filter works
- [ ] Item selection toggles correctly
- [ ] Quantity steppers work (increase, decrease, manual input)
- [ ] JSON generates correctly
- [ ] Copy JSON button works
- [ ] Save Preset button works
- [ ] Language toggle switches names
- [ ] Density toggle works (Visual/Compact)
- [ ] Keyboard shortcuts work (Ctrl+F, Escape, ?)
- [ ] Preset loading from presets page works
- [ ] All buttons and interactions work as before
