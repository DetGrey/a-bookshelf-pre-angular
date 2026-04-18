# Bookshelf App Test Suite

This directory contains all automated tests for the bookshelf application.

## Files

- **`setup.js`** - Test environment configuration (imports testing libraries)
- **`mocks.js`** - Mock data and helper functions used in tests
- **`validation.test.js`** - Quick validation tests (imports, logic, filters)
- **`components.test.js`** - Bookshelf component integration tests
- **`pages.test.js`** - All page tests (Dashboard, AddBook, BookDetails, Login, Signup)
- **`edge-cases.test.js`** - Auth flows and data validation edge cases

## Quick Start

### Run all tests
```bash
cd frontend
npm test
```

### Run in watch mode (auto-rerun on changes)
```bash
npm test -- --watch
```

### Open visual test dashboard
```bash
npm test:ui
```

### Run specific test file
```bash
npm test -- pages.test.js
npm test -- edge-cases.test.js
```

## What Gets Tested

### Validation Tests (`validation.test.js`) - ~1-2 seconds
**Quick sanity checks:**
- ✅ Imports work (no broken imports)
- ✅ STATUS object complete (all statuses defined)
- ✅ Functions exist and work (truncateText, etc.)
- ✅ Update check guardrails (skip empty payloads, skip unchanged payloads, update on real changes)
- ✅ Array operations work properly
- ✅ Null/undefined handling
- ✅ No accidental mutations
- ✅ Filter logic correct (ANY vs ALL)

### Component Tests (`components.test.js`) - ~2-5 seconds
**Bookshelf component:**
- ✅ BookCard gets all required props
- ✅ activeGenres and setActiveGenres work correctly
- ✅ Genre filtering (ANY mode - any genre matches)
- ✅ Genre filtering (ALL mode - all genres must match)
- ✅ Status filtering (by waiting, reading, etc.)
- ✅ Text truncation (15 words + ellipsis)
- ✅ Genre pills maintain shape consistency
- ✅ Card text doesn't overflow

### Page Tests (`pages.test.js`) - ~5-10 seconds
**All application pages:**
- ✅ Dashboard loads and groups books by status
- ✅ AddBook handles URL fetching and form validation
- ✅ BookDetails loads book by ID and handles editing
- ✅ Login validates email/password format
- ✅ Signup requires password confirmation
- ✅ All pages handle null/missing data
- ✅ Navigation between pages works
- ✅ Datetime formatting works correctly
- ✅ Genre parsing from comma-separated strings

### Edge Cases & Auth (`edge-cases.test.js`) - ~5-10 seconds
**Complex scenarios:**
- ✅ Login flow (empty fields, invalid credentials, redirect)
- ✅ Signup flow (password requirements, confirmation, existing email)
- ✅ Protected routes (redirect unauthenticated users)
- ✅ Book management (add, update, delete with confirmation)
- ✅ Genre handling (special chars, duplicates, trimming)
- ✅ Input validation (URLs, emails, titles)
- ✅ Date handling (format, null safety, future dates)
- ✅ Status transitions (any status change allowed)
- ✅ Waiting books refresh (check updates button logic)

### Component Tests (`components.test.js`)
These are **integration** tests that check component behavior:
- ✅ BookCard gets all required props
- ✅ Props are used correctly (activeGenres, setActiveGenres, etc.)
- ✅ Genre filtering works (ANY mode - matches any genre)
- ✅ Genre filtering works (ALL mode - matches all genres)
- ✅ Status filtering works (waiting, reading, etc.)
- ✅ Text truncation (15 words + ellipsis)
- ✅ UI elements exist and work
- ✅ Data structures are correct

**Time to run:** ~2-5 seconds

## 🐛 Bugs These Tests Catch

The tests specifically look for bugs based on what you've experienced:

1. **Missing Props Errors**
   ```
   ❌ activeGenres not defined
   ❌ setActiveGenres not defined
   ✅ Tests verify these are always passed and defined
   ```

