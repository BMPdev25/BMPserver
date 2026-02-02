# Common Backend Errors and Fixes

## Overview
This document catalogs common backend errors and their solutions for the Sacred Connect server.

---

## Authentication Errors

### 1. JWT Token Expired

**Error:**
```
JsonWebTokenError: jwt expired
```

**Cause:**
- Token lifetime exceeded (default: 30 days)
- User hasn't logged in recently

**Fix:**
- Frontend now auto-logs out on 401 errors
- User will be redirected to login automatically

**Prevention:**
- Token expiration is handled automatically
- Consider implementing refresh tokens for longer sessions

---

### 2. Invalid Token Format

**Error:**
```
JsonWebTokenError: invalid token
```

**Cause:**
- Malformed JWT token
- Token was manually edited
- Wrong secret key used

**Fix:**
1. Clear client-side token storage
2. User must login again
3. New valid token will be generated

---

## Database Errors

### 3. MongoDB Connection Failed

**Error:**
```
MongoNetworkError: failed to connect to server
```

**Cause:**
- MongoDB service not running
- Wrong connection string
- Network/firewall issues

**Fix:**
```bash
# Start MongoDB
net start MongoDB  # Windows
brew services start mongodb-community  # Mac
sudo systemctl start mongod  # Linux

# Verify connection
mongosh
```

---

### 4. Duplicate Key Error

**Error:**
```
MongoServerError: E11000 duplicate key error
```

**Cause:**
- Trying to create document with existing unique field
- Usually email or phone number already exists

**Fix:**
- Check if user already exists
- Use different email/phone
- Or login with existing account

---

## Validation Errors

### 5. Required Field Missing

**Error:**
```
ValidationError: Path `email` is required
```

**Cause:**
- Required field not provided in request
- Empty string sent for required field

**Fix:**
- Ensure all required fields are sent
- Check request body format
- Validate on frontend before sending

---

### 6. Invalid Data Type

**Error:**
```
CastError: Cast to Number failed for value "abc"
```

**Cause:**
- Wrong data type sent
- String sent for number field
- Invalid ObjectId format

**Fix:**
- Convert data to correct type before sending
- Validate input on frontend
- Check API documentation for expected types

---

## Profile Errors

### 7. Profile Not Found (Now Fixed)

**Error:**
```
Profile not found
```

**Fix Implemented:**
- Profiles now auto-created when missing
- No manual intervention needed

**Code:**
```javascript
if (!profile) {
  profile = new PriestProfile({
    userId: req.user.id,
    experience: 0,
    // ... default values
  });
  await profile.save();
}
```

---

## File Upload Errors

### 8. File Too Large

**Error:**
```
PayloadTooLargeError: request entity too large
```

**Cause:**
- File exceeds size limit (5MB)

**Fix:**
- Compress image before upload
- Current limit: 5MB
- Supported formats: PDF, JPEG, PNG

---

### 9. Invalid File Type

**Error:**
```
Invalid file type
```

**Cause:**
- Unsupported file format
- Wrong MIME type

**Fix:**
- Use supported formats:
  - Images: JPEG, PNG
  - Documents: PDF
- Check file extension

---

## Server Errors

### 10. Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Cause:**
- Another process using port 5000
- Previous server instance still running

**Fix:**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :5000
kill -9 <PID>

# Or use different port
PORT=5001 npm run dev
```

---

## Quick Reference

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (token expired/invalid)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

### Common Fixes

1. **Token Issues** → Auto-logout implemented
2. **Profile Missing** → Auto-create implemented
3. **MongoDB Down** → Start MongoDB service
4. **Port Conflict** → Kill process or use different port
5. **Validation Error** → Check required fields

---

## Logging

Enable detailed logging for debugging:

```javascript
// In server.js or specific controllers
console.log('Request body:', req.body);
console.log('User:', req.user);
console.log('Error:', error);
```

---

## Version History

- **v1.0** (2025-12-29): Initial backend error documentation
