# BookMyPujari Server (Backend)

## Getting Started

1.  **Install dependencies:**
    ```bash
    npm install
    ```

## Running the Server

### Development Mode (Recommended)

Runs the server with `nodemon`, which automatically restarts when file changes are detected.

```bash
npm run dev
```

### Production Mode

Runs the server using standard Node.js.

```bash
node server.js
```

### Troubleshooting

If you encounter issues starting the server or connecting to the database, please refer to the **[Troubleshooting Guide](./docs/troubleshooting.md)** for detailed solutions to common errors like `EADDRINUSE` or MongoDB connection failures.

## Data Seeding

### Seed Languages

To populate the database with the top 20 languages spoken in India:

```bash
node scripts/seedLanguages.js
```

This will add 20 languages including Hindi, Bengali, Tamil, Telugu, Marathi, and others with their native names and speaker counts.

### Seed Test Data

To populate the database with test accounts (Priests, Devotees, Ceremonies), run:

```bash
node scripts/seedData.js
```

**Note:** This script will ensure the following test accounts exist:

### Test Accounts

- **Priests:**
  - `priest1@example.com` (Pandit Sharma)
  - `priest2@example.com` (Acharya Mishra)
- **Devotees:** `devotee1@example.com`, `devotee2@example.com`
- **Password for all:** `password123`

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user (devotee or priest)
- `POST /api/auth/login` - Login with email/phone and password
- `POST /api/auth/firebase-login` - Login with Firebase token

### Languages

- `GET /api/languages` - Get all languages (sorted by rank)
- `GET /api/languages/:id` - Get specific language by ID

### Other Endpoints

- `/api/priests` - Priest-related endpoints
- `/api/devotees` - Devotee-related endpoints
- `/api/bookings` - Booking management
- `/api/ceremonies` - Ceremony catalog
- `/api/ratings` - Rating and review system
- `/api/search` - Search functionality

## Testing

The project uses **Jest** and **Supertest** for automated testing.

```bash
npm test
```

For detailed information on test structures and running specific suites, refer to the [Testing Documentation](./docs/testing.md).

## Documentation

Comprehensive documentation is available in the `docs/` folder:

- 🏗️ **[System Architecture](./docs/architecture.md)**: Database schema (ERD), collection details, and payment flow logic.
- 🧪 **[Testing Guide](./docs/testing.md)**: Overview of the testing suite, including model and integration tests.
- 🔧 **[Troubleshooting](./docs/troubleshooting.md)**: Common errors (EADDRINUSE, JWT issues) and their resolutions.
- 🚀 **[Database Migrations](./docs/operations/migration.md)**: Instructions for manual database updates and schema migrations.
