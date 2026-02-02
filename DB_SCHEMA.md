# Database Schema Documentation

This project uses **MongoDB** with **Mongoose** for data modeling. The schema is distributed across the `models/` directory.

## Models

### 1. User (`models/user.js`)
- **Purpose**: Central identity management for both Priests and Devotees.
- **Key Fields**:
    - `name`, `email`, `phone` (Unique)
    - `userType`: Enum (`priest`, `devotee`)
    - `firebaseUid`: Sparse unique index (indicates Firebase Auth integration)
    - `security`: Nested object for limits, 2FA, locks.
    - `languagesSpoken`: Array of ObjectId refs to `Language` (for priests)
    - `addresses`: Array of address objects with type, location details
    - `notifications`: Nested object for email and push notification preferences
- **Relations**: Referenced by almost all other models.

### 2. Language (`models/language.js`)
- **Purpose**: Catalog of languages spoken in India for priest profiles.
- **Key Fields**:
    - `name`: English name of the language
    - `nativeName`: Native script name
    - `code`: ISO language code (e.g., 'HI', 'BN')
    - `speakersInMillions`: Number of speakers
    - `rank`: Ranking by number of speakers (1-20)
- **Relations**: Referenced by `User.languagesSpoken`
- **Note**: Database contains top 20 languages spoken in India.

### 3. Booking (`models/booking.js`)
- **Purpose**: Manages appointment/service bookings between Devotees and Priests.
- **Key Fields**:
    - `devoteeId`: Ref to `User`
    - `priestId`: Ref to `User`
    - `status`: Enum (`confirmed`, `completed`, `cancelled`)
    - `paymentStatus`: Enum (`pending`, `completed`, `refunded`)
    - `statusHistory`: Audit trail of status changes.

### 4. PriestProfile (`models/priestProfile.js`)
- **Purpose**: Extended profile information for Priests.
- **Key Fields**:
    - `userId`: Ref to `User`
    - `services`: Array of `PriestServiceSchema` (links to `Ceremony` with custom price/duration).
    - `location`: GeoJSON Point (for radius search).
    - `availability`, `schedule`: Maps for time management.
    - `religiousTradition`: String (legacy field, kept for backward compatibility)
    *Legacy `ceremonies` field has been removed in favor of `services`.*
- **Note**: Languages spoken are now stored in the User model, not PriestProfile.

### 5. DevoteeProfile (`models/devoteeProfile.js`)
- **Purpose**: Extended profile for Devotees.
- **Key Fields**:
    - `userId`: Ref to `User`
    - `preferences`: Preferred ceremonies/priests.
    *Note: `history` has been removed to avoid duplication; query `Booking` collection instead.*

### 6. Ceremony (`models/ceremony.js`)
- **Purpose**: Catalog of available religious services.
- **Key Fields**:
    - `name`, `category`, `subcategory`.
    - `pricing`, `duration`, `requirements`.

### 7. Transaction (`models/transaction.js`)
- **Purpose**: Financial records.
- **Key Fields**:
    - `priestId`: Ref to `User`
    - `bookingId`: Ref to `Booking` (Required for `earnings`, optional for `withdrawal`)
    - `type`, `amount`, `status`.

### 8. Rating (`models/rating.js`)
- **Purpose**: Feedback system.
- **Key Fields**:
    - `bookingId`: Ref to `Booking`
    - `priestId`: Ref to `User`
    - `userId`: Ref to `User`
    - `rating` (1-5), `categories` (breakdown).

### 9. Notification (`models/notification.js`)
- **Purpose**: In-app notifications.
- **Key Fields**:
    - `userId`: Ref to `User`
    - `type`, `message`, `read` status.

## Schema Best Practices
- **Foreign Keys**: Always use `mongoose.Schema.Types.ObjectId` with a `ref` for relationships.
- **Indexes**: Critical fields (`email`, `status`, foreign keys) are indexed for performance.
- **Timestamps**: Most models use `createdAt` and `updatedAt`.
- **Validation**: Enums are used for finite states (e.g., `status`).

## Recent Changes
- **Language Model**: Added to store top 20 Indian languages for priest profiles.
- **User Model**: Added `languagesSpoken` field (array of Language refs) for priests.
- **PriestProfile**: `religiousTradition` is now legacy; languages are stored in User model.
