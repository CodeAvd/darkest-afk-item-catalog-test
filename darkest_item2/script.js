/**
 * Darkest AFK Item Catalog - Main Script
 * Internal support tool for managing game items and generating compensation packages
 */
(() => {
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
  const densityToggle = document.getElementById("densityToggle");
  const sortDropdown = document.getElementById("sortDropdown");
  const loadingSkeleton = document.getElementById("loadingSkeleton");
  const helpBtn = document.getElementById("helpBtn");
  const helpModal = document.getElementById("helpModal");
  const closeHelpBtn = document.getElementById("closeHelpBtn");
  const resetFiltersBtn = document.getElementById("resetFiltersBtn");
  const retryLoadBtn = document.getElementById("retryLoadBtn");

  // Application state
  let items = [];                    // All items from JSON
  let filtered = [];                 // Currently filtered items
  let selectedIds = new Set();       // Selected item IDs
  let showRu = localStorage.getItem('darkest-afk-show-ru') === 'true'; // Language toggle state
  let sortMode = "name-asc";         // Current sort mode
  let lastSelectedIndex = -1;        // For shift-click range selection
  const customQuantities = new Map(); // Custom quantity overrides
  let historyStack = [];             // Undo/redo history
  let historyIndex = -1;             // Current position in history

  /**
   * Save current selection state to localStorage
   */
  function saveDraft() {
    const draft = {
      selectedIds: Array.from(selectedIds),
      customQuantities: Array.from(customQuantities.entries()),
      timestamp: Date.now()
    };
    localStorage.setItem('darkest-afk-draft', JSON.stringify(draft));
  }

  /**
   * Load draft from localStorage
   */
  function loadDraft() {
    const draftStr = localStorage.getItem('darkest-afk-draft');
    if (!draftStr) return false;
    
    try {
      const draft = JSON.parse(draftStr);
      if (draft.selectedIds && Array.isArray(draft.selectedIds)) {
        selectedIds = new Set(draft.selectedIds);
        customQuantities.clear();
        if (draft.customQuantities) {
          draft.customQuantities.forEach(([key, value]) => {
            customQuantities.set(key, value);
          });
        }
        return true;
      }
    } catch (e) {
      console.error('Failed to load draft:', e);
    }
    return false;
  }

  /**
   * Save state to history for undo/redo
   */
  function saveToHistory() {
    const state = {
      selectedIds: new Set(selectedIds),
      customQuantities: new Map(customQuantities)
    };
    
    // Remove any states after current index (when user has undone and makes new action)
    historyStack = historyStack.slice(0, historyIndex + 1);
    
    // Add new state
    historyStack.push(state);
    historyIndex++;
    
    // Limit history to 50 states
    if (historyStack.length > 50) {
      historyStack.shift();
      historyIndex--;
    }
  }

  /**
   * Undo last action
   */
  function undo() {
    if (historyIndex > 0) {
      historyIndex--;
      const state = historyStack[historyIndex];
      selectedIds = new Set(state.selectedIds);
      customQuantities = new Map(state.customQuantities);
      renderGrid();
      updateDetailPanel();
      updateSelectionBar();
      saveDraft();
      showToast("Undone");
      return true;
    }
    return false;
  }

  /**
   * Redo last undone action
   */
  function redo() {
    if (historyIndex < historyStack.length - 1) {
      historyIndex++;
      const state = historyStack[historyIndex];
      selectedIds = new Set(state.selectedIds);
      customQuantities = new Map(state.customQuantities);
      renderGrid();
      updateDetailPanel();
      updateSelectionBar();
      saveDraft();
      showToast("Redone");
      return true;
    }
    return false;
  }
  
  /**
   * Get recommended maximum quantity for an item
   * @param {Object} item - Item object
   * @returns {number} - Maximum recommended quantity
   */
  function getMaxQuantity(item) {
    const category = (item.category || "").toLowerCase();
    
    // Summon scrolls and heroes: typically 1-10
    if (category.includes("summon") || category.includes("hero") && !category.includes("exp")) {
      return item.defaultQuantity || 10;
    }
    
    // Gear: typically 1-5
    if (category.includes("gear") || category.includes("equipment")) {
      return 5;
    }
    
    // Skins, avatars, auras: typically 1
    if (category.includes("skin") || category.includes("avatar") || category.includes("aura")) {
      return 1;
    }
    
    // Fragments, tokens: up to 100
    if (category.includes("fragment") || category.includes("token") || category.includes("soul")) {
      return 100;
    }
    
    // Currency, resources: scale based on default
    if (category.includes("currency") || category.includes("resource") || category.includes("gold") || category.includes("chest")) {
      const defaultQty = item.defaultQuantity || 1000;
      return Math.max(defaultQty * 100, 100000); // 100x default or 100k minimum
    }
    
    // Default: 10x the default quantity or 1000
    return Math.max((item.defaultQuantity || 100) * 10, 1000);
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
    } catch (err) {
      console.error("Failed to load items:", err);
      loadingSkeleton.hidden = true;
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
   * Parse search query for prefixes (name:, code:, category:)
   * @param {string} query - Search query
   * @returns {Object} - Parsed query with prefix and term
   */
  function parseSearchQuery(query) {
    const trimmed = query.trim().toLowerCase();
    
    // Check for prefix patterns
    const prefixMatch = trimmed.match(/^(name|code|category|cat):\s*(.+)$/);
    
    if (prefixMatch) {
      const prefix = prefixMatch[1] === 'cat' ? 'category' : prefixMatch[1];
      const term = prefixMatch[2];
      return { prefix, term };
    }
    
    return { prefix: null, term: trimmed };
  }

  /**
   * Apply search and category filters to items, then sort
   */
  function applyFilters() {
    const rawQuery = searchInput.value.trim();
    const cat = categoryFilter.value;
    const { prefix, term } = parseSearchQuery(rawQuery);
    
    // Filter
    filtered = items.filter((item) => {
      const matchesCat = !cat || item.category === cat;
      
      if (!term) return matchesCat;
      
      let matchesSearch = false;
      
      switch (prefix) {
        case 'name':
          matchesSearch = 
            (item.displayName && item.displayName.toLowerCase().includes(term)) ||
            (item.displayNameRu && item.displayNameRu.toLowerCase().includes(term));
          break;
        case 'code':
          matchesSearch = item.id.toLowerCase().includes(term);
          break;
        case 'category':
          matchesSearch = item.category && item.category.toLowerCase().includes(term);
          break;
        default:
          // No prefix - search everywhere
          matchesSearch =
            item.id.toLowerCase().includes(term) ||
            (item.displayName && item.displayName.toLowerCase().includes(term)) ||
            (item.displayNameRu && item.displayNameRu.toLowerCase().includes(term)) ||
            (item.category && item.category.toLowerCase().includes(term));
      }
      
      return matchesCat && matchesSearch;
    });
    
    // Sort
    sortItems();
    
    renderGrid();
  }

  /**
   * Sort filtered items based on current sort mode
   */
  function sortItems() {
    const [criterion, direction] = sortMode.split('-');
    
    filtered.sort((a, b) => {
      let compareA, compareB;
      
      switch (criterion) {
        case 'name':
          compareA = (a.displayName || a.id).toLowerCase();
          compareB = (b.displayName || b.id).toLowerCase();
          break;
        case 'category':
          compareA = (a.category || '').toLowerCase();
          compareB = (b.category || '').toLowerCase();
          break;
        case 'recent':
          // Assume items at end of array are more recent
          return items.indexOf(b) - items.indexOf(a);
        default:
          return 0;
      }
      
      if (compareA < compareB) return direction === 'asc' ? -1 : 1;
      if (compareA > compareB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Render the item grid based on filtered items
   */
  function renderGrid() {
    gridEl.innerHTML = "";
    gridEl.hidden = false;
    
    if (!filtered.length) {
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
   * Abbreviate item name for compact display
   * @param {string} name - Full item name
   * @returns {string} - Abbreviated name
   */
  function abbreviateName(name) {
    if (!name) return '';
    
    // Extract grade/rank number
    const gradeMatch = name.match(/Grade\s+(\d+\+?)/i);
    const rankMatch = name.match(/Rank\s+(\d+\+?)/i);
    const grade = gradeMatch ? gradeMatch[1] : (rankMatch ? rankMatch[1] : '');
    
    // Remove prefixes and extract core item type
    let abbreviated = name
      .replace(/^(Damager|Support|Tank)\s+/i, '')
      .replace(/\s+Grade\s+\d+\+?/i, '')
      .replace(/\s+Rank\s+\d+\+?/i, '')
      .replace(/\(Epic\)/i, '')
      .replace(/\(.*?\)/g, '')
      .trim();
    
    // Shorten common words
    abbreviated = abbreviated
      .replace(/Armor/i, 'Armor')
      .replace(/Gloves/i, 'Gloves')
      .replace(/Weapon/i, 'Wpn')
      .replace(/Off-Hand/i, 'Off-Hand')
      .replace(/Fragment/i, 'Frag')
      .replace(/Summon Scroll/i, 'Scroll');
    
    // Add grade if exists
    if (grade) {
      abbreviated = `${abbreviated} G${grade}`;
    }
    
    // Limit length
    if (abbreviated.length > 18) {
      abbreviated = abbreviated.substring(0, 16) + '…';
    }
    
    return abbreviated;
  }

  /**
   * Get category color based on category name
   * @param {string} category - Category name
   * @returns {Object} - Color and background styles
   */
  function getCategoryColor(category) {
    if (!category) return { bg: "rgba(127, 140, 141, 0.15)", color: "#95a5a6" };
    
    const lower = category.toLowerCase();
    if (lower.includes("currency") || lower.includes("gold") || lower.includes("chest")) {
      return { bg: "rgba(245, 166, 35, 0.15)", color: "#f5a623" };
    }
    if (lower.includes("hero") || lower.includes("skin")) {
      return { bg: "rgba(155, 89, 182, 0.15)", color: "#9b59b6" };
    }
    if (lower.includes("gear") || lower.includes("equipment")) {
      return { bg: "rgba(52, 152, 219, 0.15)", color: "#3498db" };
    }
    if (lower.includes("event")) {
      return { bg: "rgba(231, 76, 60, 0.15)", color: "#e74c3c" };
    }
    if (lower.includes("fragment") || lower.includes("token")) {
      return { bg: "rgba(26, 188, 156, 0.15)", color: "#1abc9c" };
    }
    if (lower.includes("aura")) {
      return { bg: "rgba(243, 156, 18, 0.15)", color: "#f39c12" };
    }
    return { bg: "rgba(127, 140, 141, 0.15)", color: "#95a5a6" };
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
    card.setAttribute("data-item-id", item.id);
    card.setAttribute("aria-pressed", selectedIds.has(item.id) ? "true" : "false");
    card.setAttribute("aria-label", `${item.displayName || item.id}, ${item.category || 'uncategorized'}. ${selectedIds.has(item.id) ? 'Selected' : 'Not selected'}. Press Enter or Space to toggle.`);
    
    if (selectedIds.has(item.id)) card.classList.add("selected");
    
    // Click and keyboard handlers with shift-click support
    card.addEventListener("click", (e) => {
      const currentIndex = filtered.findIndex(i => i.id === item.id);
      
      if (e.shiftKey && lastSelectedIndex !== -1 && lastSelectedIndex !== currentIndex) {
        // Range selection
        e.preventDefault();
        saveToHistory();
        const start = Math.min(lastSelectedIndex, currentIndex);
        const end = Math.max(lastSelectedIndex, currentIndex);
        
        for (let i = start; i <= end; i++) {
          if (filtered[i]) {
            selectedIds.add(filtered[i].id);
          }
        }
        
        renderGrid();
        updateDetailPanel();
        updateSelectionBar();
        saveDraft();
        showToast(`Selected ${end - start + 1} items`);
      } else {
        // Normal click
        toggleItemSelection(item.id);
        lastSelectedIndex = currentIndex;
      }
    });
    
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleItemSelection(item.id);
        const currentIndex = filtered.findIndex(i => i.id === item.id);
        lastSelectedIndex = currentIndex;
      }
    });

    // Category tag
    if (item.category) {
      const categoryTag = document.createElement("div");
      categoryTag.className = "category-tag";
      const colors = getCategoryColor(item.category);
      categoryTag.style.background = colors.bg;
      categoryTag.style.color = colors.color;
      categoryTag.textContent = item.category.length > 12 
        ? item.category.substring(0, 10) + "…" 
        : item.category;
      card.appendChild(categoryTag);
    }

    // Image with fallback
    const img = document.createElement("img");
    img.src = item.image || "";
    img.alt = item.displayName || item.id;
    img.loading = "lazy";
    img.onerror = () => {
      img.replaceWith(createFallbackIcon(item.id));
    };

    // Display name (abbreviated) with full name in tooltip
    const fullName = showRu && item.displayNameRu ? item.displayNameRu : item.displayName || item.id;
    const displayName = abbreviateName(fullName);
    
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = displayName;
    name.setAttribute("title", fullName);

    // Secondary name (appears on hover)
    const nameRu = document.createElement("div");
    nameRu.className = "name-ru";
    if (showRu && item.displayName) {
      nameRu.textContent = item.displayName;
    } else if (!showRu && item.displayNameRu) {
      nameRu.textContent = item.displayNameRu;
    }

    // Item code (hidden by default, shows on hover)
    const code = document.createElement("div");
    code.className = "code";
    code.textContent = item.id;
    code.setAttribute("title", `Code: ${item.id}`);

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
    const wasSelected = selectedIds.has(id);
    
    // Save to history before making change
    saveToHistory();
    
    if (wasSelected) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    
    renderGrid();
    updateDetailPanel();
    updateSelectionBar();
    saveDraft();
    
    // Add animation class for newly selected items
    if (!wasSelected) {
      requestAnimationFrame(() => {
        const card = document.querySelector(`[data-item-id="${id}"]`);
        if (card) {
          card.classList.add("just-selected");
          setTimeout(() => card.classList.remove("just-selected"), 300);
        }
      });
    }
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

    // Validation summary for items exceeding limits
    const warnings = [];
    const errors = [];
    
    selectedItems.forEach(item => {
      const qty = customQuantities.get(item.id) || item.defaultQuantity || 1;
      const maxQty = getMaxQuantity(item);
      
      if (qty > maxQty * 10) {
        errors.push({ item, qty, maxQty });
      } else if (qty > maxQty) {
        warnings.push({ item, qty, maxQty });
      }
    });
    
    if (warnings.length > 0 || errors.length > 0) {
      const validationDiv = document.createElement("div");
      validationDiv.className = `validation-summary ${errors.length > 0 ? 'error' : ''}`;
      
      const header = document.createElement("div");
      header.className = "validation-summary-header";
      header.textContent = errors.length > 0 
        ? `⚠ ${errors.length + warnings.length} Quantity Warning(s)`
        : `⚠ ${warnings.length} Quantity Warning(s)`;
      
      const itemsList = document.createElement("ul");
      itemsList.className = "validation-summary-items";
      itemsList.style.margin = "0";
      itemsList.style.paddingLeft = "20px";
      
      [...errors, ...warnings].forEach(({ item, qty, maxQty }) => {
        const li = document.createElement("li");
        const displayName = showRu && item.displayNameRu ? item.displayNameRu : item.displayName || item.id;
        li.textContent = `${displayName}: ${qty.toLocaleString()} (max: ${maxQty.toLocaleString()})`;
        itemsList.appendChild(li);
      });
      
      validationDiv.appendChild(header);
      validationDiv.appendChild(itemsList);
      detailContent.appendChild(validationDiv);
    }

    // Show selected items summary
    const summary = document.createElement("div");
    summary.style.marginBottom = "12px";
    summary.innerHTML = `<strong>Selected items:</strong> ${selectedItems.length}`;
    detailContent.appendChild(summary);

    // Show items list with quantity controls
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
      nameSpan.style.color = "var(--text)";
      
      const qtyControl = document.createElement("div");
      qtyControl.className = "quantity-control";
      
      const qtyInput = document.createElement("input");
      qtyInput.type = "number";
      qtyInput.min = "1";
      qtyInput.max = "999999";
      qtyInput.value = currentQty;
      qtyInput.className = "qty-input";
      qtyInput.setAttribute("aria-label", `Quantity for ${displayName}`);
      qtyInput.dataset.itemId = item.id;
      
      // Validate quantity
      const maxQty = getMaxQuantity(item);
      if (currentQty > maxQty) {
        if (currentQty > maxQty * 10) {
          qtyInput.classList.add("error");
        } else {
          qtyInput.classList.add("warning");
        }
      }
      
      qtyInput.addEventListener("change", (e) => {
        const newQty = parseInt(e.target.value) || item.defaultQuantity || 1;
        if (newQty === item.defaultQuantity) {
          customQuantities.delete(item.id);
        } else {
          customQuantities.set(item.id, newQty);
        }
        updateDetailPanel();
      });
      
      qtyInput.addEventListener("input", (e) => {
        const newQty = parseInt(e.target.value) || 0;
        const maxQty = getMaxQuantity(item);
        
        // Remove existing validation classes and tooltips
        qtyInput.classList.remove("warning", "error");
        const existingTooltip = itemRow.querySelector(".qty-warning-tooltip");
        if (existingTooltip) existingTooltip.remove();
        
        // Add validation feedback
        if (newQty > maxQty) {
          const isError = newQty > maxQty * 10;
          qtyInput.classList.add(isError ? "error" : "warning");
          
          const tooltip = document.createElement("div");
          tooltip.className = `qty-warning-tooltip ${isError ? "error" : ""}`;
          tooltip.textContent = `Recommended max: ${maxQty.toLocaleString()}, you entered: ${newQty.toLocaleString()}`;
          itemRow.appendChild(tooltip);
        }
      });
      
      qtyControl.appendChild(qtyInput);
      itemRow.append(nameSpan, qtyControl);
      itemsList.appendChild(itemRow);
    });
    detailContent.appendChild(itemsList);

    // JSON code block with wrapper
    const codeWrapper = document.createElement("div");
    codeWrapper.className = "code-block-wrapper";
    
    const codeHeader = document.createElement("div");
    codeHeader.className = "code-block-header";
    
    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.gap = "6px";
    
    const prettyBtn = document.createElement("button");
    prettyBtn.textContent = "Pretty";
    prettyBtn.className = "format-json-btn";
    prettyBtn.title = "Pretty-print JSON";
    prettyBtn.onclick = (e) => {
      e.stopPropagation();
      try {
        const parsed = JSON.parse(codeBlock.textContent);
        codeBlock.textContent = JSON.stringify(parsed, null, 2);
        showToast("JSON formatted");
      } catch (err) {
        showToast("Invalid JSON", "error");
      }
    };
    
    const minifyBtn = document.createElement("button");
    minifyBtn.textContent = "Minify";
    minifyBtn.className = "format-json-btn";
    minifyBtn.title = "Minify JSON";
    minifyBtn.onclick = (e) => {
      e.stopPropagation();
      try {
        const parsed = JSON.parse(codeBlock.textContent);
        codeBlock.textContent = JSON.stringify(parsed);
        showToast("JSON minified");
      } catch (err) {
        showToast("Invalid JSON", "error");
      }
    };
    
    btnGroup.appendChild(prettyBtn);
    btnGroup.appendChild(minifyBtn);
    codeHeader.appendChild(btnGroup);
    
    const codeBlock = document.createElement("pre");
    codeBlock.className = "code-block";
    codeBlock.textContent = JSON.stringify(initInfo, null, 2);
    
    codeWrapper.append(codeHeader, codeBlock);
    detailContent.appendChild(codeWrapper);

    // Actions
    const actions = document.createElement("div");
    actions.className = "actions";
    
    const copyButton = actionButton("Copy init_info JSON", () => {
      // Check for validation errors
      if (errors.length > 0) {
        showToast(`Cannot generate: ${errors.length} items exceed limits by 10x+`, "error");
        return;
      }
      
      const jsonStr = JSON.stringify(initInfo, null, 2);
      copyText(jsonStr);
      showToast(`JSON copied (${selectedItems.length} items)`);
    });
    
    // Disable button if critical errors exist
    if (errors.length > 0) {
      copyButton.disabled = true;
      copyButton.style.opacity = "0.5";
      copyButton.style.cursor = "not-allowed";
      copyButton.title = "Fix quantity errors before generating JSON";
    }
    
    actions.append(
      copyButton,
      actionButton("Clear selection", () => {
        if (selectedIds.size > 10) {
          if (!confirmAction(`Clear selection of ${selectedIds.size} items? This cannot be undone.`)) {
            return;
          }
        }
        
        const count = selectedIds.size;
        selectedIds.clear();
        customQuantities.clear();
        lastSelectedIndex = -1;
        renderGrid();
        updateDetailPanel();
        updateSelectionBar();
        showToast(`Selection cleared (${count} items)`);
      })
    );
    detailContent.appendChild(actions);

    // Paste JSON section
    createPasteJSONSection(detailContent);
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

  // Selection bar event listeners initialized flag
  let selectionBarInitialized = false;

  /**
   * Initialize selection bar event listeners (called once)
   */
  function initSelectionBar() {
    if (selectionBarInitialized) return;
    
    const copyBtn = document.getElementById("selBarCopyBtn");
    const clearBtn = document.getElementById("selBarClearBtn");
    
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const selectedItems = Array.from(selectedIds).map(id => 
          items.find(item => item.id === id)
        ).filter(Boolean);
        
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
        
        copyText(JSON.stringify(initInfo, null, 2));
        showToast(`JSON copied (${selectedItems.length} items)`);
      });
    }
    
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (selectedIds.size > 10) {
          if (!confirmAction(`Clear selection of ${selectedIds.size} items? This cannot be undone.`)) {
            return;
          }
        }
        
        const count = selectedIds.size;
        selectedIds.clear();
        customQuantities.clear();
        lastSelectedIndex = -1;
        renderGrid();
        updateDetailPanel();
        updateSelectionBar();
        showToast(`Selection cleared (${count} items)`);
      });
    }
    
    selectionBarInitialized = true;
  }

  /**
   * Update the fixed selection bar
   */
  function updateSelectionBar() {
    const selectionBar = document.getElementById("selectionBar");
    if (!selectionBar) return;
    
    // Update count
    const count = selectedIds.size;
    const badge = selectionBar.querySelector(".selection-count-badge");
    const text = selectionBar.querySelector(".selection-count span:last-child");
    
    if (badge) badge.textContent = count;
    if (text) text.textContent = count === 1 ? "item selected" : "items selected";
    
    // Show/hide bar
    if (count > 0) {
      selectionBar.classList.add("visible");
    } else {
      selectionBar.classList.remove("visible");
    }
  }

  /**
   * Copy text to clipboard with fallback for older browsers
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} - Success status
   */
  async function copyText(text) {
    if (!text) return false;
    
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
      return true;
    } catch (err) {
      console.error("Copy failed:", err);
      showToast("Copy failed", "error");
      return false;
    }
  }

  let toastTimer;
  /**
   * Show toast notification with auto-dismiss
   * @param {string} msg - Message to display
   * @param {string} type - Toast type (success, error)
   */
  function showToast(msg, type = "success") {
    toast.textContent = msg;
    toast.hidden = false;
    toast.className = "toast show";
    if (type === "error") {
      toast.classList.add("error");
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toast.hidden = true;
        toast.classList.remove("error");
      }, 250); // Wait for fade-out transition
    }, 2500);
  }

  /**
   * Create paste JSON section for reverse mode
   * @param {HTMLElement} container - Container element
   */
  function createPasteJSONSection(container) {
    const section = document.createElement("div");
    section.className = "paste-json-section";

    const toggle = document.createElement("button");
    toggle.className = "paste-json-toggle";
    toggle.type = "button";
    toggle.textContent = "⬅ Paste JSON from admin";
    toggle.setAttribute("aria-expanded", "false");

    const content = document.createElement("div");
    content.className = "paste-json-content";

    const textarea = document.createElement("textarea");
    textarea.className = "paste-json-textarea";
    textarea.placeholder = 'Paste init_info JSON here...\n\nExample:\n{\n  "init_info": {\n    "rewards": {\n      "rewards_list": [\n        {"type": "ITEM", "item_name": "item_gold", "quantity": 1000}\n      ]\n    }\n  }\n}';
    textarea.setAttribute("aria-label", "Paste JSON input");

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "paste-actions";

    const parseBtn = actionButton("Parse & Load", () => parseAndLoadJSON(textarea.value));
    const clearBtn = actionButton("Clear", () => {
      textarea.value = "";
      textarea.focus();
    });
    clearBtn.classList.add("secondary");

    actionsDiv.append(parseBtn, clearBtn);
    content.append(textarea, actionsDiv);
    section.append(toggle, content);
    container.appendChild(section);

    // Toggle handler
    toggle.addEventListener("click", () => {
      const isExpanded = content.classList.contains("expanded");
      if (isExpanded) {
        content.classList.remove("expanded");
        toggle.classList.remove("expanded");
        toggle.setAttribute("aria-expanded", "false");
      } else {
        content.classList.add("expanded");
        toggle.classList.add("expanded");
        toggle.setAttribute("aria-expanded", "true");
        textarea.focus();
      }
    });
  }

  /**
   * Parse and load JSON to populate selection
   * @param {string} jsonStr - JSON string to parse
   */
  function parseAndLoadJSON(jsonStr) {
    if (!jsonStr.trim()) {
      showToast("Please paste JSON first", "error");
      return;
    }

    try {
      const data = JSON.parse(jsonStr);
      
      // Validate structure
      if (!data.init_info || !data.init_info.rewards || !data.init_info.rewards.rewards_list) {
        showToast("Invalid JSON structure. Expected init_info format.", "error");
        return;
      }

      const rewardsList = data.init_info.rewards.rewards_list;
      
      if (!Array.isArray(rewardsList) || rewardsList.length === 0) {
        showToast("No rewards found in JSON", "error");
        return;
      }

      // Clear current selection
      selectedIds.clear();
      customQuantities.clear();

      // Parse rewards and populate selection
      let loaded = 0;
      rewardsList.forEach(reward => {
        if (reward.type === "ITEM" && reward.item_name) {
          // Check if item exists in our catalog
          const itemExists = items.find(item => item.id === reward.item_name);
          if (itemExists) {
            selectedIds.add(reward.item_name);
            if (reward.quantity && reward.quantity > 1) {
              customQuantities.set(reward.item_name, reward.quantity);
            }
            loaded++;
          }
        }
      });

      if (loaded === 0) {
        showToast("No matching items found in catalog", "error");
        return;
      }

      // Update UI
      renderGrid();
      updateDetailPanel();
      updateSelectionBar();
      showToast(`Loaded ${loaded} items from JSON`);
      
    } catch (err) {
      console.error("JSON parse error:", err);
      showToast("Invalid JSON format", "error");
    }
  }

  // Debounce search input for performance
  let searchDebounce;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      applyFilters();
    }, 200);
  });
  
  categoryFilter.addEventListener("change", applyFilters);
  
  // Initialize language toggle from localStorage
  langToggle.checked = showRu;
  
  langToggle.addEventListener("change", () => {
    showRu = langToggle.checked;
    localStorage.setItem('darkest-afk-show-ru', showRu);
    renderGrid();
    updateDetailPanel();
  });
  
  // Density toggle
  densityToggle.addEventListener("change", () => {
    if (densityToggle.checked) {
      document.body.classList.add("compact-mode");
    } else {
      document.body.classList.remove("compact-mode");
    }
  });
  
  // Sort dropdown
  sortDropdown.addEventListener("change", () => {
    sortMode = sortDropdown.value;
    applyFilters();
  });

  // Help modal controls
  helpBtn.addEventListener("click", openHelpModal);
  closeHelpBtn.addEventListener("click", closeHelpModal);
  
  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) closeHelpModal();
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
        const count = selectedIds.size;
        selectedIds.clear();
        customQuantities.clear();
        lastSelectedIndex = -1;
        renderGrid();
        updateDetailPanel();
        updateSelectionBar();
        showToast(`Selection cleared (${count} items)`);
      } else if (searchInput.value) {
        searchInput.value = "";
        searchInput.focus();
        applyFilters();
      }
      return;
    }

    // Ctrl/Cmd + A: Select all filtered items
    if ((e.ctrlKey || e.metaKey) && e.key === "a" && document.activeElement !== searchInput) {
      e.preventDefault();
      saveToHistory();
      const beforeCount = selectedIds.size;
      filtered.forEach(item => selectedIds.add(item.id));
      const added = selectedIds.size - beforeCount;
      
      if (added > 0) {
        renderGrid();
        updateDetailPanel();
        updateSelectionBar();
        saveDraft();
        showToast(`Selected ${filtered.length} visible items`);
      }
      return;
    }

    // Ctrl/Cmd + Z: Undo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      if (undo()) {
        // Toast already shown in undo()
      } else {
        showToast("Nothing to undo", "error");
      }
      return;
    }

    // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo
    if (((e.ctrlKey || e.metaKey) && e.key === "y") || 
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")) {
      e.preventDefault();
      if (redo()) {
        // Toast already shown in redo()
      } else {
        showToast("Nothing to redo", "error");
      }
      return;
    }
  });

  // Empty state: Reset filters
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", () => {
      searchInput.value = "";
      categoryFilter.value = "";
      applyFilters();
      showToast("Filters reset");
    });
  }
  
  // Error state: Retry loading
  if (retryLoadBtn) {
    retryLoadBtn.addEventListener("click", () => {
      loadItems();
    });
  }
  
  /**
   * Show confirmation dialog for dangerous operations
   * @param {string} message - Confirmation message
   * @returns {boolean} - User confirmed
   */
  function confirmAction(message) {
    return window.confirm(message);
  }
  
  // Add confirmation to clear selection when many items selected
  const originalClearHandler = () => {
    if (selectedIds.size > 10) {
      if (!confirmAction(`Clear selection of ${selectedIds.size} items? This cannot be undone.`)) {
        return;
      }
    }
    
    const count = selectedIds.size;
    selectedIds.clear();
    customQuantities.clear();
    lastSelectedIndex = -1;
    renderGrid();
    updateDetailPanel();
    updateSelectionBar();
    showToast(`Selection cleared (${count} items)`);
  };

  // Initialize
  initSelectionBar();
  
  // Load draft if exists
  const draftLoaded = loadDraft();
  if (draftLoaded) {
    console.log('Draft loaded from localStorage');
  }
  
  // Save initial state to history
  saveToHistory();
  
  loadItems();
})();

