# Troubleshooting Guide

This document records common issues and their solutions encountered during development.

## 1. Server Start Failures (`EADDRINUSE`)

**Issue**: The server fails to start with the error `Error: listen EADDRINUSE: address already in use :::5000`. This happens when a previous instance of the server is still running in the background.

**Solution**:
- **Identify and Kill**: On Windows, you can find the process ID (PID) using `netstat -ano | findstr :5000` and then kill it using `taskkill /F /PID <PID>`.
- **Nodemon**: Sometimes `nodemon` doesn't properly kill the child process on a crash. Restarting the terminal or manually killing the process is necessary.

## 2. Expo SDK Initialization (ESM vs CommonJS)

**Issue**: `expo-server-sdk` v6+ is an ES Module. Using a simple `require('expo-server-sdk').Expo` in a CommonJS project can result in `TypeError: Expo is not a constructor` because the export structure varies between Node environments and test runners (like Jest).

**Solution**: Use a robust initialization pattern in `models/notification.js`:
```javascript
const ExpoSDK = require('expo-server-sdk');
const Expo = ExpoSDK.Expo || ExpoSDK.default?.Expo || ExpoSDK;
let expo;
try {
  expo = new Expo();
} catch (err) {
  console.error('Failed to initialize Expo SDK:', err.message);
}
```

## 3. Jest Testing with ESM Packages

**Issue**: Jest may fail with `SyntaxError: Cannot use import statement outside a module` when requiring packages like `expo-server-sdk` that use `import` internally.

**Solution**: Update `jest.config.js` to explicitly transform these packages:
```javascript
module.exports = {
  // ...
  transformIgnorePatterns: [
    'node_modules/(?!(expo-server-sdk|axios)/)',
  ],
};
```
