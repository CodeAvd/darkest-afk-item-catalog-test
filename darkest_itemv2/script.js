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
  const selectAllBtn = document.getElementById("selectAllBtn");
  const deselectAllBtn = document.getElementById("deselectAllBtn");
  const visibleCount = document.getElementById("visibleCount");
  const loadingSkeleton = document.getElementById("loadingSkeleton");
  const helpBtn = document.getElementById("helpBtn");
  const helpModal = document.getElementById("helpModal");
  const closeHelpBtn = document.getElementById("closeHelpBtn");

  // Application state
  let items = [];                    // All items from JSON
  let filtered = [];                 // Currently filtered items
  let selectedIds = new Set();       // Selected item IDs
  let showRu = false;                // Language toggle state
  const customQuantities = new Map(); // Custom quantity overrides

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
    
    // Update visible count for bulk actions
    visibleCount.textContent = filtered.length;
    
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
    name.textContent = showRu && item.displayNameRu 
      ? item.displayNameRu 
      : item.displayName || item.id;

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
      
      qtyInput.addEventListener("change", (e) => {
        const newQty = parseInt(e.target.value) || item.defaultQuantity || 1;
        if (newQty === item.defaultQuantity) {
          customQuantities.delete(item.id);
        } else {
          customQuantities.set(item.id, newQty);
        }
        updateDetailPanel();
      });
      
      qtyControl.appendChild(qtyInput);
      itemRow.append(nameSpan, qtyControl);
      itemsList.appendChild(itemRow);
    });
    detailContent.appendChild(itemsList);

    // JSON code block
    const codeBlock = document.createElement("pre");
    codeBlock.className = "code-block";
    codeBlock.textContent = JSON.stringify(initInfo, null, 2);
    detailContent.appendChild(codeBlock);

    // Actions
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(
      actionButton("Copy init_info JSON", () => copyText(JSON.stringify(initInfo, null, 2))),
      actionButton("Clear selection", () => {
        selectedIds.clear();
        customQuantities.clear();
        renderGrid();
        updateDetailPanel();
      })
    );
    detailContent.appendChild(actions);
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

  searchInput.addEventListener("input", applyFilters);
  categoryFilter.addEventListener("change", applyFilters);
  langToggle.addEventListener("change", () => {
    showRu = langToggle.checked;
    renderGrid();
    updateDetailPanel();
  });

  // Bulk action: Select all visible items
  selectAllBtn.addEventListener("click", () => {
    const beforeCount = selectedIds.size;
    filtered.forEach(item => selectedIds.add(item.id));
    const added = selectedIds.size - beforeCount;
    renderGrid();
    updateDetailPanel();
    if (added > 0) {
      showToast(`Added ${added} items to selection`);
    }
  });

  // Bulk action: Deselect all items
  deselectAllBtn.addEventListener("click", () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    selectedIds.clear();
    renderGrid();
    updateDetailPanel();
    showToast(`Cleared ${count} items`);
  });

  // Help modal controls
  helpBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openHelpModal();
  });
  
  closeHelpBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeHelpModal();
  });
  
  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) {
      e.preventDefault();
      closeHelpModal();
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
    if (e.key === "?" && helpModal.hidden) {
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

    // Ctrl/Cmd + A: Select all visible items
    if ((e.ctrlKey || e.metaKey) && e.key === "a" && document.activeElement !== searchInput) {
      e.preventDefault();
      filtered.forEach(item => selectedIds.add(item.id));
      renderGrid();
      updateDetailPanel();
      showToast(`Selected ${filtered.length} items`);
      return;
    }
  });

  loadItems();
})();

