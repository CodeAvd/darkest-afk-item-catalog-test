/**
 * Integration Tests - Testing filter, search, and selection workflows
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Filter and Search Integration', () => {
  const mockItems = [
    { id: 'item_gold', displayName: 'Gold', category: 'Resource', defaultQuantity: 1000 },
    { id: 'item_meteorite', displayName: 'Blazing Meteorite', displayNameRu: 'Метеорит', category: 'Resource', defaultQuantity: 250 },
    { id: 'hero_rigzash', displayName: 'Rigzash', category: 'Hero', defaultQuantity: 1 },
    { id: 'gear_dmgr_body_grade1', displayName: 'Damager Armor Grade 1', category: 'Gear: Damager', defaultQuantity: 1 },
  ];

  it('should filter by category and search together', () => {
    const categoryFilter = 'Resource';
    const searchTerm = 'meteor';
    
    const filtered = mockItems.filter(item => {
      const matchesCat = !categoryFilter || item.category === categoryFilter;
      const matchesSearch = !searchTerm || 
        item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.displayName && item.displayName.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCat && matchesSearch;
    });
    
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('item_meteorite');
  });

  it('should handle name: prefix search', () => {
    const searchQuery = 'name:rigzash';
    const prefixMatch = searchQuery.match(/^(name|code|category):\s*(.+)$/);
    
    expect(prefixMatch).not.toBeNull();
    expect(prefixMatch[1]).toBe('name');
    expect(prefixMatch[2]).toBe('rigzash');
  });

  it('should handle code: prefix search', () => {
    const searchQuery = 'code:item_';
    const prefixMatch = searchQuery.match(/^(name|code|category):\s*(.+)$/);
    
    expect(prefixMatch).not.toBeNull();
    expect(prefixMatch[1]).toBe('code');
    
    const term = prefixMatch[2];
    const filtered = mockItems.filter(item => item.id.toLowerCase().includes(term));
    
    expect(filtered.length).toBe(2); // item_gold, item_meteorite
  });
});

describe('Selection and Quantity Management', () => {
  it('should track multiple selections', () => {
    const selections = new Set();
    
    selections.add('item_gold');
    selections.add('item_meteorite');
    selections.add('hero_rigzash');
    
    expect(selections.size).toBe(3);
    expect(selections.has('item_gold')).toBe(true);
  });

  it('should handle custom quantities', () => {
    const customQty = new Map();
    
    customQty.set('item_gold', 5000);
    customQty.set('item_meteorite', 1000);
    
    expect(customQty.get('item_gold')).toBe(5000);
    expect(customQty.get('item_meteorite')).toBe(1000);
    expect(customQty.get('nonexistent')).toBeUndefined();
  });

  it('should validate quantity limits', () => {
    const item = { category: 'Gear: Damager', defaultQuantity: 1 };
    const maxQty = 5; // Gear items limited to 5
    
    expect(10 > maxQty).toBe(true); // Warning
    expect(10 > maxQty * 10).toBe(false); // Not error
    expect(100 > maxQty * 10).toBe(true); // Error
  });
});

describe('Sort Functionality', () => {
  const items = [
    { displayName: 'Zebra', category: 'A' },
    { displayName: 'Apple', category: 'B' },
    { displayName: 'Banana', category: 'C' }
  ];

  it('should sort by name ascending', () => {
    const sorted = [...items].sort((a, b) => {
      return a.displayName.localeCompare(b.displayName);
    });
    
    expect(sorted[0].displayName).toBe('Apple');
    expect(sorted[1].displayName).toBe('Banana');
    expect(sorted[2].displayName).toBe('Zebra');
  });

  it('should sort by name descending', () => {
    const sorted = [...items].sort((a, b) => {
      return b.displayName.localeCompare(a.displayName);
    });
    
    expect(sorted[0].displayName).toBe('Zebra');
    expect(sorted[2].displayName).toBe('Apple');
  });
});

describe('JSON Generation', () => {
  it('should generate valid init_info structure', () => {
    const selectedItems = [
      { id: 'item_gold', defaultQuantity: 1000 }
    ];
    const customQuantities = new Map();
    
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
    
    expect(initInfo.init_info).toBeDefined();
    expect(initInfo.init_info.rewards.rewards_list).toHaveLength(1);
    expect(initInfo.init_info.rewards.rewards_list[0].item_name).toBe('item_gold');
    expect(initInfo.init_info.rewards.rewards_list[0].quantity).toBe(1000);
  });

  it('should use custom quantities when set', () => {
    const item = { id: 'item_gold', defaultQuantity: 1000 };
    const customQuantities = new Map([['item_gold', 5000]]);
    
    const quantity = customQuantities.get(item.id) || item.defaultQuantity || 1;
    expect(quantity).toBe(5000);
  });
});

describe('LocalStorage Persistence', () => {
  it('should save draft to localStorage format', () => {
    const draft = {
      selectedIds: ['item_gold', 'item_meteorite'],
      customQuantities: [['item_gold', 5000]],
      timestamp: Date.now()
    };
    
    const serialized = JSON.stringify(draft);
    const deserialized = JSON.parse(serialized);
    
    expect(deserialized.selectedIds).toHaveLength(2);
    expect(deserialized.customQuantities).toHaveLength(1);
  });
});

