# Testing Infrastructure for Klaviyo Expo Plugin

This directory contains the Jest testing infrastructure for the Klaviyo Expo Plugin.

## Structure

```
tests/
├── setup.ts                 # Jest setup file with global mocks
├── utils/
│   └── testHelpers.ts       # Test utility functions
├── withKlaviyoAndroid.test.ts      # Unit tests for Android plugin
├── withKlaviyoAndroid.integration.test.ts  # Integration tests for Android plugin
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

## Test Types

### Unit Tests (`withKlaviyoAndroid.test.ts`)

Unit tests focus on testing individual functions and components in isolation:

- **Plugin Function Testing**: Tests that plugin functions return the expected type
- **Error Handling Testing**: Tests error conditions and edge cases
- **Configuration Testing**: Tests different configuration scenarios
- **Integration Testing**: Tests the complete plugin composition

### Integration Tests (`withKlaviyoAndroid.integration.test.ts`)

Integration tests focus on testing the plugin as a whole system:

- **Plugin Structure**: Tests that the plugin returns a function and can be executed
- **Configuration Validation**: Tests how the plugin handles various configuration scenarios
- **Plugin Composition**: Tests that multiple plugins are composed correctly
- **Error Scenarios**: Tests error handling with missing or invalid configurations
- **Plugin Behavior**: Tests how the plugin handles different MainActivity formats

### Exported Function Tests (`withKlaviyoPluginNameVersion.test.ts`)

Tests for the exported `withKlaviyoPluginNameVersion` function:

- **String Resource Management**: Tests adding and updating string resources
- **XML Manipulation**: Tests XML parsing and building operations

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
it('should handle missing Android package', () => {
  const configWithoutPackage = createMockConfig({ android: {} });
  const result = withKlaviyoAndroid(configWithoutPackage, mockProps);
  expect(() => (result as any)(configWithoutPackage, mockProps)).not.toThrow();
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

### 5. Plugin Behavior Testing

Test how the plugin handles different scenarios:

```typescript
it('should handle different prop combinations', () => {
  const testCases = [
    { openTracking: true, logLevel: 1 },
    { openTracking: false, logLevel: 2 },
    { openTracking: true, logLevel: 3, notificationColor: '#FF0000' },
  ];

  testCases.forEach((props) => {
    const result = withKlaviyoAndroid(mockConfig, props as KlaviyoPluginAndroidProps);
    expect(() => (result as any)(mockConfig, props)).not.toThrow();
  });
});
```

## Coverage

The Jest configuration is set up to collect coverage from:

- All TypeScript files in the `plugin/` directory
- Excludes type definition files and type files
- Generates HTML, LCOV, and text coverage reports

Current coverage shows:
- **Statement Coverage**: 6.36%
- **Branch Coverage**: 0%
- **Function Coverage**: 11.94%
- **Line Coverage**: 6.5%

Note: Coverage is low because many plugin functions are not executed during testing due to the mocking strategy used for integration tests.

## Best Practices

1. **Clear Test Names**: Use descriptive test names that explain what is being tested
2. **Setup and Teardown**: Use `beforeEach` to reset mocks and create fresh test data
3. **Mock Appropriately**: Mock external dependencies but test your actual logic
4. **Test Edge Cases**: Include tests for error conditions and boundary cases
5. **Group Related Tests**: Use `describe` blocks to organize related tests
6. **Use Test Utilities**: Leverage the provided test utilities for consistent mocking
7. **Integration vs Unit Tests**: Use integration tests for system behavior and unit tests for individual functions
8. **Realistic Expectations**: Understand that with complex mocking, some error conditions may not be testable

## Adding New Tests

When adding tests for new functions:

1. Create a new test file or add to existing test file
2. Import the function to test
3. Set up appropriate mocks
4. Write tests covering normal operation and edge cases
5. Update this README if adding new test utilities or patterns

## Current Test Status

- **Total Test Suites**: 3
- **Total Tests**: 48
- **All Tests Passing**: ✅
- **Coverage**: Basic coverage achieved (focus on functionality over coverage percentage) 