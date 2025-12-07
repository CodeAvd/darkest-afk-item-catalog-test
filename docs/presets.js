/**
 * Presets Management Module
 * Local storage with future API compatibility
 */

const STORAGE_KEY = 'dafk.presets';

/**
 * Load all presets from localStorage
 * @returns {Array} Array of preset objects
 */
export function loadPresets() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Failed to load presets:', err);
    return [];
  }
}

/**
 * Save presets array to localStorage
 * @param {Array} list - Array of preset objects
 */
function savePresets(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save presets:', err);
  }
}

/**
 * Create a new preset
 * @param {string} name - Preset name
 * @param {Array} items - Array of {itemId, quantity}
 * @param {Array} tags - Optional tags
 * @returns {Object} Created preset
 */
export function createPreset(name, items, tags = []) {
  const list = loadPresets();
  const now = Date.now();
  const preset = {
    id: crypto.randomUUID(),
    name,
    items: items.map(item => ({
      itemId: item.itemId || item.id,
      quantity: item.quantity || 1
    })),
    tags: tags.filter(Boolean),
    createdAt: now,
    updatedAt: now,
    version: 1
  };
  savePresets([preset, ...list]);
  return preset;
}

/**
 * Update existing preset
 * @param {string} id - Preset ID
 * @param {Object} patch - Fields to update
 */
export function updatePreset(id, patch) {
  const list = loadPresets().map(p => 
    p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p
  );
  savePresets(list);
}

/**
 * Delete preset by ID
 * @param {string} id - Preset ID
 */
export function deletePreset(id) {
  savePresets(loadPresets().filter(p => p.id !== id));
}

/**
 * Get preset by ID
 * @param {string} id - Preset ID
 * @returns {Object|null} Preset or null
 */
export function getPreset(id) {
  return loadPresets().find(p => p.id === id) || null;
}

/**
 * Duplicate preset
 * @param {string} id - Preset ID to duplicate
 * @returns {Object|null} New preset or null
 */
export function duplicatePreset(id) {
  const original = getPreset(id);
  if (!original) return null;
  
  return createPreset(
    original.name + ' (Copy)',
    original.items,
    original.tags
  );
}

/**
 * Search presets by name or tags
 * @param {string} query - Search query
 * @returns {Array} Filtered presets
 */
export function searchPresets(query) {
  if (!query) return loadPresets();
  
  const q = query.toLowerCase();
  return loadPresets().filter(p => 
    p.name.toLowerCase().includes(q) ||
    (p.tags || []).some(t => t.toLowerCase().includes(q))
  );
}

/**
 * Export presets to JSON string
 * @returns {string} JSON string
 */
export function exportPresets() {
  return JSON.stringify(loadPresets(), null, 2);
}

/**
 * Import presets from JSON string
 * @param {string} jsonString - JSON string
 * @param {boolean} merge - Merge with existing or replace
 * @returns {number} Number of imported presets
 */
export function importPresets(jsonString, merge = true) {
  try {
    const imported = JSON.parse(jsonString);
    if (!Array.isArray(imported)) {
      throw new Error('Invalid format: expected array');
    }
    
    // Validate structure
    const valid = imported.filter(p => 
      p.name && Array.isArray(p.items)
    );
    
    if (merge) {
      const existing = loadPresets();
      const existingIds = new Set(existing.map(p => p.id));
      const newPresets = valid.filter(p => !existingIds.has(p.id));
      savePresets([...newPresets, ...existing]);
      return newPresets.length;
    } else {
      savePresets(valid);
      return valid.length;
    }
  } catch (err) {
    console.error('Import failed:', err);
    throw err;
  }
}

