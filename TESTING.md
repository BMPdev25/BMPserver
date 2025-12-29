# Testing Documentation

## Overview
The `BMPserver` backend uses **Jest** as the test runner, **Supertest** for API integration testing, and **MongoDB Memory Server** for an isolated, in-memory database during tests.

## Running Tests
To run the full test suite:
```bash
npm test
```
*Note: The first run may be slower as it downloads the MongoDB binary (~700MB) for the memory server.*

## Test Structure & Descriptions

### 1. Model Tests (`tests/models/`)
These tests verify the Mongoose schemas, ensuring data validation and integrity.

*   **`user.test.js`**:
    *   **Purpose**: Validates the `User` schema.
    *   **Cases**:
        *   `should create & save user successfully`: Verifies a valid user is saved with all fields.
        *   `should fail to save user without required fields`: Ensures validation errors occur if `email` or `password` are missing.

*   **`priestProfile.test.js`**:
    *   **Purpose**: Validates the `PriestProfile` schema and sub-documents.
    *   **Cases**:
        *   `should create & save priest profile successfully`: Checks basic profile creation.
        *   `should validate verificationDocuments structure`: Verifies that documents (like ID proofs) are stored with the correct structure (type, status, etc.).

### 2. Integration Tests (`tests/integration/`)
These tests test the API endpoints by sending real HTTP requests to the running express app.

*   **`auth.test.js`**:
    *   **Purpose**: Tests the Authentication flow.
    *   **Cases**:
        *   `should register a new devotee user`: Sends a POST to `/api/auth/register` with `userType: 'devotee'` and checks for a 201 status and returned token.
        *   `should register a new priest user with languages`: Sends a POST to `/api/auth/register` with `userType: 'priest'` and `languagesSpoken` array, verifies successful registration.
        *   `should fail to register priest without languages`: Verifies that priest registration fails with a 400 status if no languages are selected.
        *   `should login an existing user`: Registers a user, then sends a POST to `/api/auth/login` with `identifier` (email/phone) to verify successful login and token generation.

*   **`profileCompletion.test.js`**:
    *   **Purpose**: Tests the Profile Completion and Profile Auto-creation functionality.
    *   **Cases**:
        *   `should auto-create profile and return completion data for new priest`: Verifies that a new priest gets a profile created automatically with completion percentage calculated.
        *   `should return 401 without authentication`: Ensures endpoint requires authentication.
        *   `should calculate correct completion percentage`: Tests that completion percentage increases as profile fields are filled.
        *   `should identify missing fields correctly`: Verifies that the API correctly identifies which profile fields are missing.
        *   `should return canAcceptRequests false for incomplete profile`: Ensures incomplete profiles cannot accept requests.
        *   `should auto-create profile for new priest` (getProfile): Tests that the profile endpoint creates a profile if it doesn't exist.
        *   `should return existing profile if it exists`: Verifies that existing profiles are returned correctly.
        *   `should return 401 without authentication` (getProfile): Ensures profile endpoint requires authentication.

## Recent Test Updates
- ✅ Updated auth tests to use `userType` instead of `role`
- ✅ Added test for priest registration with language selection
- ✅ Added validation test for priest registration without languages
- ✅ Updated login test to use `identifier` field
- ✅ Added comprehensive profile completion tests
- ✅ Added profile auto-creation tests

## Test Data
Tests use the MongoDB Memory Server, which provides an isolated in-memory database. The Language collection is seeded with test data during the test setup using the `beforeAll` hook.

## Running Specific Tests

Run all tests:
```bash
npm test
```

Run specific test file:
```bash
npm test -- tests/integration/auth.test.js
npm test -- tests/integration/profileCompletion.test.js
```

Run tests in watch mode:
```bash
npm test -- --watch
```

## Test Coverage

Current test coverage includes:
- **Authentication**: User registration (devotee & priest), login, language validation
- **Profile Management**: Profile creation, profile completion calculation, auto-creation
- **Data Validation**: Schema validation, required fields, data types

## Future Test Additions

Planned test coverage:
- Booking creation and management
- Earnings calculation
- Notification system
- Document upload and verification
- Service/ceremony management