2. **Undefined Variables**
   ```
   ❌ Cannot read property of undefined
   ✅ Tests check optional chaining and null safety
   ```

3. **Filter Logic Mistakes**
   ```
   ❌ Using .filter() instead of .some() for ANY mode
   ❌ Using .some() instead of .every() for ALL mode
   ✅ Tests verify correct array methods used
   ```

4. **State Mutations**
   ```
   ❌ activeGenres.push(genre)  // Mutating original
   ✅ [...activeGenres, genre]  // Creating new array
   ✅ Tests verify immutability patterns
   ```

5. **Missing Imports**
   ```
   ❌ STATUS.waiting is undefined
   ✅ Tests verify all exports exist and have correct structure
   ```

6. **UI Issues**
   ```
   ❌ Text overflow breaking card layout
   ✅ Tests verify word-break CSS applied
   ```

## Test Structure

Each test follows this pattern:

```javascript
describe('Category', () => {
  describe('Specific behavior', () => {
    it('should do something specific', () => {
      // Arrange - set up test data
      const input = 'test'
      
      // Act - run the code
      const result = myFunction(input)
      
      // Assert - verify result
      expect(result).toBe('expected')
    })
  })
})
```

## Adding New Tests

When you find and fix a bug, add a test to prevent it from happening again.

### Step 1: Identify which file to add to
- **Logic/filter bug** → `validation.test.js`
- **Component/props bug** → `components.test.js`

### Step 2: Write the test
```javascript
it('should handle activeGenres as undefined', () => {
  const activeGenres = undefined
  // This should not throw an error
  expect(activeGenres?.includes?.('test')).toBeFalsy()
})
```

### Step 3: Run tests to verify
```bash
npm test
```

## Test Output

### All tests passing ✅
```
✓ validation.test.js (10)
✓ components.test.js (12)

Tests  22 passed (22)
Time   2.5s
```

### Test failing ❌
```
✗ components.test.js > BookCard Component Props > should accept all required props
  AssertionError: expected undefined to be a function
  
  at components.test.js:45:12
```

The error shows:
- Which test file
- Which test group
- Which specific test
- What failed and why

## Usage Tips

### Before saving changes
```bash
npm test  # Make sure everything still works
```

### While developing
```bash
npm test -- --watch  # Auto-rerun tests as you code
```

### Visual debugging
```bash
npm test:ui  # Easier to see what failed
```

### Run just one file
```bash
npm test -- validation.test.js
npm test -- components.test.js
```

### Run just one test
```bash
npm test -- --grep "should handle activeGenres"
```

## 🔄 Test Files Checklist

When making changes:

- [ ] Run `npm test` - verify all tests pass
- [ ] Run `npm test -- --watch` - check while developing
- [ ] Add test if you fix a bug
- [ ] Run `npm run build` - verify no compile errors
- [ ] Ready to deploy! ✅

## Mocks and Test Data

The `mocks.js` file provides:
- **mockBooks** - Sample book data for testing
- **STATUS** - Status constants (reading, waiting, etc.)
- **truncateText** - Text truncation helper

These are used in tests so you don't need real database data.

## Environment Setup

The `setup.js` file:
- Imports testing utilities (jest-dom matchers, etc.)
- Configures jsdom environment (fake browser)
- Registers global test functions

You don't need to modify this unless adding new test libraries.

## Common Test Commands

```bash
# Run all tests once
npm test

# Run with auto-reload on file changes
npm test -- --watch

# Open interactive dashboard
npm test:ui

# Run specific test file
npm test -- validation.test.js

# Run tests matching pattern
npm test -- --grep "filter"

# Show code coverage percentage
npm test -- --coverage

# Clear test cache
npm test -- --clearCache
```

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Run tests: `npm test`
3. ✅ See all tests pass
4. ✅ Before committing: run `npm test`
5. ✅ When fixing bugs: add tests to prevent regressions

## Need Help?

- Check the test output for specific error messages
- Run `npm test:ui` for visual debugging
- Look at existing tests as examples
- See `../TESTING.md` for detailed documentation
