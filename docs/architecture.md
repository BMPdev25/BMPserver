# System Architecture & Database Schema

This document provides a comprehensive overview of the BMPserver architecture, including the database schema and key operational flows.

## 1. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    %% User & Profiles
    User {
        ObjectId _id PK
        String name
        String email
        String phone
        String userType "Enum: priest, devotee"
        ObjectId[] languagesSpoken FK "Ref: Language"
        Object security
        Object[] addresses
        Object rating "Cached stats"
    }

    PriestProfile {
        ObjectId _id PK
        ObjectId userId FK "Ref: User"
        Object[] services "Link to Ceremony"
        GeoJSON location
        Map availability
        Map priceList
        Object earnings
    }

    DevoteeProfile {
        ObjectId _id PK
        ObjectId userId FK "Ref: User"
        Object preferences
    }

    %% Catalogs
    Ceremony {
        ObjectId _id PK
        String name
        String category
        Object pricing
        Object duration
        Object requirements
    }

    Language {
        ObjectId _id PK
        String name
        String code
        String nativeName
    }

    %% Operations
    Booking {
        ObjectId _id PK
        ObjectId devoteeId FK "Ref: User"
        ObjectId priestId FK "Ref: User"
        String ceremonyType
        Date date
        String status "Enum: pending, confirmed, completed, cancelled"
        String paymentStatus
        Object paymentDetails
    }

    Notification {
        ObjectId _id PK
        ObjectId userId FK "Ref: User"
        String type
        String message
        Boolean read
    }

    Rating {
        ObjectId _id PK
        ObjectId bookingId FK "Ref: Booking"
        ObjectId priestId FK "Ref: User"
        ObjectId userId FK "Ref: User"
        Number rating
        Object categories
    }

    Review {
        ObjectId _id PK
        ObjectId bookingId FK "Ref: Booking"
        ObjectId reviewerId FK "Ref: User"
        ObjectId revieweeId FK "Ref: User"
        Number rating
        String role "Enum: priest_to_devotee, devotee_to_priest"
    }

    %% Finance
    Wallet {
        ObjectId _id PK
        ObjectId priestId FK "Ref: User"
        Number currentBalance
        String status
    }

    Transaction {
        ObjectId _id PK
        ObjectId priestId FK "Ref: User"
        ObjectId walletId FK "Ref: Wallet"
        ObjectId bookingId FK "Ref: Booking"
        String type
        String direction
        Number amount
    }

    CompanyRevenue {
        ObjectId _id PK
        ObjectId bookingId FK "Ref: Booking"
        ObjectId priestId FK "Ref: User"
        Number totalAmount
        Number commissionAmount
        Number priestShare
    }

    %% Relationships
    User ||--o| PriestProfile : "has (if priest)"
    User ||--o| DevoteeProfile : "has (if devotee)"
    User }|--|{ Language : "speaks (priest)"

    PriestProfile }|--|{ Ceremony : "offers (via services)"

    User ||--o{ Booking : "makes (devotee)"
    User ||--o{ Booking : "performs (priest)"

    Booking ||--|| CompanyRevenue : "generates"
    Booking ||--o{ Transaction : "related to"
    Booking ||--o{ Rating : "reviewed in"
    Booking ||--o{ Review : "has reviews"

    User ||--|| Wallet : "owns (priest)"
    Wallet ||--o{ Transaction : "contains"

    User ||--o{ Notification : "receives"
```

---

## 2. Payment Flow Architecture

The platform uses an aggregator payment model where the devotee pays the total amount, and the system handles the split between the priest and the company.

```mermaid
flowchart LR
    A["Devotee pays totalAmount"] --> B["Booking completed"]
    B --> C["processBookingCompletion()"]
    C --> D["₹basePrice → Priest Wallet"]
    C --> E["₹platformFee → CompanyRevenue"]
    D --> F["Priest requests withdrawal"]
    F --> G{"Razorpay LIVE?"}
    G -- Yes --> H["RazorpayX Payout API"]
    G -- No --> I["Mock: auto-success"]
```

---

## 3. Database Collections

### Core Identity & Profiles

#### **User** (`users`)
Central identity for all users (Priests and Devotees).

| Field | Type | Required | Refs | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Yes | PK | Primary Key |
| `name` | String | Yes | - | Trimmed |
| `email` | String | Yes | - | Unique, Lowercase |
| `phone` | String | Yes | - | Unique |
| `userType` | String | Yes | - | Enum: `['priest', 'devotee']` |
| `firebaseUid` | String | No | - | Sparse, Unique (Auth) |
| `languagesSpoken` | ObjectId[] | No | `Language` | Array of Foreign Keys |
| `addresses` | Object[] | No | - | Embedded address details |
| `security` | Object | No | - | 2FA, lock status, login attempts |
| `notifications` | Object | No | - | Preferences |
| `rating` | Object | No | - | Cached stats: `average`, `count`, `breakdown` |

#### **PriestProfile** (`priestprofiles`)
Extended profile data for users with `userType: 'priest'`.

| Field | Type | Required | Refs | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `userId` | ObjectId | Yes | `User` | Foreign Key, Unique |
| `services` | Object[] | No | `Ceremony` | List of offered services |
| `location` | GeoJSON | No | - | 2dsphere index |
| `availability` | Object | No | - | Weekly schedule & overrides |
| `earnings` | Object | No | - | Cached stats |

#### **DevoteeProfile** (`devoteeprofiles`)
Extended profile data for users with `userType: 'devotee'`.

| Field | Type | Required | Refs | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `userId` | ObjectId | Yes | `User` | Foreign Key, Unique |
| `preferences` | Object | No | - | Preferred ceremonies/priests |

### Operations & Catalogs

#### **Booking** (`bookings`)
Represents an appointment between a Devotee and a Priest.

#### **Ceremony** (`ceremonies`)
Master catalog of available religious services.

#### **Language** (`languages`)
Master list of supported languages.

---

## 4. Financial Tracking

The system tracks every rupee through a double-entry ledger system.

- **Wallet**: Stores current available balance for priests.
- **Transaction**: Every credit/debit record.
- **CompanyRevenue**: Platform's cut from every successful booking.
