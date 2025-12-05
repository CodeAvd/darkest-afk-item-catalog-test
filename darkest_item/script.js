(() => {
  const gridEl = document.getElementById("grid");
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const detailContent = document.getElementById("detailContent");
  const emptyState = document.getElementById("emptyState");
  const errorState = document.getElementById("errorState");
  const toast = document.getElementById("toast");
  const langToggle = document.getElementById("langToggle");

  let items = [];
  let filtered = [];
  let selectedIds = new Set(); // Changed to Set for multi-selection
  let showRu = false;

  async function loadItems() {
    try {
      const res = await fetch("items.json");
      if (!res.ok) throw new Error("Failed to load");
      items = await res.json();
      populateCategories(items);
      applyFilters();
    } catch (err) {
      console.error(err);
      errorState.hidden = false;
    }
  }

  function populateCategories(data) {
    const categories = Array.from(new Set(data.map((i) => i.category).filter(Boolean))).sort();
    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      categoryFilter.appendChild(opt);
    });
  }

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

  function renderGrid() {
    gridEl.innerHTML = "";
    if (!filtered.length) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    filtered.forEach((item) => {
      const card = document.createElement("div");
      card.className = "card";
      if (selectedIds.has(item.id)) card.classList.add("selected");
      card.addEventListener("click", () => toggleItemSelection(item.id));

      const img = document.createElement("img");
      img.src = item.image || "";
      img.alt = item.displayName || item.id;
      img.onerror = () => {
        img.replaceWith(fallbackIcon(item.id));
      };

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = showRu && item.displayNameRu ? item.displayNameRu : item.displayName || item.id;

      const nameRu = document.createElement("div");
      nameRu.className = "name-ru";
      if (showRu && item.displayName) {
        nameRu.textContent = item.displayName;
      } else if (!showRu && item.displayNameRu) {
        nameRu.textContent = item.displayNameRu;
      }

      const code = document.createElement("div");
      code.className = "code";
      code.textContent = item.id;

      card.append(img, name);
      if (nameRu.textContent) card.appendChild(nameRu);
      card.appendChild(code);
      gridEl.appendChild(card);
    });
  }

  function fallbackIcon(text) {
    const span = document.createElement("div");
    span.style.width = "64px";
    span.style.height = "64px";
    span.style.display = "grid";
    span.style.placeItems = "center";
    span.style.background = "#0b0d12";
    span.style.border = "1px solid var(--border)";
    span.style.borderRadius = "10px";
    span.style.color = "#9aa1b5";
    span.style.fontSize = "10px";
    span.style.textAlign = "center";
    span.style.padding = "6px";
    span.textContent = text;
    return span;
  }

  function toggleItemSelection(id) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    renderGrid();
    updateDetailPanel();
  }

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

    // Build init_info structure
    const initInfo = {
      init_info: {
        type: "COMMON",
        title: "To our dearest hero",
        message: "We apologize for the inconvenience you have encountered. Here is the compensation pack for you.",
        rewards: {
          rewards_list: selectedItems.map(item => ({
            type: "ITEM",
            item_name: item.id,
            quantity: item.defaultQuantity || 1
          }))
        }
      }
    };

    // Show selected items summary
    const summary = document.createElement("div");
    summary.style.marginBottom = "12px";
    summary.innerHTML = `<strong>Selected items:</strong> ${selectedItems.length}`;
    detailContent.appendChild(summary);

    // Show items list
    const itemsList = document.createElement("div");
    itemsList.style.marginBottom = "12px";
    itemsList.style.fontSize = "13px";
    itemsList.style.color = "var(--muted)";
    selectedItems.forEach(item => {
      const itemDiv = document.createElement("div");
      const displayName = showRu && item.displayNameRu ? item.displayNameRu : item.displayName || item.id;
      itemDiv.textContent = `• ${displayName} (x${item.defaultQuantity || 1})`;
      itemsList.appendChild(itemDiv);
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

  async function copyText(text) {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      showToast("Copied to clipboard");
    } catch (err) {
      console.error(err);
      showToast("Copy failed");
    }
  }

  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
      toast.hidden = true;
    }, 1600);
  }

  searchInput.addEventListener("input", applyFilters);
  categoryFilter.addEventListener("change", applyFilters);
  langToggle.addEventListener("change", () => {
    showRu = langToggle.checked;
    renderGrid();
    updateDetailPanel();
  });

  loadItems();
})();

