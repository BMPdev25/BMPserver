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

## Recent Test Updates
- ✅ Updated auth tests to use `userType` instead of `role`
- ✅ Added test for priest registration with language selection
- ✅ Added validation test for priest registration without languages
- ✅ Updated login test to use `identifier` field

## Test Data
Tests use the MongoDB Memory Server, which provides an isolated in-memory database. The Language collection is seeded with test data during the test setup using the `beforeAll` hook.
