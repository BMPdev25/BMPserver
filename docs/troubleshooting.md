# Troubleshooting & Error Resolution Guide

This document catalogs common issues, error messages, and their solutions for the BMPserver project.

## 1. Server & Environment Issues

### Port Already in Use (`EADDRINUSE`)
**Error**: `Error: listen EADDRINUSE: address already in use :::5000`
**Cause**: Another process (possibly a crashed instance of the server) is using port 5000.
**Fix**:
- **Windows**: `netstat -ano | findstr :5000` followed by `taskkill /PID <PID> /F`
- **Mac/Linux**: `lsof -i :5000` followed by `kill -9 <PID>`

### MongoDB Connection Failures
**Error**: `MongoNetworkError: failed to connect to server`
**Cause**: MongoDB service is not running or the connection string is incorrect.
**Fix**: Ensure your MongoDB service is started (`net start MongoDB` or `sudo systemctl start mongod`).

---

## 2. Authentication & Security

### JWT Token Issues
- **Expired Token**: `JsonWebTokenError: jwt expired`. The frontend is configured to auto-logout on 401 errors.
- **Invalid Token**: `JsonWebTokenError: invalid token`. Usually caused by a malformed token or mismatched secret keys. Clear client storage and log in again.

### Firebase Integration
If using Firebase for authentication, ensure your `firebaseUid` matches between the client and server records.

---

## 3. Validation & Data Errors

### Duplicate Key Error
**Error**: `MongoServerError: E11000 duplicate key error`
**Cause**: Attempting to create a record with an email or phone number that already exists.
**Fix**: Check if the user already has an account or use different credentials.

### Cast Errors
**Error**: `CastError: Cast to Number failed for value "abc"`
**Cause**: Incorrect data type sent in the request body (e.g., a string where a number was expected).
**Fix**: Verify the API documentation for expected data types.

---

## 4. Specific SDK Issues

### Expo SDK Initialization (ESM vs CommonJS)
**Issue**: `TypeError: Expo is not a constructor` when using `expo-server-sdk`.
**Solution**: Use the robust initialization pattern:
```javascript
const ExpoSDK = require('expo-server-sdk');
const Expo = ExpoSDK.Expo || ExpoSDK.default?.Expo || ExpoSDK;
const expo = new Expo();
```

### Jest Testing with ESM
**Issue**: `SyntaxError: Cannot use import statement outside a module` during tests.
**Fix**: Update `jest.config.js` to include:
```javascript
transformIgnorePatterns: ['node_modules/(?!(expo-server-sdk|axios)/)'],
```

---

## 5. Frontend Specific Fixes

- **API Path 404s**: Ensure all endpoints in `userService.ts` use the `/api/` prefix (e.g., `/api/user/profile`).
- **Network Errors**: Double-check the machine IP address in `api/index.ts` if running on a physical device.
- **Image Loading**: Ensure you are accessing `ceremony.image` or `ceremony.images[0].url` correctly based on the model.
