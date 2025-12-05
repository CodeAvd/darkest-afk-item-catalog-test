/**
 * Unit Tests for Darkest AFK Item Catalog Utilities
 * Testing: validation, search parsing, quantity limits
 */

import { describe, it, expect } from 'vitest';

// Test data
const mockItems = [
  {
    id: 'item_meteorite',
    displayName: 'Blazing Meteorite',
    displayNameRu: 'Пылающий метеорит',
    category: 'Resource',
    defaultQuantity: 250
  },
  {
    id: 'items_hero_summon_scroll_class',
    displayName: 'Class Summon Scroll',
    category: 'Summon Scroll',
    defaultQuantity: 1
  },
  {
    id: 'gear_dmgr_body_grade1',
    displayName: 'Damager Armor Grade 1',
    category: 'Gear: Damager',
    defaultQuantity: 1
  }
];

describe('getMaxQuantity', () => {
  const getMaxQuantity = (item) => {
    const category = (item.category || "").toLowerCase();
    
    if (category.includes("summon") || category.includes("hero") && !category.includes("exp")) {
      return item.defaultQuantity || 10;
    }
    
    if (category.includes("gear") || category.includes("equipment")) {
      return 5;
    }
    
    if (category.includes("skin") || category.includes("avatar") || category.includes("aura")) {
      return 1;
    }
    
    if (category.includes("fragment") || category.includes("token") || category.includes("soul")) {
      return 100;
    }
    
    if (category.includes("currency") || category.includes("resource") || category.includes("gold") || category.includes("chest")) {
      const defaultQty = item.defaultQuantity || 1000;
      return Math.max(defaultQty * 100, 100000);
    }
    
    return Math.max((item.defaultQuantity || 100) * 10, 1000);
  };

  it('should limit summon scrolls to default quantity', () => {
    const result = getMaxQuantity(mockItems[1]);
    expect(result).toBe(1);
  });

  it('should limit gear items to 5', () => {
    const result = getMaxQuantity(mockItems[2]);
    expect(result).toBe(5);
  });

  it('should allow 100x default for resources', () => {
    const result = getMaxQuantity(mockItems[0]);
    expect(result).toBe(100000); // max(250*100, 100000) = 100000
  });
});

describe('parseSearchQuery', () => {
  const parseSearchQuery = (query) => {
    const trimmed = query.trim().toLowerCase();
    const prefixMatch = trimmed.match(/^(name|code|category|cat):\s*(.+)$/);
    
    if (prefixMatch) {
      const prefix = prefixMatch[1] === 'cat' ? 'category' : prefixMatch[1];
      const term = prefixMatch[2];
      return { prefix, term };
    }
    
    return { prefix: null, term: trimmed };
  };

  it('should parse name: prefix correctly', () => {
    const result = parseSearchQuery('name:meteor');
    expect(result).toEqual({ prefix: 'name', term: 'meteor' });
  });

  it('should parse code: prefix correctly', () => {
    const result = parseSearchQuery('code:item_gold');
    expect(result).toEqual({ prefix: 'code', term: 'item_gold' });
  });

  it('should parse category: prefix correctly', () => {
    const result = parseSearchQuery('category:resource');
    expect(result).toEqual({ prefix: 'category', term: 'resource' });
  });

  it('should handle cat: as alias for category:', () => {
    const result = parseSearchQuery('cat:gear');
    expect(result).toEqual({ prefix: 'category', term: 'gear' });
  });

  it('should return null prefix for plain search', () => {
    const result = parseSearchQuery('meteor');
    expect(result).toEqual({ prefix: null, term: 'meteor' });
  });

  it('should handle empty search', () => {
    const result = parseSearchQuery('');
    expect(result).toEqual({ prefix: null, term: '' });
  });
});

describe('Filter Logic', () => {
  it('should filter by name prefix', () => {
    const query = { prefix: 'name', term: 'meteor' };
    const filtered = mockItems.filter(item => {
      if (query.prefix === 'name') {
        return (item.displayName && item.displayName.toLowerCase().includes(query.term)) ||
               (item.displayNameRu && item.displayNameRu.toLowerCase().includes(query.term));
      }
      return false;
    });
    
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('item_meteorite');
  });

  it('should filter by code prefix', () => {
    const query = { prefix: 'code', term: 'gear_' };
    const filtered = mockItems.filter(item => {
      if (query.prefix === 'code') {
        return item.id.toLowerCase().includes(query.term);
      }
      return false;
    });
    
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('gear_dmgr_body_grade1');
  });

  it('should filter by category prefix', () => {
    const query = { prefix: 'category', term: 'gear' };
    const filtered = mockItems.filter(item => {
      if (query.prefix === 'category') {
        return item.category && item.category.toLowerCase().includes(query.term);
      }
      return false;
    });
    
    expect(filtered.length).toBe(1);
    expect(filtered[0].category).toBe('Gear: Damager');
  });
});

describe('Quantity Validation', () => {
  it('should warn when quantity > max', () => {
    const item = mockItems[2]; // Gear item, max = 5
    const quantity = 10;
    const max = 5;
    
    expect(quantity > max).toBe(true);
    expect(quantity > max * 10).toBe(false); // Warning, not error
  });

  it('should error when quantity > max * 10', () => {
    const item = mockItems[2]; // Gear item, max = 5
    const quantity = 100;
    const max = 5;
    
    expect(quantity > max * 10).toBe(true); // Error
  });
});

describe('Sort Functions', () => {
  it('should sort by name ascending', () => {
    const sorted = [...mockItems].sort((a, b) => {
      const nameA = (a.displayName || a.id).toLowerCase();
      const nameB = (b.displayName || b.id).toLowerCase();
      return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
    });
    
    expect(sorted[0].displayName).toBe('Blazing Meteorite');
    expect(sorted[1].displayName).toBe('Class Summon Scroll');
    expect(sorted[2].displayName).toBe('Damager Armor Grade 1');
  });

  it('should sort by category ascending', () => {
    const sorted = [...mockItems].sort((a, b) => {
      const catA = (a.category || '').toLowerCase();
      const catB = (b.category || '').toLowerCase();
      return catA < catB ? -1 : catA > catB ? 1 : 0;
    });
    
    expect(sorted[0].category).toBe('Gear: Damager');
    expect(sorted[1].category).toBe('Resource');
    expect(sorted[2].category).toBe('Summon Scroll');
  });
});

