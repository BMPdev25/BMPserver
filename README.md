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
If the server fails to start:
1. Check if MongoDB is running
2. Ensure port 5000 is free
3. Verify `.env` file exists with correct credentials

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
*   **Priests:**
    *   `priest1@example.com` (Pandit Sharma)
    *   `priest2@example.com` (Acharya Mishra)
*   **Devotees:** `devotee1@example.com`, `devotee2@example.com`
*   **Password for all:** `password123`

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

For detailed information on running tests and understanding test cases, please refer to [TESTING.md](./TESTING.md).

To run the tests:
```bash
npm test
```

## Documentation

- [Database Schema](./DB_SCHEMA.md) - Complete database schema documentation
- [Testing Guide](./TESTING.md) - Testing documentation and guidelines
