import { test, expect } from '@playwright/test';

test.describe('Darkest AFK Item Catalog - E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('.item-grid');
  });

  test('should load items successfully', async ({ page }) => {
    // Check that items are loaded
    const items = await page.locator('.card').count();
    expect(items).toBeGreaterThan(0);
    
    // Check for compensation panel
    await expect(page.locator('.detail-panel')).toBeVisible();
  });

  test('should select and deselect items', async ({ page }) => {
    // Click first item
    const firstCard = page.locator('.card').first();
    await firstCard.click();
    
    // Verify selection
    await expect(firstCard).toHaveClass(/selected/);
    
    // Check selection bar appears
    await expect(page.locator('#selectionBar')).toHaveClass(/visible/);
    
    // Deselect
    await firstCard.click();
    await expect(firstCard).not.toHaveClass(/selected/);
  });

  test('should filter by category', async ({ page }) => {
    // Select category
    await page.selectOption('#categoryFilter', { label: 'Resource' });
    
    // Wait for filter to apply
    await page.waitForTimeout(300);
    
    // Check filtered results
    const cards = await page.locator('.card').count();
    expect(cards).toBeGreaterThan(0);
  });

  test('should search with name: prefix', async ({ page }) => {
    // Enter search with prefix
    await page.fill('#searchInput', 'name:meteor');
    
    // Wait for debounce
    await page.waitForTimeout(250);
    
    // Check results
    const cards = await page.locator('.card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    
    // Verify at least one card contains "meteor" in name
    const firstCardName = await cards.first().locator('.name').textContent();
    expect(firstCardName.toLowerCase()).toContain('meteor');
  });

  test('should search with code: prefix', async ({ page }) => {
    await page.fill('#searchInput', 'code:item_gold');
    await page.waitForTimeout(250);
    
    const cards = await page.locator('.card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should toggle compact mode', async ({ page }) => {
    // Get initial card size
    const card = page.locator('.card').first();
    const initialBox = await card.boundingBox();
    
    // Toggle compact
    await page.check('#densityToggle');
    await page.waitForTimeout(300);
    
    // Check body has compact class
    const bodyClass = await page.locator('body').getAttribute('class');
    expect(bodyClass).toContain('compact-mode');
    
    // Card should be smaller
    const compactBox = await card.boundingBox();
    expect(compactBox.height).toBeLessThan(initialBox.height);
  });

  test('should sort items', async ({ page }) => {
    // Get first item name
    const firstNameBefore = await page.locator('.card').first().locator('.name').textContent();
    
    // Change sort to Z→A
    await page.selectOption('#sortDropdown', 'name-desc');
    await page.waitForTimeout(300);
    
    // First item should be different
    const firstNameAfter = await page.locator('.card').first().locator('.name').textContent();
    expect(firstNameAfter).not.toBe(firstNameBefore);
  });

  test('should select range with shift+click', async ({ page }) => {
    // Click first item
    await page.locator('.card').nth(0).click();
    
    // Shift+click fifth item
    await page.locator('.card').nth(4).click({ modifiers: ['Shift'] });
    
    // Wait for updates
    await page.waitForTimeout(300);
    
    // Check selection bar shows 5 items
    const badge = await page.locator('.selection-count-badge').textContent();
    expect(parseInt(badge)).toBe(5);
  });

  test('should show validation warning for high quantity', async ({ page }) => {
    // Select an item
    await page.locator('.card').first().click();
    await page.waitForTimeout(300);
    
    // Find quantity input in detail panel
    const qtyInput = page.locator('.qty-input').first();
    
    // Enter very high quantity
    await qtyInput.fill('999999');
    await qtyInput.blur();
    
    // Check for validation class
    const inputClass = await qtyInput.getAttribute('class');
    expect(inputClass).toMatch(/warning|error/);
  });

  test('should show empty state when no results', async ({ page }) => {
    // Search for non-existent item
    await page.fill('#searchInput', 'xyznonexistent123');
    await page.waitForTimeout(250);
    
    // Check empty state is visible
    await expect(page.locator('#emptyState')).toBeVisible();
    await expect(page.locator('#emptyState h3')).toContainText('No items found');
  });

  test('should reset filters from empty state', async ({ page }) => {
    // Create empty state
    await page.fill('#searchInput', 'xyznonexistent123');
    await page.waitForTimeout(250);
    
    // Click reset button
    await page.click('#resetFiltersBtn');
    await page.waitForTimeout(300);
    
    // Items should be visible again
    const items = await page.locator('.card').count();
    expect(items).toBeGreaterThan(0);
  });

  test('should persist language preference', async ({ page }) => {
    // Toggle Russian
    await page.check('#langToggle');
    
    // Reload page
    await page.reload();
    await page.waitForSelector('.item-grid');
    
    // Check toggle is still checked
    const isChecked = await page.locator('#langToggle').isChecked();
    expect(isChecked).toBe(true);
  });

  test('should undo/redo selections with keyboard', async ({ page }) => {
    // Select first item
    await page.locator('.card').first().click();
    await page.waitForTimeout(200);
    
    // Undo with Ctrl+Z
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    
    // Check selection cleared
    const selected = await page.locator('.card.selected').count();
    expect(selected).toBe(0);
    
    // Redo with Ctrl+Y
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);
    
    // Check selection restored
    const reselected = await page.locator('.card.selected').count();
    expect(reselected).toBe(1);
  });

  test('should generate and copy JSON', async ({ page }) => {
    // Select items
    await page.locator('.card').first().click();
    await page.waitForTimeout(300);
    
    // Click copy JSON button in panel
    await page.click('text=Copy init_info JSON');
    
    // Check toast appears
    await expect(page.locator('.toast')).toHaveClass(/show/);
  });

  test('should show confirmation for bulk clear', async ({ page }) => {
    // Select many items with Ctrl+A
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(300);
    
    // Setup dialog handler
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Clear selection');
      dialog.accept();
    });
    
    // Try to clear
    await page.click('text=Clear selection');
  });

  test('should toggle paste JSON section', async ({ page }) => {
    // Select an item first
    await page.locator('.card').first().click();
    await page.waitForTimeout(300);
    
    // Find paste JSON toggle
    const pasteToggle = page.locator('.paste-json-toggle');
    await pasteToggle.click();
    
    // Check content is visible
    await expect(page.locator('.paste-json-content')).toHaveClass(/expanded/);
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Tab through controls
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be able to navigate
    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
    expect(['INPUT', 'SELECT', 'LABEL', 'A', 'BUTTON']).toContain(focusedElement);
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Page should still work
    const items = await page.locator('.card').count();
    expect(items).toBeGreaterThan(0);
    
    // Should show 1 column grid on mobile
    const grid = page.locator('.item-grid');
    await expect(grid).toBeVisible();
  });
});

