# Testing Guide

This project uses **Vitest** with **React Testing Library** to catch bugs before deployment.

## Installation

Before running tests for the first time, install the test dependencies:

```bash
cd frontend
npm install
```

This will install Vitest, React Testing Library, and related packages defined in `package.json`.

## Quick Start

### Run all tests once
```bash
npm test
```

### Run tests in watch mode (recommended while developing)
```bash
npm test -- --watch
```

### Open interactive test dashboard
```bash
npm test:ui
```

### Run a specific test file
```bash
npm test -- src/test/validation.test.js
```

### Run tests matching a pattern
```bash
npm test -- --grep "filter"
```

## Test Files Overview

### `src/test/validation.test.js`
**Quick validation checks** - The fastest tests to run, catch basic errors

What it tests:
- ✅ All imports work and files exist
- ✅ STATUS object has all required statuses (reading, completed, waiting, etc.)
- ✅ truncateText function works correctly
- ✅ Update check guardrails (skip empty payloads, skip unchanged payloads, update when either latest chapter or upload time changes)
- ✅ Array methods work properly (`.some()`, `.every()`, `.filter()`, `.includes()`)
- ✅ Optional chaining and null safety
- ✅ Array immutability (not mutating original data)
- ✅ Filter logic for ANY mode (`.some()`)
- ✅ Filter logic for ALL mode (`.every()`)

**Run before deployment** - catches import errors and logic mistakes

### `src/test/components.test.js`
**Component integration tests** - More comprehensive testing

What it tests:
- ✅ BookCard component accepts all required props without errors
- ✅ activeGenres and setActiveGenres props work correctly
- ✅ Genre filtering in ANY mode (books matching ANY selected genre)
- ✅ Genre filtering in ALL mode (books matching ALL selected genres)
- ✅ Status filtering (filtering by "waiting" status, etc.)
- ✅ Check updates button only shows on waiting shelf
- ✅ Text truncation to 15 words with ellipsis
- ✅ Scroll to top functionality
- ✅ Genres are individual items, not comma-separated strings
- ✅ Genre pills maintain consistent shape (8px border-radius)
- ✅ Card text doesn't overflow (word-break works)

**Run to test component interactions**

## Common Issues These Tests Catch

Based on bugs you've had, these tests will catch:

1. **Missing Props** 
   - Like `activeGenres` not being passed to BookCard
   - Tests verify all required props are defined

2. **Undefined Variables**
   - Tests check that setActiveGenres, activeGenres, etc. are defined before use

3. **Wrong Array Methods**
   - Using `.filter()` when you should use `.some()` or `.every()`
   - Tests validate the correct method is used for each case

4. **State Mutations**
   - Modifying arrays directly instead of creating new ones
   - Tests check immutability patterns

5. **Missing Imports**
   - STATUS object missing entries
   - Broken imports in components

6. **Filter Logic Errors**
   - ANY vs ALL filtering not working correctly

7. **Text Overflow**
   - Long titles/descriptions breaking the card layout

## Workflow Examples

### Before committing code:
```bash
npm test          # Run all tests
npm run lint      # Check for style issues (eslint)
npm run build     # Build to check for compilation errors
```

### While developing a feature:
```bash
npm test -- --watch   # Tests re-run automatically when you save files
```

### Debugging a test failure:
```bash
npm test:ui           # Open interactive dashboard to see failures visually
```

### After fixing a bug:
```bash
npm test              # Verify the fix works
# Then add a test case so it doesn't happen again
```

## Adding New Tests

When you find and fix a bug, add a test to prevent it from happening again.

### Test file structure:
```javascript
import { describe, it, expect, vi } from 'vitest'

describe('Feature Name', () => {
  describe('Specific behavior', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test data'
      
      // Act
      const result = myFunction(input)
      
      // Assert
      expect(result).toBe('expected output')
    })
  })
})
```

### Where to add tests:
- **Component/UI bugs** → `src/test/components.test.js`
- **Logic/filtering bugs** → `src/test/validation.test.js`
- **New feature tests** → Create `src/test/featureName.test.js`

### Example: Adding a test for the activeGenres bug:
```javascript
it('should not throw error when activeGenres is undefined', () => {
  expect(() => {
    const result = activeGenres?.filter(g => g === 'test')
  }).not.toThrow()
})
```

## Test Commands Reference

| Command | Time | Purpose |
|---------|------|---------|
| `npm test` | ~2-5s | Run all tests once |
| `npm test -- --watch` | continuous | Auto-rerun on file changes |
| `npm test:ui` | ~5s + browser | Visual test dashboard |
| `npm test -- validation` | ~1-2s | Run only validation tests |
| `npm test -- --coverage` | ~5-10s | Show code coverage % |

## Understanding Test Output

When you run `npm test`, you'll see:

```
✓ src/test/validation.test.js (12 tests)
✓ src/test/components.test.js (10 tests)

Test Files  2 passed (2)
     Tests  22 passed (22)
```

Green checkmarks = all passing ✅  
Red X = test failed ❌

If a test fails, it shows:
- The test name
- What was expected vs what happened
- The code that failed

## Best Practices

1. **Run tests frequently**
   - After making changes to components
   - Before pushing code
   - Daily during development

2. **Keep tests simple**
   - One test = one thing to verify
   - Clear test names describing what it does

3. **Add tests for bugs**
   - Every time you fix a bug, write a test for it
   - Prevents the same bug from happening again

4. **Use watch mode**
   - `npm test -- --watch` while developing
   - Instant feedback on your changes

5. **Check coverage**
   - See which code paths are tested
   - `npm test -- --coverage`

## Troubleshooting

### "Cannot find module" error
```bash
npm install  # Make sure dependencies are installed
```

### Tests not running
```bash
npm test     # Try running from frontend/ directory
```

### Tests pass locally but fail in CI/CD
- Make sure you're using Node.js version 16+
- Run `npm install` to sync dependencies

### Need to clear test cache
```bash
npm test -- --clearCache
```

## CI/CD Integration

To run tests automatically before deployment, add to your CI/CD pipeline:
```bash
npm install
npm test
npm run build
```

This ensures no bugs are deployed.

## Tips

- 💡 Use `npm test:ui` when debugging test failures - it's much easier to see what went wrong
- 🔄 Watch mode is your friend - keeps tests running as you code
- 📝 Write tests as you write features, not after
- 🎯 Add a test every time you find a bug
- ⚡ Quick tests (validation.test.js) run before deployment
