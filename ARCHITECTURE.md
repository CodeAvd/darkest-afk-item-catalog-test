# Darkest AFK Item Catalog - Architecture Overview

## System Architecture (After Phase 0 Refactor)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│  (index.html - Grid, Filters, Compensation Panel, Modals)      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      EVENT LISTENERS                            │
│   (initializeEventListeners - Search, Click, Keyboard, etc.)   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      CENTRAL STATE                              │
│                                                                 │
│  const state = {                                                │
│    items: [],              // All catalog items                 │
│    filters: {                                                   │
│      search: '',                                                │
│      category: ''                                               │
│    },                                                           │
│    density: 'compact',                                          │
│    showRussian: false,                                          │
│    selectedItemIds: new Set(),                                  │
│    packageItems: new Map(),                                     │
│    ui: { ... }                                                  │
│  }                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                     MODULE LAYER                                │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Data Source │  │  Filtering   │  │  Selection   │         │
│  │              │  │              │  │   Logic      │         │
│  │ loadItems()  │  │applyFilters()│  │toggleItem()  │         │
│  │populateCats()│  │              │  │updateQty()   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │Grid Rendering│  │State Render  │  │Compensation  │         │
│  │              │  │              │  │    Panel     │         │
│  │ renderGrid() │  │renderLoading()│  │renderPanel() │         │
│  │createCard()  │  │renderEmpty() │  │renderJSON()  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────┐                                              │
│  │JSON/Presets  │                                              │
│  │              │                                              │
│  │generateJSON()│                                              │
│  │applyPreset() │                                              │
│  └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│  │ items.json  │     │ presets.js  │     │localStorage │      │
│  │             │     │             │     │             │      │
│  │ Item catalog│     │ Preset CRUD │     │ User prefs  │      │
│  └─────────────┘     └─────────────┘     └─────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Example: Selecting an Item

```
User clicks item card
    ↓
[Event Listener]
    ↓
toggleItemSelection(itemId)
    ↓
[Selection Logic Module]
    │
    ├→ state.selectedItemIds.add(itemId)
    │
    └→ state.packageItems.set(itemId, { item, quantity })
    ↓
[Rendering Modules]
    │
    ├→ renderGrid(filteredItems)  // Update card appearance
    │
    └→ renderCompensationPanel()  // Update detail panel
    ↓
[DOM Updated]
    │
    ├→ Card shows selected state (visual highlight)
    │
    └→ Panel shows item with quantity control + JSON
```

### Example: Searching for Items

```
User types in search input
    ↓
[Event Listener] (debounced 200ms)
    ↓
state.filters.search = inputValue
    ↓
applyFilters()
    ↓
[Filtering Module]
    │
    └→ Filter state.items by search term
    ↓
renderGrid(filteredItems)
    ↓
[Grid Rendering Module]
    │
    └→ Create card for each filtered item
    ↓
[DOM Updated]
    │
    └→ Grid shows only matching items
```

---

## State Management Patterns

### Reading State
```javascript
// ✅ Good - Read directly from state
if (state.selectedItemIds.has(itemId)) {
  // Item is selected
}

// ✅ Good - Use state for rendering
const displayName = state.showRussian && item.displayNameRu 
  ? item.displayNameRu 
  : item.displayName;
```

### Updating State
```javascript
// ✅ Good - Update state, then trigger render
state.selectedItemIds.add(itemId);
state.packageItems.set(itemId, { item, quantity });
renderGrid();
renderCompensationPanel();

// ❌ Bad - Don't mutate state without re-rendering
state.selectedItemIds.add(itemId); // Forgot to call render functions!
```

### State Isolation
```javascript
// ✅ Good - Each module reads what it needs
function renderGrid(filteredItems) {
  filteredItems.forEach(item => {
    if (state.selectedItemIds.has(item.id)) {
      // Render as selected
    }
  });
}

// ❌ Bad - Don't pass entire state
function renderGrid(state) { // Too coupled
  state.items.forEach(...);
}
```

---

## Module Responsibilities

### Data Source Module
**Purpose:** Load and prepare data  
**Reads:** Nothing initially  
**Writes:** `state.items`, `state.ui.loadingState`  
**Calls:** `populateCategories()`, `applyFilters()`  

### Filtering Module
**Purpose:** Filter items based on criteria  
**Reads:** `state.items`, `state.filters.search`, `state.filters.category`  
**Writes:** Nothing (pure function)  
**Calls:** `renderGrid()`  

### Selection Logic Module
**Purpose:** Manage item selection and quantities  
**Reads:** `state.items`, `state.packageItems`  
**Writes:** `state.selectedItemIds`, `state.packageItems`  
**Calls:** `renderGrid()`, `renderCompensationPanel()`  

### Grid Rendering Module
**Purpose:** Render item cards  
**Reads:** `state.selectedItemIds`, `state.showRussian`  
**Writes:** DOM only  
**Calls:** `createItemCard()`, `createFallbackIcon()`  

### Compensation Panel Module
**Purpose:** Show selected items and JSON  
**Reads:** `state.packageItems`, `state.showRussian`, `state.ui.jsonFormatPretty`  
**Writes:** DOM only  
**Calls:** `createQuantityControl()`, `renderJsonBlock()`  

