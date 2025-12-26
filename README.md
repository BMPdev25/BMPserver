# BookMyPujari Server (Backend)

## Getting Started

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Run the server:**
    ```bash
    npm run dev
    ```

## Data Seeding

To populate the database with test accounts (Priests, Devotees, Ceremonies), run the following command:

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
