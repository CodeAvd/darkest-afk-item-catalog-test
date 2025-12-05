# Testing Guide - Darkest AFK Item Catalog

## Test Infrastructure

This project includes comprehensive testing at multiple levels:

### 🧪 Test Types

1. **Unit Tests** - Test individual functions and utilities
2. **Integration Tests** - Test component interactions and workflows  
3. **E2E Tests** - Test complete user flows in real browser

---

## Setup

### Install Dependencies

```bash
npm install
```

This installs:
- `vitest` - Fast unit test runner
- `@playwright/test` - E2E testing framework
- `happy-dom` - Lightweight DOM for unit tests
- `prettier` & `eslint` - Code quality tools

### Install Playwright Browsers

```bash
npx playwright install
```

---

## Running Tests

### Unit & Integration Tests

```bash
# Run all unit/integration tests
npm test

# Run with UI
npm run test:ui

# Run with coverage report
npm run test:coverage

# Watch mode
npm test -- --watch
```

### E2E Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run with UI (interactive)
npm run test:e2e:ui

# Run specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=mobile
```

---

## Test Coverage

### Unit Tests (`utils.test.js`)
- ✅ `getMaxQuantity()` - Validates quantity limits by category
- ✅ `parseSearchQuery()` - Parses search prefixes
- ✅ Filter logic with prefixes
- ✅ Quantity validation warnings/errors
- ✅ Sort functions (name, category)

### Integration Tests (`tests/integration.test.js`)
- ✅ Filter + search combination
- ✅ Selection tracking
- ✅ Custom quantity management
- ✅ JSON generation structure
- ✅ LocalStorage persistence

### E2E Tests (`tests/e2e/item-catalog.spec.js`)
- ✅ Page loads successfully
- ✅ Item selection/deselection
- ✅ Category filtering
- ✅ Search with prefixes (name:, code:, category:)
- ✅ Compact mode toggle
- ✅ Sorting dropdown
- ✅ Shift+Click range selection
- ✅ Quantity validation UI
- ✅ Empty state handling
- ✅ Language preference persistence
- ✅ Undo/redo with Ctrl+Z/Y
- ✅ JSON generation and copy
- ✅ Bulk clear confirmation
- ✅ Paste JSON feature
- ✅ Keyboard accessibility
- ✅ Mobile responsive design

**Total: 20+ comprehensive e2e scenarios**

---

## Test Reports

### Coverage Report
After running `npm run test:coverage`, open:
```
./coverage/index.html
```

### E2E Report
After running e2e tests, open:
```
./playwright-report/index.html
```

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

---

## Test Maintenance

### Adding New Tests

1. **Unit test** for utilities → Add to `utils.test.js`
2. **Integration test** for workflows → Add to `tests/integration.test.js`
3. **E2E test** for user flows → Add to `tests/e2e/item-catalog.spec.js`

### Best Practices

- ✅ Test behavior, not implementation
- ✅ Use descriptive test names
- ✅ Keep tests isolated and independent
- ✅ Mock external dependencies
- ✅ Aim for >80% code coverage
- ✅ Run tests before committing

---

## Debugging Tests

### Debug Unit Tests
```bash
npm test -- --reporter=verbose
```

### Debug E2E Tests
```bash
# Run with headed browser
npx playwright test --headed

# Debug specific test
npx playwright test --debug item-catalog.spec.js

# Step through with UI
npm run test:e2e:ui
```

---

## Test Utilities

### Manual Testing Checklist

- [ ] Search with prefixes (name:, code:, category:)
- [ ] Select items and verify JSON output
- [ ] Test quantity validation warnings
- [ ] Shift+Click for range selection
- [ ] Ctrl+A to select all
- [ ] Ctrl+Z/Y for undo/redo
- [ ] Compact mode toggle
- [ ] Sorting (all 4 modes)
- [ ] Language toggle + persistence
- [ ] Empty/error states
- [ ] Mobile responsive (375px width)
- [ ] Keyboard navigation (Tab, Enter, Space, Esc)

---

## Performance Testing

### Lighthouse Audit
```bash
# Install Lighthouse
npm install -g lighthouse

# Run audit
lighthouse http://localhost:8080/index.html --view
```

### Performance Metrics to Monitor
- Time to Interactive (TTI): < 3s
- First Contentful Paint (FCP): < 1.5s  
- Cumulative Layout Shift (CLS): < 0.1
- Total Blocking Time (TBT): < 200ms

---

## Browser Compatibility

### Tested & Supported
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile Safari (iOS 14+)
- ✅ Chrome Mobile (Android 10+)

---

## Known Issues

None at this time! 🎉

Report bugs with:
- Browser version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)