### JSON/Presets Module
**Purpose:** Generate JSON and handle presets  
**Reads:** `state.packageItems`  
**Writes:** `state.selectedItemIds`, `state.packageItems` (when applying preset)  
**Calls:** `generateInitInfoJson()`, preset functions from `presets.js`  

---

## Rendering Strategy

### Granular Re-renders
Only re-render what changed:

```javascript
// Scenario: User changes quantity
function updateItemQuantity(itemId, quantity) {
  state.packageItems.get(itemId).quantity = quantity;
  
  // Only re-render compensation panel, NOT the grid
  renderCompensationPanel();
}

// Scenario: User toggles language
function toggleLanguage() {
  state.showRussian = !state.showRussian;
  
  // Re-render both grid (names change) and panel
  renderGrid();
  renderCompensationPanel();
}
```

### Full Re-renders
When filters change, re-render everything:

```javascript
function applyFilters() {
  const filtered = state.items.filter(...);
  
  // Full grid re-render with new filtered items
  renderGrid(filtered);
}
```

---

## Extension Points

### Adding New Filter
```javascript
// 1. Add to state
state.filters.rarity = new Set();

// 2. Update applyFilters()
function applyFilters() {
  const filtered = state.items.filter(item => {
    const matchesRarity = state.filters.rarity.size === 0 
      || state.filters.rarity.has(item.rarity);
    return matchesRarity && /* ... other filters */;
  });
  renderGrid(filtered);
}

// 3. Add UI controls in event listeners
dom.rarityFilter.addEventListener('change', () => {
  state.filters.rarity.add(value);
  applyFilters();
});
```

### Adding New Render Function
```javascript
// 1. Create render function
function renderSelectionBar() {
  const selectionBar = document.getElementById('selectionBar');
  selectionBar.textContent = `${state.selectedItemIds.size} items selected`;
}

// 2. Call from appropriate places
function toggleItemSelection(itemId) {
  // ... update state ...
  renderGrid();
  renderCompensationPanel();
  renderSelectionBar(); // New!
}
```

---

## Performance Considerations

### Efficient Data Structures
- `Set` for `selectedItemIds` - O(1) add/delete/has
- `Map` for `packageItems` - O(1) get/set/delete
- Array for `items` - Immutable after load

### Debouncing
```javascript
// Search input debounced to 200ms
const debouncedSearch = debounce(() => {
  state.filters.search = dom.searchInput.value.trim();
  applyFilters();
}, 200);
```

### Lazy Loading
```javascript
// Images loaded lazily
img.loading = "lazy";
```

### Minimal Re-renders
Only call render functions when state actually changes:
```javascript
// ✅ Good
if (newValue !== currentValue) {
  state.value = newValue;
  render();
}

// ❌ Bad - Always re-renders even if nothing changed
state.value = newValue;
render();
```

---

## Testing Strategy

### Unit Tests (Future)
```javascript
// Test pure functions
describe('applyFilters', () => {
  it('filters by search term', () => {
    state.items = [{ id: 'item_gold', displayName: 'Gold' }];
    state.filters.search = 'gold';
    const filtered = applyFilters();
    expect(filtered).toHaveLength(1);
  });
});
```

### Integration Tests (Future)
```javascript
// Test state updates + rendering
describe('toggleItemSelection', () => {
  it('updates state and re-renders', () => {
    toggleItemSelection('item_gold');
    expect(state.selectedItemIds.has('item_gold')).toBe(true);
    expect(dom.grid.querySelector('.selected')).toBeTruthy();
  });
});
```

### Manual Testing Checklist
- [ ] Load items.json successfully
- [ ] Search filters items
- [ ] Category filter works
- [ ] Selection toggles correctly
- [ ] Quantity controls work
- [ ] JSON generates correctly
- [ ] Language toggle works
- [ ] Presets load and apply
- [ ] All buttons and shortcuts work

---

## Common Patterns

### Adding State Property
```javascript
// 1. Add to state object
state.newProperty = initialValue;

// 2. Update relevant render functions to read it
function renderSomething() {
  if (state.newProperty) {
    // ...
  }
}

// 3. Add event listeners to update it
dom.control.addEventListener('change', () => {
  state.newProperty = newValue;
  renderSomething();
});
```

### Creating New Module
```javascript
// ============================================================================
// MODULE X: Module Name
// ============================================================================

/**
 * Module description
 */
function moduleFunction() {
  // Reads: state.x, state.y
  // Writes: state.z
  // Calls: renderX(), renderY()
}
```

### Error Handling
```javascript
try {
  const res = await fetch('data.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  state.data = await res.json();
  renderSuccess();
} catch (err) {
  console.error('Error:', err);
  state.ui.loadingState = 'error';
  renderError();
}
```

---

## Best Practices

1. **Always update state before rendering**
2. **Keep render functions pure** (given same state, produce same DOM)
3. **Use appropriate data structures** (Set for uniqueness, Map for key-value)
4. **Debounce expensive operations** (search, resize)
5. **Provide accessibility** (ARIA labels, keyboard navigation)
6. **Handle errors gracefully** (try/catch, fallbacks)
7. **Document state dependencies** (what each function reads/writes)
8. **Use semantic HTML** (proper elements, roles)

---

**Last Updated:** Phase 0 Refactor  
**Next:** Ready for Phase 1+ enhancements
