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
  
  // Detail panel (compensation package)
  detailContent: document.getElementById("detailContent"),
  
  // Density toggle
  visualBtn: document.getElementById("visualBtn"),
  compactBtn: document.getElementById("compactBtn"),
  
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
    
    populateCategories();
    applyFilters();
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

// ============================================================================
// MODULE 2: FILTERING & SEARCH
// ============================================================================

/**
 * Apply search and category filters to items
 * Updates state with filtered results and triggers grid re-render
 */
function applyFilters() {
  const term = state.filters.search.toLowerCase();
  const cat = state.filters.category;
  
  const filtered = state.items.filter((item) => {
    const matchesCat = !cat || item.category === cat;
    const matchesSearch =
      !term ||
      item.id.toLowerCase().includes(term) ||
      (item.displayName && item.displayName.toLowerCase().includes(term)) ||
      (item.displayNameRu && item.displayNameRu.toLowerCase().includes(term));
    return matchesCat && matchesSearch;
  });
  
  renderGrid(filtered);
}

// ============================================================================
// MODULE 3: SELECTION LOGIC
// ============================================================================

/**
 * Toggle item selection state
 * @param {string} itemId - Item ID to toggle
 */
function toggleItemSelection(itemId) {
  if (state.selectedItemIds.has(itemId)) {
    state.selectedItemIds.delete(itemId);
    state.packageItems.delete(itemId);
  } else {
    const item = state.items.find(i => i.id === itemId);
    if (item) {
      state.selectedItemIds.add(itemId);
      state.packageItems.set(itemId, {
        item: item,
        quantity: state.packageItems.get(itemId)?.quantity || item.defaultQuantity || 1
      });
    }
  }
  
  // Re-render affected components
  applyFilters(); // Re-render grid to update selection state
  renderCompensationPanel();
}

/**
 * Clear all selections
 */
function clearSelection() {
  state.selectedItemIds.clear();
  state.packageItems.clear();
  applyFilters();
  renderCompensationPanel();
  showToast("Selection cleared");
}

/**
 * Update quantity for a selected item
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
  
  if (!filteredItems.length) {
    renderEmptyState();
    return;
  }
  
  dom.emptyState.hidden = true;
  
  filteredItems.forEach((item) => {
    const card = createItemCard(item);
    dom.grid.appendChild(card);
  });
}

/**
 * Create an item card element
 * @param {Object} item - Item data object
 * @returns {HTMLDivElement} - Card element
 */
function createItemCard(item) {
  const card = document.createElement("div");
  card.className = "card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-pressed", state.selectedItemIds.has(item.id) ? "true" : "false");
  
  if (state.selectedItemIds.has(item.id)) {
    card.classList.add("selected");
  }
  
  // Click and keyboard handlers
  card.addEventListener("click", () => toggleItemSelection(item.id));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleItemSelection(item.id);
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

  // Display name (respects language toggle)
  const name = document.createElement("div");
  name.className = "name";
  const displayName = state.showRussian && item.displayNameRu 
    ? item.displayNameRu 
    : item.displayName || item.id;
  name.textContent = displayName;
  name.setAttribute("title", displayName);

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

  card.append(img, name);
  if (nameRu.textContent) card.appendChild(nameRu);
  card.appendChild(code);
  
  return card;
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

  if (state.selectedItemIds.size === 0) {
    const placeholder = document.createElement("p");
    placeholder.textContent = "Select items to generate init_info JSON.";
    placeholder.style.color = "var(--muted)";
    dom.detailContent.appendChild(placeholder);
    return;
  }

  // Get selected items from packageItems map
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
    copyText(jsonStr);
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
    copyText(ids);
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
// MODULE 7: JSON GENERATION & PRESETS
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

  applyFilters(); // Re-render grid
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
 */
async function copyText(text) {
  if (!text) return;
  
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
    showToast("Copied to clipboard");
  } catch (err) {
    console.error("Copy failed:", err);
    showToast("Copy failed");
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
// EVENT LISTENERS
// ============================================================================

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  // Search and filters
  const debouncedSearch = debounce(() => {
    state.filters.search = dom.searchInput.value.trim();
    applyFilters();
  }, 200);
  
  dom.searchInput.addEventListener("input", debouncedSearch);
  
  dom.categoryFilter.addEventListener("change", () => {
    state.filters.category = dom.categoryFilter.value;
    applyFilters();
  });
  
  // Language toggle
  dom.langToggle.addEventListener("change", () => {
    state.showRussian = dom.langToggle.checked;
    applyFilters(); // Re-render grid with new language
    renderCompensationPanel();
  });

  // Density toggle handlers
  dom.visualBtn.addEventListener("click", () => {
    state.density = 'visual';
    document.body.classList.remove("compact-mode");
    document.body.classList.add("visual-mode");
    dom.visualBtn.classList.add("active");
    dom.compactBtn.classList.remove("active");
    dom.visualBtn.setAttribute("aria-pressed", "true");
    dom.compactBtn.setAttribute("aria-pressed", "false");
  });

  dom.compactBtn.addEventListener("click", () => {
    state.density = 'compact';
    document.body.classList.remove("visual-mode");
    document.body.classList.add("compact-mode");
    dom.compactBtn.classList.add("active");
    dom.visualBtn.classList.remove("active");
    dom.compactBtn.setAttribute("aria-pressed", "true");
    dom.visualBtn.setAttribute("aria-pressed", "false");
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
      } else if (dom.searchInput.value) {
        dom.searchInput.value = "";
        dom.searchInput.focus();
        state.filters.search = "";
        applyFilters();
      }
      return;
    }
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the application
 */
function init() {
  // Set default density mode
  document.body.classList.add("compact-mode");
  
  // Initialize event listeners
  initializeEventListeners();
  
  // Load items
  loadItems();
}

// Start the application
init();
