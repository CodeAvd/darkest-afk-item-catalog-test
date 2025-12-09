/**
 * Darkest AFK Item Catalog - Main Script (Refactored Phase 0)
 * Internal support tool for managing game items and generating compensation packages
 * 
 * Architecture:
 * - Central state object for all application state
 * - Modular rendering functions
 * - Clear separation of concerns: data loading, filtering, selection, rendering, JSON generation
 */

import { createPreset } from './presets.js';

"use strict";

// ============================================================================
// CENTRAL STATE
// ============================================================================

const state = {
  // Data
  items: [],                    // Full catalog of all items
  
  // Filters
  filters: {
    search: '',                 // Search query
    category: '',               // Selected category
    rarities: new Set(),        // 'common' | 'rare' | 'epic' | 'legendary'
    grades: new Set(),          // Item grades (numbers or strings)
    attributes: {
      atkMin: null,
      atkMax: null,
      defMin: null,
      defMax: null,
    },
  },
  
  // Sorting
  sort: {
    field: 'name',              // 'name' | 'code' | 'category' | 'rarity' | 'grade'
    direction: 'asc',           // 'asc' | 'desc'
  },
  
  // View
  density: 'compact',           // 'ultra' | 'compact' | 'comfortable' | 'list'
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

// Filter metadata (populated after items load)
let filterMeta = {
  categories: new Map(),
  rarities: new Map(),
  grades: new Map(),
};

// Selection state for shift+click range selection
let lastClickedIndex = null;

// ============================================================================
// DOM REFERENCES
// ============================================================================

const dom = {
  // Grid
  grid: document.getElementById("grid"),
  loadingSkeleton: document.getElementById("loadingSkeleton"),
  emptyState: document.getElementById("emptyState"),
  errorState: document.getElementById("errorState"),
  
  // Filters
  searchInput: document.getElementById("searchInput"),
  categoryFilter: document.getElementById("categoryFilter"),
  filtersSidebar: document.getElementById("filters-sidebar"),
  activeFilters: document.getElementById("active-filters"),
  
  // Sorting
  sortField: document.getElementById("sort-field"),
  sortDirection: document.getElementById("sort-direction"),
  
  // Detail panel (compensation package)
  detailContent: document.getElementById("detailContent"),
  
  // Density toggle
  densityUltra: document.getElementById("densityUltra"),
  densityCompact: document.getElementById("densityCompact"),
  densityComfortable: document.getElementById("densityComfortable"),
  densityList: document.getElementById("densityList"),
  
  // Language toggle
  langToggle: document.getElementById("langToggle"),
  
  // Modals
  helpBtn: document.getElementById("helpBtn"),
  helpModal: document.getElementById("helpModal"),
  closeHelpBtn: document.getElementById("closeHelpBtn"),
  presetModal: document.getElementById("presetModal"),
  presetForm: document.getElementById("presetForm"),
  closePresetModal: document.getElementById("closePresetModal"),
  
  // Toast
  toast: document.getElementById("toast"),
  
  // Selection bar
  selectionBar: document.getElementById("selection-bar"),
};

// ============================================================================
// MODULE 1: DATA SOURCE (Items loading)
// ============================================================================

/**
 * Load items from JSON file
 */
async function loadItems() {
  state.ui.loadingState = 'loading';
  renderLoadingSkeleton();
  
  try {
    const res = await fetch("items.json");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to load items.json`);
    }
    
    const data = await res.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Invalid or empty items data");
    }
    
    state.items = data;
    state.ui.loadingState = 'success';
    
    // Build filter metadata for advanced filters
    filterMeta = buildFilterMetadata(state.items);
    
    populateCategories();
    renderFiltersSidebar();
    rerenderEverything();
    checkForPresetToApply();
    
  } catch (err) {
    console.error("Failed to load items:", err);
    state.ui.loadingState = 'error';
    renderErrorState();
    showToast("Failed to load items");
  }
}

/**
 * Populate category dropdown with unique categories from items
 */
function populateCategories() {
  const categories = Array.from(
    new Set(state.items.map((item) => item.category).filter(Boolean))
  ).sort();
  
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    dom.categoryFilter.appendChild(opt);
  });
}

/**
 * Build filter metadata (counts for each filter value)
 * @param {Array} items - Array of items
 */
function buildFilterMetadata(items) {
  const categories = new Map();
  const rarities = new Map();
  const grades = new Map();

  for (const item of items) {
    // Count categories
    if (item.category) {
      categories.set(item.category, (categories.get(item.category) || 0) + 1);
    }
    
    // Count rarities
    if (item.rarity) {
      rarities.set(item.rarity, (rarities.get(item.rarity) || 0) + 1);
    }
    
    // Count grades
    if (item.grade != null) {
      const gradeStr = String(item.grade);
      grades.set(gradeStr, (grades.get(gradeStr) || 0) + 1);
    }
  }

  return { categories, rarities, grades };
}

// ============================================================================
// MODULE 2: SORTING
// ============================================================================

/**
 * Get sort order value for rarity
 * @param {string} rarity - Rarity value
 * @returns {number} Sort order
 */
function rarityOrder(rarity) {
  const map = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
  };
  return map[rarity?.toLowerCase()] ?? 0;
}

/**
 * Sort items based on current sort state
 * @param {Array} items - Items to sort
 * @returns {Array} Sorted items (new array)
 */
function sortItems(items) {
  const { field, direction } = state.sort;
  const factor = direction === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    let va;
    let vb;

    switch (field) {
      case 'name':
        va = (a.displayName || a.name || '').toLowerCase();
        vb = (b.displayName || b.name || '').toLowerCase();
        break;
      case 'code':
        va = (a.id || a.code || '').toLowerCase();
        vb = (b.id || b.code || '').toLowerCase();
        break;
      case 'category':
        va = (a.category || '').toLowerCase();
        vb = (b.category || '').toLowerCase();
        break;
      case 'rarity':
        va = rarityOrder(a.rarity);
        vb = rarityOrder(b.rarity);
        break;
      case 'grade':
        va = a.grade ?? 0;
        vb = b.grade ?? 0;
        break;
      default:
        return 0;
    }

    if (va < vb) return -1 * factor;
    if (va > vb) return 1 * factor;
    return 0;
  });
}

// ============================================================================
// MODULE 3: FILTERING & SEARCH
// ============================================================================

/**
 * Apply all filters to items and return filtered array
 * @returns {Array} Filtered items
 */
function applyFilters() {
  const { search, category, rarities, grades, attributes } = state.filters;
  const searchTerm = search.trim().toLowerCase();

  return state.items.filter(item => {
    // Category filter
    if (category && item.category !== category) return false;

    // Rarity filter
    if (rarities.size && !rarities.has(item.rarity)) return false;

    // Grade filter
    if (grades.size && !grades.has(String(item.grade))) return false;

    // Attribute filters
    if (attributes.atkMin != null && (item.atk == null || item.atk < attributes.atkMin)) return false;
    if (attributes.atkMax != null && (item.atk == null || item.atk > attributes.atkMax)) return false;
    if (attributes.defMin != null && (item.def == null || item.def < attributes.defMin)) return false;
    if (attributes.defMax != null && (item.def == null || item.def > attributes.defMax)) return false;

    // Search filter
    if (searchTerm) {
      const haystack = [
        item.id,
        item.displayName,
        item.displayNameRu,
        item.category
      ].filter(Boolean).join(' ').toLowerCase();
      
      if (!haystack.includes(searchTerm)) return false;
    }

    return true;
  });
}

// ============================================================================
// MODULE 3: SELECTION LOGIC (Phase 4 Enhanced)
// ============================================================================

/**
 * Toggle item selection state (does NOT modify package)
 * Selection is just a "focus set" - use bulk actions to add to package
 * @param {string} itemId - Item ID to toggle
 */
function toggleItemSelection(itemId) {
  if (state.selectedItemIds.has(itemId)) {
    state.selectedItemIds.delete(itemId);
  } else {
    state.selectedItemIds.add(itemId);
  }
  rerenderEverything();
}

/**
 * Clear all selections
 */
function clearSelection() {
  state.selectedItemIds.clear();
  lastClickedIndex = null;
  rerenderEverything();
  showToast("Selection cleared");
}

/**
 * Update quantity for an item in the package
 * @param {string} itemId - Item ID
 * @param {number} quantity - New quantity
 */
function updateItemQuantity(itemId, quantity) {
  const packageItem = state.packageItems.get(itemId);
  if (packageItem) {
    packageItem.quantity = Math.max(1, Math.min(999999, quantity));
    state.packageItems.set(itemId, packageItem);
    renderCompensationPanel();
  }
}

/**
 * Get currently visible items (filtered + sorted)
 * @returns {Array} Visible items
 */
function getVisibleItems() {
  const filtered = applyFilters();
  const sorted = sortItems(filtered);
  return sorted;
}

/**
 * Select all currently visible items
 */
function selectAllVisible() {
  const items = getVisibleItems();
  state.selectedItemIds.clear();
  for (const item of items) {
    state.selectedItemIds.add(item.id);
  }
  rerenderEverything();
  showToast(`Selected ${items.length} visible items`);
}

/**
 * Select range of items (for shift+click)
 * @param {number} fromIndex - Start index
 * @param {number} toIndex - End index
 */
function selectRange(fromIndex, toIndex) {
  const items = getVisibleItems();
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  
  for (let i = start; i <= end; i++) {
    const item = items[i];
    if (!item) continue;
    state.selectedItemIds.add(item.id);
  }
  rerenderEverything();
}

/**
 * Move selected items to package
 * @param {Object} options - Options
 * @param {string} options.mode - 'increment' or 'replace'
 */
function moveSelectedToPackage({ mode = 'increment' } = {}) {
  let count = 0;
  
  for (const id of state.selectedItemIds) {
    const item = state.items.find(i => i.id === id);
    if (!item) continue;
    
    const existing = state.packageItems.get(id);
    
    if (mode === 'replace') {
      state.packageItems.set(id, {
        item,
        quantity: 1
      });
    } else {
      const newQuantity = (existing?.quantity ?? 0) + 1;
      state.packageItems.set(id, {
        item,
        quantity: newQuantity
      });
    }
    count++;
  }
  
  rerenderEverything();
  showToast(`Added ${count} item${count !== 1 ? 's' : ''} to package`);
}

/**
 * Remove selected items from package
 */
function removeSelectedFromPackage() {
  let count = 0;
  
  for (const id of state.selectedItemIds) {
    if (state.packageItems.has(id)) {
      state.packageItems.delete(id);
      count++;
    }
  }
  
  rerenderEverything();
  showToast(`Removed ${count} item${count !== 1 ? 's' : ''} from package`);
}

// ============================================================================
// MODULE 4: RENDERING - GRID
// ============================================================================

/**
 * Render the item grid based on filtered items
 * @param {Array} filteredItems - Array of items to render
 */
function renderGrid(filteredItems) {
  dom.grid.innerHTML = "";
  dom.grid.hidden = false;
  dom.loadingSkeleton.hidden = true;
  dom.errorState.hidden = true;
  
  // Apply density class to grid
  dom.grid.classList.remove('density-ultra', 'density-compact', 'density-comfortable', 'density-list');
  dom.grid.classList.add(`density-${state.density}`);
  
  if (!filteredItems.length) {
    renderEmptyState();
    return;
  }
  
  dom.emptyState.hidden = true;
  
  filteredItems.forEach((item, index) => {
    const card = createItemCard(item, index);
    dom.grid.appendChild(card);
  });
}

/**
 * Create an item card element
 * @param {Object} item - Item data object
 * @param {number} index - Index in current filtered/sorted array
 * @returns {HTMLDivElement} - Card element
 */
function createItemCard(item, index) {
  const card = document.createElement("div");
  card.className = "card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-pressed", state.selectedItemIds.has(item.id) ? "true" : "false");
  card.dataset.id = item.id;
  card.dataset.index = String(index);
  
  if (state.selectedItemIds.has(item.id)) {
    card.classList.add("selected");
  }
  
  // Enhanced click handler with shift+click support
  card.addEventListener("click", (event) => onCardClick(event, item, index));
  
  // Keyboard handlers
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleItemSelection(item.id);
      lastClickedIndex = index;
    }
  });

  // Image with fallback
  const img = document.createElement("img");
  img.src = item.image || "";
  img.alt = item.displayName || item.id;
  img.loading = "lazy";
  img.onerror = () => {
    img.replaceWith(createFallbackIcon(item.id));
  };

  // Display name with quick copy button
  const nameContainer = document.createElement("div");
  nameContainer.className = "name-container";
  nameContainer.style.display = "flex";
  nameContainer.style.alignItems = "center";
  nameContainer.style.justifyContent = "space-between";
  nameContainer.style.gap = "4px";
  
  const name = document.createElement("div");
  name.className = "name";
  const displayName = state.showRussian && item.displayNameRu 
    ? item.displayNameRu 
    : item.displayName || item.id;
  name.textContent = displayName;
  name.setAttribute("title", displayName);
  name.style.flex = "1";
  name.style.minWidth = "0";
  
  // Quick copy button
  const quickCopyBtn = document.createElement("button");
  quickCopyBtn.className = "quick-copy-btn";
  quickCopyBtn.type = "button";
  quickCopyBtn.textContent = "📋";
  quickCopyBtn.title = "Copy JSON for this item";
  quickCopyBtn.setAttribute("aria-label", `Copy JSON for ${displayName}`);
  quickCopyBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    quickCopyItemJson(item, quickCopyBtn);
  });
  
  nameContainer.append(name, quickCopyBtn);

  // Secondary name (opposite language)
  const nameRu = document.createElement("div");
  nameRu.className = "name-ru";
  if (state.showRussian && item.displayName) {
    nameRu.textContent = item.displayName;
  } else if (!state.showRussian && item.displayNameRu) {
    nameRu.textContent = item.displayNameRu;
  }

  // Item code
  const code = document.createElement("div");
  code.className = "code";
  code.textContent = item.id;
  code.setAttribute("title", item.id);

  card.append(img, nameContainer);
  if (nameRu.textContent) card.appendChild(nameRu);
  card.appendChild(code);
  
  return card;
}

/**
 * Handle card click with modifier keys support
 * @param {MouseEvent} event - Click event
 * @param {Object} item - Item data
 * @param {number} index - Item index
 */
function onCardClick(event, item, index) {
  const id = item.id;
  
  // Ctrl/Cmd => toggle single
  if (event.ctrlKey || event.metaKey) {
    toggleItemSelection(id);
    lastClickedIndex = index;
    return;
  }
  
  // Shift => range select
  if (event.shiftKey && lastClickedIndex != null) {
    selectRange(lastClickedIndex, index);
    lastClickedIndex = index;
    return;
  }
  
  // Normal click: toggle
  toggleItemSelection(id);
  lastClickedIndex = index;
}

/**
 * Quick copy single item JSON
 * @param {Object} item - Item to copy
 * @param {HTMLElement} btn - Button element for visual feedback
 */
function quickCopyItemJson(item, btn) {
  const payload = {
    init_info: {
      type: "COMMON",
      title: "To our dearest hero",
      message: "We apologize for the inconvenience you have encountered. Here is the compensation pack for you.",
      rewards: {
        rewards_list: [{
          type: "ITEM",
          item_name: item.id,
          quantity: item.defaultQuantity ?? 1
        }]
      }
    }
  };
  
  const text = state.ui.jsonFormatPretty
    ? JSON.stringify(payload, null, 2)
    : JSON.stringify(payload);
  
  copyText(text).then(() => {
    // Visual feedback
    const originalText = btn.textContent;
    btn.textContent = "✓";
    btn.classList.add("copied");
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove("copied");
    }, 1500);
    
    showToast(`Copied JSON for "${item.displayName || item.id}"`);
  });
}

/**
 * Create fallback icon element when image fails to load
 * @param {string} text - Text to display in fallback
 * @returns {HTMLDivElement} - Fallback icon element
 */
function createFallbackIcon(text) {
  const div = document.createElement("div");
  div.style.cssText = `
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
    background: #0b0d12;
    border: 1px solid var(--border);
    border-radius: 10px;
    color: #9aa1b5;
    font-size: 10px;
    text-align: center;
    padding: 6px;
    word-break: break-all;
  `;
  div.textContent = text.substring(0, 12);
  div.setAttribute("aria-label", `Image not available for ${text}`);
  return div;
}

// ============================================================================
// MODULE 5: RENDERING - LOADING/EMPTY/ERROR STATES
// ============================================================================

/**
 * Show loading skeleton (12 placeholder cards)
 */
function renderLoadingSkeleton() {
  dom.loadingSkeleton.hidden = false;
  dom.loadingSkeleton.innerHTML = "";
  dom.grid.hidden = true;
  dom.emptyState.hidden = true;
  dom.errorState.hidden = true;
  
  // Generate 12 skeleton cards
  for (let i = 0; i < 12; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton-card";
    skeleton.innerHTML = `
      <div class="skeleton-image"></div>
      <div class="skeleton-text long"></div>
      <div class="skeleton-text short"></div>
      <div class="skeleton-text long"></div>
    `;
    dom.loadingSkeleton.appendChild(skeleton);
  }
}

/**
 * Render empty state when no items match filters
 */
function renderEmptyState() {
  dom.emptyState.innerHTML = `
    <div class="empty-icon">📦</div>
    <p>No items found matching your filters.</p>
    <p class="cta-text">Try adjusting your search or clearing filters.</p>
  `;
  dom.emptyState.hidden = false;
  dom.grid.hidden = true;
}

/**
 * Render error state when items fail to load
 */
function renderErrorState() {
  dom.loadingSkeleton.hidden = true;
  dom.errorState.hidden = false;
  dom.grid.hidden = true;
}

// ============================================================================
// MODULE 6: RENDERING - COMPENSATION PACKAGE PANEL
// ============================================================================

/**
 * Render the compensation package detail panel
 * Shows selected items, quantities, and generated JSON
 */
function renderCompensationPanel() {
  dom.detailContent.innerHTML = "";

  // Check packageItems, not selectedItemIds (Phase 4: selection ≠ package)
  if (state.packageItems.size === 0) {
    const placeholder = document.createElement("p");
    placeholder.textContent = "No items in package. Select items and click 'Add to package'.";
    placeholder.style.color = "var(--muted)";
    dom.detailContent.appendChild(placeholder);
    return;
  }

  // Get items from packageItems map
  const selectedItems = Array.from(state.packageItems.values());

  // Selection counter badge
  const counter = document.createElement("div");
  counter.className = "selection-counter";
  counter.setAttribute("aria-live", "polite");
  counter.innerHTML = `
    Selected: <span class="count">${selectedItems.length}</span> ${selectedItems.length === 1 ? 'item' : 'items'}
  `;
  dom.detailContent.appendChild(counter);

  // Show items list with quantity controls (steppers)
  const itemsList = document.createElement("div");
  itemsList.style.marginBottom = "12px";
  itemsList.style.fontSize = "13px";
  itemsList.className = "selected-items-list";
  
  selectedItems.forEach(({ item, quantity }) => {
    const itemRow = document.createElement("div");
    itemRow.className = "selected-item-row";
    
    const displayName = state.showRussian && item.displayNameRu 
      ? item.displayNameRu 
      : item.displayName || item.id;
    
    const nameSpan = document.createElement("span");
    nameSpan.textContent = displayName;
    nameSpan.style.flex = "1";
    nameSpan.style.color = "#f5f7fa";
    
    const qtyControl = createQuantityControl(item.id, displayName, quantity);
    
    itemRow.append(nameSpan, qtyControl);
    itemsList.appendChild(itemRow);
  });
  dom.detailContent.appendChild(itemsList);

  // Build and render JSON
  renderJsonBlock(selectedItems);
  
  // Render action buttons
  renderCompensationPanelActions(selectedItems);
}

/**
 * Create quantity control (stepper) for an item
 * @param {string} itemId - Item ID
 * @param {string} displayName - Display name for accessibility
 * @param {number} currentQty - Current quantity
 * @returns {HTMLDivElement} - Quantity control element
 */
function createQuantityControl(itemId, displayName, currentQty) {
  const qtyControl = document.createElement("div");
  qtyControl.className = "quantity-control";
  
  // Decrease button
  const decreaseBtn = document.createElement("button");
  decreaseBtn.type = "button";
  decreaseBtn.textContent = "−";
  decreaseBtn.className = "qty-btn";
  decreaseBtn.setAttribute("aria-label", `Decrease quantity for ${displayName}`);
  decreaseBtn.disabled = currentQty <= 1;
  decreaseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    updateItemQuantity(itemId, currentQty - 1);
  });
  
  // Input field
  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.min = "1";
  qtyInput.max = "999999";
  qtyInput.value = currentQty;
  qtyInput.className = "qty-input";
  qtyInput.setAttribute("aria-label", `Quantity for ${displayName}`);
  
  qtyInput.addEventListener("change", (e) => {
    let newQty = parseInt(e.target.value) || 1;
    newQty = Math.max(1, Math.min(999999, newQty));
    e.target.value = newQty;
    updateItemQuantity(itemId, newQty);
  });
  
  // Increase button
  const increaseBtn = document.createElement("button");
  increaseBtn.type = "button";
  increaseBtn.textContent = "+";
  increaseBtn.className = "qty-btn";
  increaseBtn.setAttribute("aria-label", `Increase quantity for ${displayName}`);
  increaseBtn.disabled = currentQty >= 999999;
  increaseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    updateItemQuantity(itemId, currentQty + 1);
  });
  
  qtyControl.append(decreaseBtn, qtyInput, increaseBtn);
  return qtyControl;
}

/**
 * Render JSON code block with format toggle
 * @param {Array} selectedItems - Array of {item, quantity}
 */
function renderJsonBlock(selectedItems) {
  // Build init_info structure
  const initInfo = {
    init_info: {
      type: "COMMON",
      title: "To our dearest hero",
      message: "We apologize for the inconvenience you have encountered. Here is the compensation pack for you.",
      rewards: {
        rewards_list: selectedItems.map(({ item, quantity }) => ({
          type: "ITEM",
          item_name: item.id,
          quantity: quantity
        }))
      }
    }
  };

  // JSON code block with wrapper
  const codeBlockWrapper = document.createElement("div");
  codeBlockWrapper.className = "code-block-wrapper";
  
  // Header with format toggle
  const codeBlockHeader = document.createElement("div");
  codeBlockHeader.className = "code-block-header";
  
  const label = document.createElement("div");
  label.className = "label";
  label.textContent = "init_info JSON";
  
  const formatToggle = document.createElement("div");
  formatToggle.className = "json-format-toggle";
  
  const prettyBtn = document.createElement("button");
  prettyBtn.type = "button";
  prettyBtn.textContent = "Pretty";
  prettyBtn.className = state.ui.jsonFormatPretty ? "active" : "";
  prettyBtn.addEventListener("click", () => {
    state.ui.jsonFormatPretty = true;
    renderCompensationPanel();
  });
  
  const minifiedBtn = document.createElement("button");
  minifiedBtn.type = "button";
  minifiedBtn.textContent = "Minified";
  minifiedBtn.className = !state.ui.jsonFormatPretty ? "active" : "";
  minifiedBtn.addEventListener("click", () => {
    state.ui.jsonFormatPretty = false;
    renderCompensationPanel();
  });
  
  formatToggle.append(prettyBtn, minifiedBtn);
  codeBlockHeader.append(label, formatToggle);
  
  // Code block
  const codeBlock = document.createElement("pre");
  codeBlock.className = "code-block";
  const jsonString = state.ui.jsonFormatPretty 
    ? JSON.stringify(initInfo, null, 2)
    : JSON.stringify(initInfo);
  codeBlock.innerHTML = syntaxHighlight(jsonString);
  
  codeBlockWrapper.append(codeBlockHeader, codeBlock);
  dom.detailContent.appendChild(codeBlockWrapper);
}

/**
 * Render action buttons for compensation panel
 * @param {Array} selectedItems - Array of {item, quantity}
 */
function renderCompensationPanelActions(selectedItems) {
  const actions = document.createElement("div");
  actions.className = "actions";
  
  // Copy JSON button (primary)
  const copyJsonBtn = document.createElement("button");
  copyJsonBtn.type = "button";
  copyJsonBtn.className = "btn-primary";
  copyJsonBtn.textContent = "Copy JSON";
  copyJsonBtn.setAttribute("aria-label", "Copy init_info JSON to clipboard");
  copyJsonBtn.addEventListener("click", () => {
    const initInfo = generateInitInfoJson(selectedItems);
    const jsonStr = state.ui.jsonFormatPretty 
      ? JSON.stringify(initInfo, null, 2)
      : JSON.stringify(initInfo);
    copyText(jsonStr).then(() => {
      showToast("JSON copied to clipboard");
    }).catch(() => {
      showToast("Failed to copy JSON");
    });
  });
  
  // Save Preset button (primary)
  const savePresetBtn = document.createElement("button");
  savePresetBtn.type = "button";
  savePresetBtn.className = "btn-primary";
  savePresetBtn.textContent = "💾 Save Preset";
  savePresetBtn.setAttribute("aria-label", "Save current selection as preset");
  savePresetBtn.addEventListener("click", () => {
    openPresetModal();
  });
  
  // Copy IDs button (secondary)
  const copyIdsBtn = document.createElement("button");
  copyIdsBtn.type = "button";
  copyIdsBtn.className = "btn-secondary";
  copyIdsBtn.textContent = "Copy IDs";
  copyIdsBtn.setAttribute("aria-label", "Copy item IDs to clipboard");
  copyIdsBtn.addEventListener("click", () => {
    const ids = selectedItems.map(({ item }) => item.id).join(", ");
    copyText(ids).then(() => {
      showToast("Item IDs copied to clipboard");
    }).catch(() => {
      showToast("Failed to copy IDs");
    });
  });
  
  // Clear button (tertiary)
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn-tertiary";
  clearBtn.textContent = "Clear selection";
  clearBtn.setAttribute("aria-label", "Clear all selected items");
  clearBtn.addEventListener("click", clearSelection);
  
  actions.append(copyJsonBtn, savePresetBtn, copyIdsBtn, clearBtn);
  dom.detailContent.appendChild(actions);
}

// ============================================================================
// MODULE 7: RENDERING - FILTERS SIDEBAR & CHIPS
// ============================================================================

/**
 * Render the filters sidebar with all filter options
 */
function renderFiltersSidebar() {
  if (!dom.filtersSidebar) return;

  const { categories, rarities, grades } = filterMeta;

  // Build category section
  const categoryOptions = [...categories.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => `
      <label class="filter-checkbox">
        <input type="checkbox" data-filter-type="category" value="${value}"
          ${state.filters.category === value ? 'checked' : ''}>
        <span>${value}</span> <span class="count">(${count})</span>
      </label>
    `).join('');

  // Build rarity section
  const rarityOptions = [...rarities.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => `
      <label class="filter-checkbox">
        <input type="checkbox" data-filter-type="rarity" value="${value}"
          ${state.filters.rarities.has(value) ? 'checked' : ''}>
        <span class="rarity-${value.toLowerCase()}">${value}</span> <span class="count">(${count})</span>
      </label>
    `).join('');

  // Build grade section
  const gradeOptions = [...grades.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([value, count]) => `
      <label class="filter-checkbox">
        <input type="checkbox" data-filter-type="grade" value="${value}"
          ${state.filters.grades.has(value) ? 'checked' : ''}>
        <span>Grade ${value}</span> <span class="count">(${count})</span>
      </label>
    `).join('');

  dom.filtersSidebar.innerHTML = `
    <div class="filters-header">
      <h2 class="section-title">Filters</h2>
      <button id="btn-clear-filters" class="btn-text" type="button">Clear all</button>
    </div>

    ${categoryOptions ? `
      <section class="filter-section">
        <h3 class="filter-section-title">Category</h3>
        <div class="filter-options">
          ${categoryOptions}
        </div>
      </section>
    ` : ''}

    ${rarityOptions ? `
      <section class="filter-section">
        <h3 class="filter-section-title">Rarity</h3>
        <div class="filter-options">
          ${rarityOptions}
        </div>
      </section>
    ` : ''}

    ${gradeOptions ? `
      <section class="filter-section">
        <h3 class="filter-section-title">Grade</h3>
        <div class="filter-options">
          ${gradeOptions}
        </div>
      </section>
    ` : ''}

    <section class="filter-section">
      <h3 class="filter-section-title">Attributes</h3>
      <div class="attribute-filters">
        <div class="attribute-range">
          <label>Attack</label>
          <div class="range-inputs">
            <input type="number" id="atk-min" placeholder="Min" min="0" 
              value="${state.filters.attributes.atkMin ?? ''}" />
            <span>–</span>
            <input type="number" id="atk-max" placeholder="Max" min="0" 
              value="${state.filters.attributes.atkMax ?? ''}" />
          </div>
        </div>
        <div class="attribute-range">
          <label>Defense</label>
          <div class="range-inputs">
            <input type="number" id="def-min" placeholder="Min" min="0" 
              value="${state.filters.attributes.defMin ?? ''}" />
            <span>–</span>
            <input type="number" id="def-max" placeholder="Max" min="0" 
              value="${state.filters.attributes.defMax ?? ''}" />
          </div>
        </div>
      </div>
    </section>
  `;

  attachFilterSidebarHandlers();
}

/**
 * Attach event handlers to filter sidebar elements
 */
function attachFilterSidebarHandlers() {
  if (!dom.filtersSidebar) return;

  // Checkbox handlers
  dom.filtersSidebar.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', () => {
      const type = input.dataset.filterType;
      const value = input.value;

      if (type === 'category') {
        // Single category selection (radio-like behavior)
        state.filters.category = input.checked ? value : '';
        // Uncheck other category checkboxes
        dom.filtersSidebar.querySelectorAll('input[data-filter-type="category"]').forEach(cb => {
          if (cb !== input) cb.checked = false;
        });
      } else if (type === 'rarity') {
        const set = state.filters.rarities;
        input.checked ? set.add(value) : set.delete(value);
      } else if (type === 'grade') {
        const set = state.filters.grades;
        input.checked ? set.add(value) : set.delete(value);
      }

      rerenderEverything();
    });
  });

  // Attribute range handlers
  const atkMin = document.getElementById('atk-min');
  const atkMax = document.getElementById('atk-max');
  const defMin = document.getElementById('def-min');
  const defMax = document.getElementById('def-max');

  const handleAttributeChange = debounce(() => {
    state.filters.attributes.atkMin = atkMin?.value ? Number(atkMin.value) : null;
    state.filters.attributes.atkMax = atkMax?.value ? Number(atkMax.value) : null;
    state.filters.attributes.defMin = defMin?.value ? Number(defMin.value) : null;
    state.filters.attributes.defMax = defMax?.value ? Number(defMax.value) : null;
    rerenderEverything();
  }, 500);

  [atkMin, atkMax, defMin, defMax].forEach(input => {
    if (input) input.addEventListener('input', handleAttributeChange);
  });

  // Clear all button
  const clearBtn = dom.filtersSidebar.querySelector('#btn-clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.filters.search = '';
      state.filters.category = '';
      state.filters.rarities.clear();
      state.filters.grades.clear();
      Object.assign(state.filters.attributes, {
        atkMin: null, atkMax: null, defMin: null, defMax: null
      });
      dom.searchInput.value = '';
      rerenderEverything();
    });
  }
}

/**
 * Render active filter chips below the header
 */
function renderActiveFilterChips() {
  if (!dom.activeFilters) return;

  const chips = [];

  // Category chip
  if (state.filters.category) {
    chips.push({ 
      type: 'category', 
      value: state.filters.category, 
      label: state.filters.category 
    });
  }

  // Rarity chips
  state.filters.rarities.forEach(r => {
    chips.push({ 
      type: 'rarity', 
      value: r, 
      label: `Rarity: ${r}` 
    });
  });

  // Grade chips
  state.filters.grades.forEach(g => {
    chips.push({ 
      type: 'grade', 
      value: g, 
      label: `Grade ${g}` 
    });
  });

  // Attribute chips
  const { atkMin, atkMax, defMin, defMax } = state.filters.attributes;
  if (atkMin != null || atkMax != null) {
    const label = atkMin != null && atkMax != null 
      ? `ATK: ${atkMin}–${atkMax}`
      : atkMin != null ? `ATK ≥ ${atkMin}` : `ATK ≤ ${atkMax}`;
    chips.push({ type: 'atk', value: 'atk', label });
  }
  if (defMin != null || defMax != null) {
    const label = defMin != null && defMax != null 
      ? `DEF: ${defMin}–${defMax}`
      : defMin != null ? `DEF ≥ ${defMin}` : `DEF ≤ ${defMax}`;
    chips.push({ type: 'def', value: 'def', label });
  }

  // Render chips
  if (!chips.length) {
    dom.activeFilters.innerHTML = '';
    dom.activeFilters.hidden = true;
    return;
  }

  dom.activeFilters.hidden = false;
  dom.activeFilters.innerHTML = chips.map(c => `
    <button class="filter-chip" data-type="${c.type}" data-value="${c.value}" type="button">
      ${c.label} <span class="chip-close">✕</span>
    </button>
  `).join('');

  // Attach chip remove handlers
  dom.activeFilters.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const { type, value } = btn.dataset;
      
      if (type === 'category') {
        state.filters.category = '';
      } else if (type === 'rarity') {
        state.filters.rarities.delete(value);
      } else if (type === 'grade') {
        state.filters.grades.delete(value);
      } else if (type === 'atk') {
        state.filters.attributes.atkMin = null;
        state.filters.attributes.atkMax = null;
      } else if (type === 'def') {
        state.filters.attributes.defMin = null;
        state.filters.attributes.defMax = null;
      }
      
      rerenderEverything();
    });
  });
}

/**
 * Re-render everything after state change
 * Central render function called after any filter/selection/sort change
 */
function rerenderEverything() {
  const filtered = applyFilters();
  const sorted = sortItems(filtered);
  
  renderActiveFilterChips();
  renderGrid(sorted);
  renderCompensationPanel();
  renderSelectionBar();  // Phase 4: Selection bar
  
  // Update filter sidebar checkboxes to match state
  if (dom.filtersSidebar) {
    renderFiltersSidebar();
  }
}

/**
 * Render selection bar (Phase 4 - Bulk Operations)
 */
function renderSelectionBar() {
  if (!dom.selectionBar) return;
  
  const count = state.selectedItemIds.size;
  
  if (!count) {
    dom.selectionBar.classList.remove('active');
    dom.selectionBar.innerHTML = '';
    return;
  }
  
  dom.selectionBar.classList.add('active');
  dom.selectionBar.innerHTML = `
    <div class="selection-bar-left">
      <span class="selection-bar-count">${count} item${count > 1 ? 's' : ''} selected</span>
      <span class="selection-bar-hint">Use filters/sorting, then add to package</span>
    </div>
    <div class="selection-bar-actions">
      <button id="sb-add-to-package" class="btn btn-primary" type="button">Add to package</button>
      <button id="sb-remove-from-package" class="btn btn-secondary" type="button">Remove from package</button>
      <button id="sb-clear-selection" class="btn btn-tertiary" type="button">Clear selection</button>
    </div>
  `;
  
  // Attach event handlers
  const addBtn = document.getElementById('sb-add-to-package');
  const removeBtn = document.getElementById('sb-remove-from-package');
  const clearBtn = document.getElementById('sb-clear-selection');
  
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      moveSelectedToPackage();
    });
  }
  
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      removeSelectedFromPackage();
    });
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearSelection();
    });
  }
}

// ============================================================================
// MODULE 8: JSON GENERATION & PRESETS
// ============================================================================

/**
 * Generate init_info JSON structure from selected items
 * @param {Array} selectedItems - Array of {item, quantity}
 * @returns {Object} - init_info JSON structure
 */
function generateInitInfoJson(selectedItems) {
  return {
    init_info: {
      type: "COMMON",
      title: "To our dearest hero",
      message: "We apologize for the inconvenience you have encountered. Here is the compensation pack for you.",
      rewards: {
        rewards_list: selectedItems.map(({ item, quantity }) => ({
          type: "ITEM",
          item_name: item.id,
          quantity: quantity
        }))
      }
    }
  };
}

/**
 * Check for preset to apply from sessionStorage
 */
function checkForPresetToApply() {
  const presetData = sessionStorage.getItem('applyPreset');
  if (presetData) {
    sessionStorage.removeItem('applyPreset');
    try {
      const preset = JSON.parse(presetData);
      applyPresetToSelection(preset);
      showToast(`Applied preset: ${preset.name}`);
    } catch (err) {
      console.error('Failed to apply preset:', err);
    }
  }
  
  // Check for preset to edit
  const editData = sessionStorage.getItem('editPreset');
  if (editData) {
    sessionStorage.removeItem('editPreset');
    try {
      const preset = JSON.parse(editData);
      applyPresetToSelection(preset);
      showToast(`Editing preset: ${preset.name}`);
    } catch (err) {
      console.error('Failed to edit preset:', err);
    }
  }
}

/**
 * Apply preset to current selection
 * @param {Object} preset - Preset object
 */
function applyPresetToSelection(preset) {
  // Clear current selection
  state.selectedItemIds.clear();
  state.packageItems.clear();

  // Apply preset items
  preset.items.forEach(presetItem => {
    const item = state.items.find(i => i.id === presetItem.itemId);
    if (item) {
      state.selectedItemIds.add(presetItem.itemId);
      state.packageItems.set(presetItem.itemId, {
        item: item,
        quantity: presetItem.quantity || 1
      });
    }
  });

  console.log('Applied preset:', preset.name);
    console.log('Selected IDs:', Array.from(state.selectedItemIds));
    console.log('Package items:', Array.from(state.packageItems.entries()));

    const filtered = applyFilters();
    renderGrid(filtered);
    renderCompensationPanel();
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Syntax highlighting for JSON
 * @param {string} json - JSON string to highlight
 * @returns {string} - Highlighted HTML
 */
function syntaxHighlight(json) {
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

/**
 * Copy text to clipboard with fallback for older browsers
 * @param {string} text - Text to copy
 * @returns {Promise} Promise that resolves when copy succeeds
 */
async function copyText(text) {
  if (!text) return Promise.resolve();
  
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    return Promise.resolve();
  } catch (err) {
    console.error("Copy failed:", err);
    return Promise.reject(err);
  }
}

/**
 * Debounce function for search input
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

let toastTimer;
/**
 * Show toast notification with auto-dismiss
 * @param {string} msg - Message to display
 */
function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.hidden = false;
  dom.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.classList.remove("show");
    setTimeout(() => {
      dom.toast.hidden = true;
    }, 180); // Wait for fade-out transition
  }, 1600);
}

// ============================================================================
// SORT CONTROLS
// ============================================================================

/**
 * Load persisted sort preferences from localStorage
 */
function loadPersistedSort() {
  try {
    const raw = localStorage.getItem('dafk.sort');
    if (!raw) return;
    const stored = JSON.parse(raw);
    if (stored.field) state.sort.field = stored.field;
    if (stored.direction) state.sort.direction = stored.direction;
  } catch (e) {
    console.error('Failed to load sort preferences:', e);
  }
}

/**
 * Save sort preferences to localStorage
 */
function savePersistedSort() {
  try {
    localStorage.setItem('dafk.sort', JSON.stringify(state.sort));
  } catch (e) {
    console.error('Failed to save sort preferences:', e);
  }
}

/**
 * Update sort direction button UI
 * @param {HTMLButtonElement} btn - Sort direction button
 */
function updateSortDirectionButton(btn) {
  if (!btn) return;
  const isAsc = state.sort.direction === 'asc';
  btn.textContent = isAsc ? '↑' : '↓';
  btn.setAttribute('aria-label', isAsc ? 'Sort ascending' : 'Sort descending');
  btn.classList.toggle('sort-direction-active', !isAsc);
}

/**
 * Initialize sort controls
 */
function initSortControls() {
  if (!dom.sortField || !dom.sortDirection) return;

  // Sync UI with state
  dom.sortField.value = state.sort.field;
  updateSortDirectionButton(dom.sortDirection);

  // Sort field change
  dom.sortField.addEventListener('change', () => {
    state.sort.field = dom.sortField.value;
    savePersistedSort();
    rerenderEverything();
  });

  // Sort direction toggle
  dom.sortDirection.addEventListener('click', () => {
    state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
    updateSortDirectionButton(dom.sortDirection);
    savePersistedSort();
    rerenderEverything();
  });
}

// ============================================================================
// MODAL CONTROLS
// ============================================================================

/**
 * Open preset save modal
 */
function openPresetModal() {
  state.ui.presetModalOpen = true;
  dom.presetModal.hidden = false;
  document.getElementById("presetName").focus();
}

/**
 * Close preset save modal
 */
function closePresetModal() {
  state.ui.presetModalOpen = false;
  dom.presetModal.hidden = true;
  dom.presetForm.reset();
}

/**
 * Open help modal
 */
function openHelpModal() {
  state.ui.helpOpen = true;
  dom.helpModal.hidden = false;
  dom.closeHelpBtn.focus();
}

/**
 * Close help modal
 */
function closeHelpModal() {
  state.ui.helpOpen = false;
  dom.helpModal.hidden = true;
  dom.helpBtn.focus();
}

// ============================================================================
// DENSITY CONTROLS
// ============================================================================

/**
 * Density button configuration
 */
const densityButtons = [
  { btn: dom.densityUltra, mode: 'ultra' },
  { btn: dom.densityCompact, mode: 'compact' },
  { btn: dom.densityComfortable, mode: 'comfortable' },
  { btn: dom.densityList, mode: 'list' }
];

/**
 * Set density mode and update UI
 * @param {string} mode - Density mode (ultra, compact, comfortable, list)
 */
function setDensityMode(mode) {
  state.density = mode;
  
  // Remove all density classes
  document.body.classList.remove('density-ultra', 'density-compact', 'density-comfortable', 'density-list');
  
  // Add new density class
  document.body.classList.add(`density-${mode}`);
  
  // Update button states
  densityButtons.forEach(({ btn, mode: btnMode }) => {
    if (!btn) return;
    const isActive = btnMode === mode;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
  
  // Save preference
  try {
    localStorage.setItem('dafk.density', mode);
  } catch (e) {
    console.error('Failed to save density preference:', e);
  }
  
  // Re-render grid with new density
  const filtered = applyFilters();
  const sorted = sortItems(filtered);
  renderGrid(sorted);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  // Search and filters
  const debouncedSearch = debounce(() => {
    state.filters.search = dom.searchInput.value.trim();
    rerenderEverything();
  }, 200);
  
  dom.searchInput.addEventListener("input", debouncedSearch);
  
  dom.categoryFilter.addEventListener("change", () => {
    state.filters.category = dom.categoryFilter.value;
    rerenderEverything();
  });
  
  // Language toggle
  dom.langToggle.addEventListener("change", () => {
    state.showRussian = dom.langToggle.checked;
    rerenderEverything();
  });

  // Density toggle handlers
  densityButtons.forEach(({ btn, mode }) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      setDensityMode(mode);
    });
  });

  // Help modal
  dom.helpBtn.addEventListener("click", openHelpModal);
  dom.closeHelpBtn.addEventListener("click", closeHelpModal);
  dom.helpModal.addEventListener("click", (e) => {
    if (e.target === dom.helpModal) closeHelpModal();
  });

  // Preset modal
  dom.closePresetModal.addEventListener("click", closePresetModal);
  dom.presetModal.addEventListener("click", (e) => {
    if (e.target === dom.presetModal || e.target.hasAttribute('data-close')) {
      closePresetModal();
    }
  });

  // Preset form submission
  dom.presetForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const formData = new FormData(dom.presetForm);
    const name = formData.get('name').trim();
    const tagsStr = formData.get('tags') || '';
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    const withQty = !!formData.get('withQty');
    
    // Get current selection
    const selectedItems = Array.from(state.packageItems.values()).map(({ item, quantity }) => ({
      itemId: item.id,
      quantity: withQty ? quantity : 1
    }));
    
    if (selectedItems.length === 0) {
      showToast("No items selected");
      return;
    }
    
    try {
      createPreset(name, selectedItems, tags);
      closePresetModal();
      
      // Enhanced toast with "View in Presets" button
      dom.toast.innerHTML = `
        Preset "${name}" saved 
        <a href="presets.html" class="btn btn-primary" style="margin-left: 12px; padding: 4px 12px; font-size: 12px; text-decoration: none;">
          View in Presets
        </a>
      `;
      dom.toast.hidden = false;
      dom.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        dom.toast.classList.remove('show');
        setTimeout(() => { dom.toast.hidden = true; }, 180);
      }, 3000);
    } catch (err) {
      console.error("Failed to save preset:", err);
      showToast("Failed to save preset");
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Show help with "?"
    if (e.key === "?" && !state.ui.helpOpen) {
      e.preventDefault();
      openHelpModal();
      return;
    }

    // Close help modal with Escape
    if (e.key === "Escape" && state.ui.helpOpen) {
      closeHelpModal();
      return;
    }

    // Ctrl/Cmd + F: Focus search (prevent default browser search)
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      dom.searchInput.focus();
      dom.searchInput.select();
      return;
    }
    
    // Escape: Clear selection and search (if help not open)
    if (e.key === "Escape" && !state.ui.helpOpen) {
      if (state.selectedItemIds.size > 0) {
        clearSelection();
      } else if (dom.searchInput.value || state.filters.category || state.filters.rarities.size || state.filters.grades.size) {
        dom.searchInput.value = "";
        state.filters.search = "";
        state.filters.category = "";
        state.filters.rarities.clear();
        state.filters.grades.clear();
        Object.assign(state.filters.attributes, {
          atkMin: null, atkMax: null, defMin: null, defMax: null
        });
        dom.searchInput.focus();
        rerenderEverything();
      }
      return;
    }
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize keyboard shortcuts (Phase 4B)
 */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    // Ignore typing inside inputs / textareas
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }
    
    // Ctrl/Cmd + A => select all visible
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      selectAllVisible();
      return;
    }
    
    // Escape => clear selection (if any)
    if (event.key === 'Escape') {
      if (state.selectedItemIds.size > 0) {
        clearSelection();
        return;
      }
      // If no selection, let existing Escape handler handle it
    }
    
    // Delete / Backspace => remove from package
    if ((event.key === 'Delete' || event.key === 'Backspace') && !event.ctrlKey && !event.metaKey) {
      if (state.selectedItemIds.size > 0) {
        event.preventDefault();
        removeSelectedFromPackage();
        return;
      }
    }
  });
}

/**
 * Initialize the application
 */
function init() {
  // Load persisted preferences
  loadPersistedSort();
  loadPersistedDensity();
  
  // Set density mode (will apply CSS class)
  setDensityMode(state.density);
  
  // Initialize controls
  initSortControls();
  initKeyboardShortcuts();
  
  // Initialize event listeners
  initializeEventListeners();
  
  // Load items
  loadItems();
}

/**
 * Load persisted density preference
 */
function loadPersistedDensity() {
  try {
    const saved = localStorage.getItem('dafk.density');
    if (saved && ['ultra', 'compact', 'comfortable', 'list'].includes(saved)) {
      state.density = saved;
    }
  } catch (e) {
    console.error('Failed to load density preference:', e);
  }
}

// Start the application
init();
