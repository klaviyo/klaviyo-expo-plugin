# Testing Infrastructure for Klaviyo Expo Plugin

This directory contains the Jest testing infrastructure for the Klaviyo Expo Plugin.

## Structure

```
tests/
├── setup.ts                 # Jest setup file with global mocks
├── utils/
│   └── testHelpers.ts       # Test utility functions
├── withKlaviyoAndroid.test.ts      # Main test suite for Android plugin
├── withKlaviyoPluginNameVersion.test.ts  # Tests for exported function
└── README.md               # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Configuration

The testing setup includes:

- **Jest Configuration**: Configured in `jest.config.js` at the project root
- **TypeScript Support**: Using `ts-jest` for TypeScript compilation
- **Mock Setup**: Comprehensive mocking of file system, path, glob, and XML operations
- **Test Utilities**: Helper functions for creating mock configurations and props

## Writing Tests

### Basic Test Structure

```typescript
import { withKlaviyoAndroid } from '../plugin/withKlaviyoAndroid';
import { createMockConfig, createMockProps } from './utils/testHelpers';

describe('withKlaviyoAndroid', () => {
  let mockConfig: any;
  let mockProps: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = createMockConfig();
    mockProps = createMockProps();
  });

  it('should handle basic configuration', () => {
    const result = withKlaviyoAndroid(mockConfig, mockProps);
    expect(result).toBeDefined();
  });
});
```

### Testing Individual Functions

For exported functions, you can test them directly:

```typescript
import { withKlaviyoPluginNameVersion } from '../plugin/withKlaviyoAndroid';

describe('withKlaviyoPluginNameVersion', () => {
  it('should add plugin name and version strings', () => {
    const mockConfig = {
      modResults: {
        resources: { string: [] }
      }
    };
    
    const result = withKlaviyoPluginNameVersion(mockConfig);
    expect(result).toBeDefined();
  });
});
```

### Using Test Utilities

The `testHelpers.ts` file provides utilities for:

- **createMockConfig()**: Create mock Expo config objects
- **createMockProps()**: Create mock plugin properties
- **createMockMainActivityContent()**: Create mock MainActivity file content
- **executePlugin()**: Execute plugin functions and handle async operations

### Mocking File System Operations

The setup automatically mocks file system operations. You can control the behavior:

```typescript
import * as fs from 'fs';

// Mock file exists
(fs.existsSync as jest.Mock).mockReturnValue(true);

// Mock file read
(fs.readFileSync as jest.Mock).mockReturnValue('file content');

// Mock file write
(fs.writeFileSync as jest.Mock).mockImplementation(() => {});
```

## Testing Patterns

### 1. Plugin Function Testing

Test that plugin functions return the expected type and handle various inputs:

```typescript
it('should return a function', () => {
  const result = withKlaviyoAndroid(mockConfig, mockProps);
  expect(typeof result).toBe('function');
});
```

### 2. Error Handling Testing

Test error conditions and edge cases:

```typescript
it('should throw error for missing Android package', () => {
  const configWithoutPackage = createMockConfig({ android: {} });
  expect(() => withKlaviyoAndroid(configWithoutPackage, mockProps)).toThrow();
});
```

### 3. Configuration Testing

Test different configuration scenarios:

```typescript
it('should handle missing application tag', () => {
  const configWithoutApp = createMockConfig({
    modResults: { manifest: {} }
  });
  
  const result = withKlaviyoAndroid(configWithoutApp, mockProps);
  expect(result).toBeDefined();
});
```

### 4. Integration Testing

Test the complete plugin composition:

```typescript
it('should compose all plugins correctly', () => {
  const result = withKlaviyoAndroid(mockConfig, mockProps);
  expect(result).toBeDefined();
  expect(typeof result).toBe('function');
});
```

## Coverage

The Jest configuration is set up to collect coverage from:

- All TypeScript files in the `plugin/` directory
- Excludes type definition files and type files
- Generates HTML, LCOV, and text coverage reports

## Best Practices

1. **Clear Test Names**: Use descriptive test names that explain what is being tested
2. **Setup and Teardown**: Use `beforeEach` to reset mocks and create fresh test data
3. **Mock Appropriately**: Mock external dependencies but test your actual logic
4. **Test Edge Cases**: Include tests for error conditions and boundary cases
5. **Group Related Tests**: Use `describe` blocks to organize related tests
6. **Use Test Utilities**: Leverage the provided test utilities for consistent mocking

## Adding New Tests

When adding tests for new functions:

1. Create a new test file or add to existing test file
2. Import the function to test
3. Set up appropriate mocks
4. Write tests covering normal operation and edge cases
5. Update this README if adding new test utilities or patterns 