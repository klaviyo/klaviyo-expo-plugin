import * as path from 'path';
import * as fs from 'fs';

/**
 * Generic function to find the plugin root directory
 * Works with both npm install and local file references
 */
export function getPluginRoot(): string {
  // Try multiple strategies to find the plugin root
  const strategies = [
    // Strategy 1: Try require.resolve (works for npm install)
    () => {
      try {
        const pkgJsonPath = require.resolve('klaviyo-expo-plugin/package.json');
        return path.dirname(pkgJsonPath);
      } catch {
        return null;
      }
    },
    // Strategy 2: Look for package.json in common relative paths
    () => {
      const currentDir = __dirname;
      const possiblePaths = [
        path.join(currentDir, '..', '..', 'package.json'),
        path.join(currentDir, '..', '..', '..', 'package.json'),
        path.join(currentDir, '..', 'package.json'),
      ];
      
      for (const pkgPath of possiblePaths) {
        if (fs.existsSync(pkgPath)) {
          const pkgContent = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkgContent.name === 'klaviyo-expo-plugin') {
            return path.dirname(pkgPath);
          }
        }
      }
      return null;
    },
    // Strategy 3: Search upward from current directory
    () => {
      let currentDir = __dirname;
      const maxDepth = 10; // Prevent infinite loops
      
      for (let depth = 0; depth < maxDepth; depth++) {
        const pkgPath = path.join(currentDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
          try {
            const pkgContent = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (pkgContent.name === 'klaviyo-expo-plugin') {
              return currentDir;
            }
          } catch {
            // Continue searching if package.json is invalid
          }
        }
        
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
          break; // Reached root directory
        }
        currentDir = parentDir;
      }
      return null;
    }
  ];
  
  // Try each strategy until one works
  for (const strategy of strategies) {
    const result = strategy();
    if (result) {
      return result;
    }
  }
  
  throw new Error('Could not find klaviyo-expo-plugin root directory. Please ensure the plugin is properly installed.');
} 