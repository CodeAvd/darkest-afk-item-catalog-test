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
  let selectedId = null;
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
      if (item.id === selectedId) card.classList.add("selected");
      card.addEventListener("click", () => selectItem(item.id));

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

  function selectItem(id) {
    selectedId = id;
    renderGrid();
    const item = items.find((i) => i.id === id);
    if (!item) return;
    detailContent.innerHTML = "";

    const nameRow = row("Name", showRu && item.displayNameRu ? item.displayNameRu : item.displayName || item.id);
    const altName = showRu ? item.displayName : item.displayNameRu;
    if (altName) nameRow.querySelector(".value").appendChild(subText(altName));

    const catRow = row("Category", item.category || "—");
    const codeRow = row("Internal code", codeMono(item.id));
    const qtyRow = item.defaultQuantity ? row("Default qty", item.defaultQuantity) : null;

    const codeBlock = document.createElement("pre");
    codeBlock.className = "code-block";
    codeBlock.textContent = item.codeSnippet || "";

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(
      actionButton("Copy item code", () => copyText(item.id)),
      actionButton("Copy JSON snippet", () => copyText(item.codeSnippet || ""))
    );

    detailContent.append(nameRow, catRow, codeRow);
    if (qtyRow) detailContent.appendChild(qtyRow);
    detailContent.append(codeBlock, actions);
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
    if (selectedId) selectItem(selectedId);
  });

  loadItems();
})();

