/**
 * Darkest AFK Item Catalog - Main Script
 * Internal support tool for managing game items and generating compensation packages
 */
import { createPreset } from './presets.js';

"use strict";

  // DOM element references
  const gridEl = document.getElementById("grid");
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const detailContent = document.getElementById("detailContent");
  const emptyState = document.getElementById("emptyState");
  const errorState = document.getElementById("errorState");
  const toast = document.getElementById("toast");
  const langToggle = document.getElementById("langToggle");
  const loadingSkeleton = document.getElementById("loadingSkeleton");
  const helpBtn = document.getElementById("helpBtn");
  const helpModal = document.getElementById("helpModal");
  const closeHelpBtn = document.getElementById("closeHelpBtn");
  const visualBtn = document.getElementById("visualBtn");
  const compactBtn = document.getElementById("compactBtn");
  const presetModal = document.getElementById("presetModal");
  const presetForm = document.getElementById("presetForm");
  const closePresetModal = document.getElementById("closePresetModal");

  // Application state
  let items = [];                    // All items from JSON
  let filtered = [];                 // Currently filtered items
  let selectedIds = new Set();       // Selected item IDs
  let showRu = false;                // Language toggle state
  const customQuantities = new Map(); // Custom quantity overrides
  let jsonFormatPretty = true;       // JSON format toggle (pretty vs minified)

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
   * Show loading skeleton (12 placeholder cards)
   */
  function showLoadingSkeleton() {
    loadingSkeleton.hidden = false;
    loadingSkeleton.innerHTML = "";
    gridEl.hidden = true;
    emptyState.hidden = true;
    errorState.hidden = true;
    
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
      loadingSkeleton.appendChild(skeleton);
    }
  }

  /**
   * Hide loading skeleton and show grid
   */
  function hideLoadingSkeleton() {
    loadingSkeleton.hidden = true;
    loadingSkeleton.innerHTML = ""; // Clean up skeleton cards
    gridEl.hidden = false;
  }

  /**
   * Load items from JSON file
   */
  async function loadItems() {
    showLoadingSkeleton();
    try {
      const res = await fetch("items.json");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to load items.json`);
      }
      items = await res.json();
      
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Invalid or empty items data");
      }
      
      hideLoadingSkeleton();
      populateCategories(items);
      applyFilters();
      
      // Check for preset to apply after items are loaded
      checkForPresetToApply();
    } catch (err) {
      console.error("Failed to load items:", err);
      loadingSkeleton.hidden = true;
      loadingSkeleton.innerHTML = ""; // Clean up skeleton cards
      errorState.hidden = false;
      showToast("Failed to load items");
    }
  }

  /**
   * Populate category dropdown with unique categories from items
   * @param {Array} data - Array of item objects
   */
  function populateCategories(data) {
    const categories = Array.from(
      new Set(data.map((item) => item.category).filter(Boolean))
    ).sort();
    
    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      categoryFilter.appendChild(opt);
    });
  }

  /**
   * Apply search and category filters to items
   */
  function applyFilters() {
    const term = searchInput.value.trim().toLowerCase();
    const cat = categoryFilter.value;
    
    filtered = items.filter((item) => {
      const matchesCat = !cat || item.category === cat;
      const matchesSearch =
        !term ||
        item.id.toLowerCase().includes(term) ||
        (item.displayName && item.displayName.toLowerCase().includes(term)) ||
        (item.displayNameRu && item.displayNameRu.toLowerCase().includes(term));
      return matchesCat && matchesSearch;
    });
    
    renderGrid();
  }

  /**
   * Render the item grid based on filtered items
   */
  function renderGrid() {
    gridEl.innerHTML = "";
    gridEl.hidden = false;
    
    if (!filtered.length) {
      // Update empty state with CTA
      emptyState.innerHTML = `
        <div class="empty-icon">📦</div>
        <p>No items found matching your filters.</p>
        <p class="cta-text">Try adjusting your search or clearing filters.</p>
      `;
      emptyState.hidden = false;
      gridEl.hidden = true;
      return;
    }
    emptyState.hidden = true;

    filtered.forEach((item) => {
      const card = createItemCard(item);
      gridEl.appendChild(card);
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
    card.setAttribute("aria-pressed", selectedIds.has(item.id) ? "true" : "false");
    
    if (selectedIds.has(item.id)) card.classList.add("selected");
    
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
    const displayName = showRu && item.displayNameRu 
      ? item.displayNameRu 
      : item.displayName || item.id;
    name.textContent = displayName;
    name.setAttribute("title", displayName);

    // Secondary name (opposite language)
    const nameRu = document.createElement("div");
    nameRu.className = "name-ru";
    if (showRu && item.displayName) {
      nameRu.textContent = item.displayName;
    } else if (!showRu && item.displayNameRu) {
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

  /**
   * Toggle item selection state
   * @param {string} id - Item ID to toggle
   */
  function toggleItemSelection(id) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    renderGrid();
    updateDetailPanel();
  }

  /**
   * Update the detail panel with selected items and generated JSON
   */
  function updateDetailPanel() {
    detailContent.innerHTML = "";

    if (selectedIds.size === 0) {
      const placeholder = document.createElement("p");
      placeholder.textContent = "Select items to generate init_info JSON.";
      placeholder.style.color = "var(--muted)";
      detailContent.appendChild(placeholder);
      return;
    }

    // Get selected items
    const selectedItems = Array.from(selectedIds).map(id => 
      items.find(item => item.id === id)
    ).filter(Boolean);

    // Selection counter badge
    const counter = document.createElement("div");
    counter.className = "selection-counter";
    counter.setAttribute("aria-live", "polite");
    counter.innerHTML = `
      Selected: <span class="count">${selectedItems.length}</span> ${selectedItems.length === 1 ? 'item' : 'items'}
    `;
    detailContent.appendChild(counter);

    // Build init_info structure with custom or default quantities
    const initInfo = {
      init_info: {
        type: "COMMON",
        title: "To our dearest hero",
        message: "We apologize for the inconvenience you have encountered. Here is the compensation pack for you.",
        rewards: {
          rewards_list: selectedItems.map(item => ({
            type: "ITEM",
            item_name: item.id,
            quantity: customQuantities.get(item.id) || item.defaultQuantity || 1
          }))
        }
      }
    };

    // Show selected items summary
    const summary = document.createElement("div");
    summary.style.marginBottom = "12px";
    summary.innerHTML = `<strong>Selected items:</strong> ${selectedItems.length}`;
    detailContent.appendChild(summary);

    // Show items list with quantity controls (steppers)
    const itemsList = document.createElement("div");
    itemsList.style.marginBottom = "12px";
    itemsList.style.fontSize = "13px";
    itemsList.className = "selected-items-list";
    selectedItems.forEach(item => {
      const itemRow = document.createElement("div");
      itemRow.className = "selected-item-row";
      
      const displayName = showRu && item.displayNameRu ? item.displayNameRu : item.displayName || item.id;
      const currentQty = customQuantities.get(item.id) || item.defaultQuantity || 1;
      
      const nameSpan = document.createElement("span");
      nameSpan.textContent = displayName;
      nameSpan.style.flex = "1";
      nameSpan.style.color = "#f5f7fa";
      
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
        const newQty = Math.max(1, currentQty - 1);
        if (newQty === item.defaultQuantity || newQty === 1) {
          customQuantities.delete(item.id);
        } else {
          customQuantities.set(item.id, newQty);
        }
        updateDetailPanel();
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
        if (newQty === item.defaultQuantity) {
          customQuantities.delete(item.id);
        } else {
          customQuantities.set(item.id, newQty);
        }
        updateDetailPanel();
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
        const newQty = Math.min(999999, currentQty + 1);
        customQuantities.set(item.id, newQty);
        updateDetailPanel();
      });
      
      qtyControl.append(decreaseBtn, qtyInput, increaseBtn);
      itemRow.append(nameSpan, qtyControl);
      itemsList.appendChild(itemRow);
    });
    detailContent.appendChild(itemsList);

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
    prettyBtn.className = jsonFormatPretty ? "active" : "";
    prettyBtn.addEventListener("click", () => {
      jsonFormatPretty = true;
      updateDetailPanel();
    });
    
    const minifiedBtn = document.createElement("button");
    minifiedBtn.type = "button";
    minifiedBtn.textContent = "Minified";
    minifiedBtn.className = !jsonFormatPretty ? "active" : "";
    minifiedBtn.addEventListener("click", () => {
      jsonFormatPretty = false;
      updateDetailPanel();
    });
    
    formatToggle.append(prettyBtn, minifiedBtn);
    codeBlockHeader.append(label, formatToggle);
    
    // Code block
    const codeBlock = document.createElement("pre");
    codeBlock.className = "code-block";
    const jsonString = jsonFormatPretty 
      ? JSON.stringify(initInfo, null, 2)
      : JSON.stringify(initInfo);
    codeBlock.innerHTML = syntaxHighlight(jsonString);
    
    codeBlockWrapper.append(codeBlockHeader, codeBlock);
    detailContent.appendChild(codeBlockWrapper);

    // Actions (pinned at bottom)
    const actions = document.createElement("div");
    actions.className = "actions";
    
    // Copy JSON button (primary)
    const copyJsonBtn = document.createElement("button");
    copyJsonBtn.type = "button";
    copyJsonBtn.className = "btn-primary";
    copyJsonBtn.textContent = "Copy JSON";
    copyJsonBtn.setAttribute("aria-label", "Copy init_info JSON to clipboard");
    copyJsonBtn.addEventListener("click", () => {
      const jsonStr = jsonFormatPretty 
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
      const ids = selectedItems.map(item => item.id).join(", ");
      copyText(ids);
    });
    
    // Clear button (tertiary)
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn-tertiary";
    clearBtn.textContent = "Clear selection";
    clearBtn.setAttribute("aria-label", "Clear all selected items");
    clearBtn.addEventListener("click", () => {
      selectedIds.clear();
      customQuantities.clear();
      renderGrid();
      updateDetailPanel();
      showToast("Selection cleared");
    });
    
    actions.append(copyJsonBtn, savePresetBtn, copyIdsBtn, clearBtn);
    detailContent.appendChild(actions);
  }

  /**
   * Open preset save modal
   */
  function openPresetModal() {
    presetModal.hidden = false;
    document.getElementById("presetName").focus();
  }

  /**
   * Close preset save modal
   */
  function closePresetModalFn() {
    presetModal.hidden = true;
    presetForm.reset();
  }

  function row(label, value) {
    const wrap = document.createElement("div");
    wrap.className = "detail-row";
    const l = document.createElement("div");
    l.className = "label";
    l.textContent = label;
    const v = document.createElement("div");
    v.className = "value";
    if (value instanceof Node) v.appendChild(value);
    else v.textContent = value;
    wrap.append(l, v);
    return wrap;
  }

  function subText(text) {
    const span = document.createElement("span");
    span.style.display = "block";
    span.style.color = "var(--muted)";
    span.style.fontSize = "12px";
    span.textContent = text;
    return span;
  }

  function codeMono(text) {
    const span = document.createElement("span");
    span.style.fontFamily = '"SFMono-Regular", Menlo, Consolas, monospace';
    span.textContent = text;
    return span;
  }

  function actionButton(label, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
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

  let toastTimer;
  /**
   * Show toast notification with auto-dismiss
   * @param {string} msg - Message to display
   */
  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toast.hidden = true;
      }, 180); // Wait for fade-out transition
    }, 1600);
  }

  // Apply debounce to search (200ms delay)
  const debouncedSearch = debounce(applyFilters, 200);
  searchInput.addEventListener("input", debouncedSearch);
  categoryFilter.addEventListener("change", applyFilters);
  langToggle.addEventListener("change", () => {
    showRu = langToggle.checked;
    renderGrid();
    updateDetailPanel();
  });

  // Density toggle handlers
  visualBtn.addEventListener("click", () => {
    document.body.classList.remove("compact-mode");
    document.body.classList.add("visual-mode");
    visualBtn.classList.add("active");
    compactBtn.classList.remove("active");
    visualBtn.setAttribute("aria-pressed", "true");
    compactBtn.setAttribute("aria-pressed", "false");
  });

  compactBtn.addEventListener("click", () => {
    document.body.classList.remove("visual-mode");
    document.body.classList.add("compact-mode");
    compactBtn.classList.add("active");
    visualBtn.classList.remove("active");
    compactBtn.setAttribute("aria-pressed", "true");
    visualBtn.setAttribute("aria-pressed", "false");
  });

  // Set default mode
  document.body.classList.add("compact-mode");

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
    selectedIds.clear();
    customQuantities.clear();

    // Apply preset items
    preset.items.forEach(item => {
      selectedIds.add(item.itemId);
      if (item.quantity && item.quantity !== 1) {
        customQuantities.set(item.itemId, item.quantity);
      }
    });

    console.log('Applied preset:', preset.name);
    console.log('Selected IDs:', Array.from(selectedIds));
    console.log('Custom quantities:', Array.from(customQuantities.entries()));

    renderGrid();
    updateDetailPanel();
  }

  // Help modal controls
  helpBtn.addEventListener("click", openHelpModal);
  closeHelpBtn.addEventListener("click", closeHelpModal);
  
  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) closeHelpModal();
  });

  // Preset modal controls
  closePresetModal.addEventListener("click", closePresetModalFn);
  
  presetModal.addEventListener("click", (e) => {
    if (e.target === presetModal || e.target.hasAttribute('data-close')) {
      closePresetModalFn();
    }
  });

  // Preset form submission
  presetForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const formData = new FormData(presetForm);
    const name = formData.get('name').trim();
    const tagsStr = formData.get('tags') || '';
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    const withQty = !!formData.get('withQty');
    
    // Get current selection
    const selectedItems = Array.from(selectedIds).map(id => {
      const item = items.find(i => i.id === id);
      return {
        itemId: id,
        quantity: withQty ? (customQuantities.get(id) || item?.defaultQuantity || 1) : 1
      };
    });
    
    if (selectedItems.length === 0) {
      showToast("No items selected");
      return;
    }
    
    try {
      createPreset(name, selectedItems, tags);
      closePresetModalFn();
      
      // Enhanced toast with "View in Presets" button
      toast.innerHTML = `
        Preset "${name}" saved 
        <a href="presets.html" class="btn btn-primary" style="margin-left: 12px; padding: 4px 12px; font-size: 12px; text-decoration: none;">
          View in Presets
        </a>
      `;
      toast.hidden = false;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { toast.hidden = true; }, 180);
      }, 3000);
    } catch (err) {
      console.error("Failed to save preset:", err);
      showToast("Failed to save preset");
    }
  });

  function openHelpModal() {
    helpModal.hidden = false;
    closeHelpBtn.focus();
  }

  function closeHelpModal() {
    helpModal.hidden = true;
    helpBtn.focus();
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Show help with "?"
    if (e.key === "?" && !helpModal.hidden === false) {
      e.preventDefault();
      openHelpModal();
      return;
    }

    // Close help modal with Escape
    if (e.key === "Escape" && !helpModal.hidden) {
      closeHelpModal();
      return;
    }

    // Ctrl/Cmd + F: Focus search (prevent default browser search)
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }
    
    // Escape: Clear selection and search (if help not open)
    if (e.key === "Escape") {
      if (selectedIds.size > 0) {
        selectedIds.clear();
        renderGrid();
        updateDetailPanel();
        showToast("Selection cleared");
      } else if (searchInput.value) {
        searchInput.value = "";
        searchInput.focus();
        applyFilters();
      }
      return;
    }
  });

loadItems();

