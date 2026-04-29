# Testing Documentation

## Overview

The `BMPserver` backend uses **Jest** as the test runner, **Supertest** for API integration testing, and **MongoDB Memory Server** for an isolated, in-memory database during tests.

## Running Tests

To run the full test suite:

```bash
npm test
```

_Note: The first run may be slower as it downloads the MongoDB binary (~700MB) for the memory server._

## Test Structure

### 1. Model Tests (`tests/models/`)
Verifies Mongoose schemas and data integrity.
- `user.test.js`: Validates User schema requirements.
- `priestProfile.test.js`: Validates PriestProfile and document structures.

### 2. Integration Tests (`tests/integration/`)
Tests API endpoints using real HTTP requests.
- `auth.test.js`: Registration, Login, and Language validation.
- `profileCompletion.test.js`: Tests the logic for profile auto-creation and completion percentages.

## Running Specific Tests

Run specific test file:
```bash
npm test -- tests/integration/auth.test.js
```

Run tests in watch mode:
```bash
npm test -- --watch
```

## Future Roadmap
- Booking lifecycle tests
- Financial transaction validation
- Notification delivery tests
