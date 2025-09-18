// seeds/ceremonies.js
const mongoose = require('mongoose');
const Ceremony = require('../models/ceremony');
require('dotenv').config();

const ceremonies = [
  {
    name: "Wedding Ceremony",
    description: "Traditional Hindu wedding ceremony with all rituals and customs. Includes Panigrahana, Saptapadi, and other essential ceremonies.",
    category: "wedding",
    subcategory: "hindu-wedding",
    duration: {
      typical: 180, // 3 hours
      minimum: 120,
      maximum: 300
    },
    pricing: {
      basePrice: 15000,
      priceRange: {
        min: 12000,
        max: 25000
      },
      factors: [
        { name: "Location", multiplier: 1.2, description: "Travel charges for outstation ceremonies" },
        { name: "Guest Count", multiplier: 1.3, description: "Additional charges for large gatherings" },
        { name: "Premium Timings", multiplier: 1.1, description: "Early morning or auspicious timings" }
      ]
    },
    requirements: {
      materials: [
        { name: "Sacred Fire (Agni Kund)", isOptional: false, quantity: "1 setup", providedBy: "priest" },
        { name: "Wedding Garlands", isOptional: false, quantity: "2 sets", providedBy: "devotee" },
        { name: "Mangalsutra", isOptional: false, quantity: "1", providedBy: "devotee" },
        { name: "Wedding Rings", isOptional: true, quantity: "2", providedBy: "devotee" },
        { name: "Sacred Thread", isOptional: false, quantity: "As required", providedBy: "priest" },
        { name: "Flowers and Decorations", isOptional: false, quantity: "As required", providedBy: "devotee" }
      ],
      participants: {
        required: 2,
        maximum: null
      },
      spaceRequirements: "Large hall or outdoor space with fire safety arrangements",
      specialInstructions: [
        "Both bride and groom should fast before the ceremony",
        "Arrange for sacred fire setup with safety measures",
        "Coordinate with families for proper timing",
        "Ensure all legal documentation is ready"
      ]
    },
    tags: ["wedding", "marriage", "vivah", "hindu", "traditional", "sacred", "ceremony"],
    keywords: ["wedding", "marriage", "vivah", "Hindu marriage", "traditional wedding", "sacred ceremony"],
    searchTerms: ["wedding ceremony", "Hindu wedding", "marriage ritual", "vivah sanskar"],
    images: [
      {
        url: "https://example.com/wedding-ceremony-1.jpg",
        alt: "Traditional Hindu Wedding Ceremony",
        isPrimary: true
      }
    ],
    religiousTraditions: ["Hindu", "Vedic"],
    regions: ["North India", "South India", "West India", "East India"],
    languages: ["Hindi", "Sanskrit", "English"],
    seasonality: {
      preferredMonths: [1, 2, 3, 4, 11, 12], // Winter months
      avoidMonths: [5, 6, 7, 8], // Monsoon and extreme summer
      preferredDays: ["Tuesday", "Thursday", "Friday", "Sunday"],
      preferredTimes: [
        { start: "06:00", end: "12:00", significance: "Brahma Muhurat and morning auspicious time" }
      ]
    },
    statistics: {
      bookingCount: 150,
      averageRating: 4.8,
      reviewCount: 45,
      popularityScore: 0,
      monthlyTrend: [
        { month: 1, year: 2024, bookings: 20 },
        { month: 2, year: 2024, bookings: 25 },
        { month: 3, year: 2024, bookings: 18 }
      ]
    },
    isActive: true,
    isFeatured: true,
    isPopular: true
  },
  {
    name: "Griha Pravesh (Housewarming)",
    description: "Sacred ceremony for entering a new home. Includes Vastu Puja, Ganesh Puja, and blessing rituals for prosperity and happiness.",
    category: "housewarming",
    subcategory: "griha-pravesh",
    duration: {
      typical: 90,
      minimum: 60,
      maximum: 120
    },
    pricing: {
      basePrice: 3500,
      priceRange: {
        min: 2500,
        max: 6000
      },
      factors: [
        { name: "Home Size", multiplier: 1.2, description: "Additional rituals for larger homes" },
        { name: "Full Vastu Ceremony", multiplier: 1.5, description: "Complete Vastu Puja with all directions" }
      ]
    },
    requirements: {
      materials: [
        { name: "Kalash (Sacred Pot)", isOptional: false, quantity: "1", providedBy: "devotee" },
        { name: "Coconut", isOptional: false, quantity: "1", providedBy: "devotee" },
        { name: "Flowers and Garlands", isOptional: false, quantity: "As required", providedBy: "devotee" },
        { name: "Incense and Diyas", isOptional: false, quantity: "As required", providedBy: "devotee" },
        { name: "Sweets and Fruits", isOptional: false, quantity: "As required", providedBy: "devotee" }
      ],
      participants: {
        required: 1,
        maximum: 50
      },
      spaceRequirements: "New home with main entrance accessible",
      specialInstructions: [
        "Ceremony should be performed before moving belongings",
        "All family members should participate",
        "Keep the home clean and decorated",
        "Prepare for feeding guests after ceremony"
      ]
    },
    tags: ["housewarming", "griha pravesh", "new home", "vastu", "blessing"],
    keywords: ["housewarming", "griha pravesh", "new home blessing", "vastu puja"],
    searchTerms: ["housewarming ceremony", "griha pravesh", "new home puja", "vastu ceremony"],
    images: [
      {
        url: "https://example.com/housewarming-1.jpg",
        alt: "Griha Pravesh Housewarming Ceremony",
        isPrimary: true
      }
    ],
    religiousTraditions: ["Hindu"],
    regions: ["All India"],
    languages: ["Hindi", "Sanskrit", "Regional Languages"],
    seasonality: {
      preferredMonths: [1, 2, 3, 4, 10, 11, 12],
      avoidMonths: [],
      preferredDays: ["Tuesday", "Thursday", "Friday", "Sunday"],
      preferredTimes: [
        { start: "06:00", end: "12:00", significance: "Morning auspicious time" },
        { start: "16:00", end: "18:00", significance: "Evening auspicious time" }
      ]
    },
    statistics: {
      bookingCount: 89,
      averageRating: 4.6,
      reviewCount: 23,
      popularityScore: 0
    },
    isActive: true,
    isFeatured: true,
    isPopular: true
  },
  {
    name: "Namkaran Sanskar (Baby Naming)",
    description: "Traditional ceremony for naming a newborn child. Includes prayers for the child's health, prosperity, and bright future.",
    category: "baby-naming",
    subcategory: "namkaran-sanskar",
    duration: {
      typical: 60,
      minimum: 45,
      maximum: 90
    },
    pricing: {
      basePrice: 2500,
      priceRange: {
        min: 2000,
        max: 4500
      },
      factors: [
        { name: "Extended Family Participation", multiplier: 1.2, description: "Additional rituals for larger family gatherings" }
      ]
    },
    requirements: {
      materials: [
        { name: "Sacred Thread", isOptional: false, quantity: "1", providedBy: "priest" },
        { name: "Honey and Ghee", isOptional: false, quantity: "Small quantities", providedBy: "devotee" },
        { name: "Gold or Silver Item", isOptional: true, quantity: "1 small item", providedBy: "devotee" },
        { name: "Flowers and Fruits", isOptional: false, quantity: "As required", providedBy: "devotee" }
      ],
      participants: {
        required: 3, // Parents and baby
        maximum: 30
      },
      spaceRequirements: "Clean, quiet space suitable for baby",
      specialInstructions: [
        "Baby should be healthy and comfortable",
        "Mother should be present throughout the ceremony",
        "Prepare the chosen name in advance",
        "Arrange for family feast after ceremony"
      ]
    },
    tags: ["baby naming", "namkaran", "sanskar", "newborn", "blessing"],
    keywords: ["baby naming", "namkaran sanskar", "newborn blessing", "child naming ceremony"],
    searchTerms: ["baby naming ceremony", "namkaran sanskar", "newborn blessing ritual"],
    images: [
      {
        url: "https://example.com/baby-naming-1.jpg",
        alt: "Namkaran Sanskar Baby Naming Ceremony",
        isPrimary: true
      }
    ],
    religiousTraditions: ["Hindu"],
    regions: ["All India"],
    languages: ["Hindi", "Sanskrit", "Regional Languages"],
    seasonality: {
      preferredMonths: [1, 2, 3, 4, 9, 10, 11, 12],
      avoidMonths: [],
      preferredDays: ["Tuesday", "Thursday", "Friday", "Sunday"],
      preferredTimes: [
        { start: "08:00", end: "12:00", significance: "Morning auspicious time suitable for babies" }
      ]
    },
    statistics: {
      bookingCount: 67,
      averageRating: 4.7,
      reviewCount: 18,
      popularityScore: 0
    },
    isActive: true,
    isFeatured: false,
    isPopular: true
  },
  {
    name: "Satyanarayan Puja",
    description: "Sacred puja dedicated to Lord Satyanarayan for prosperity, happiness, and fulfillment of wishes. Includes Katha recitation and prasad distribution.",
    category: "puja",
    subcategory: "satyanarayan-puja",
    duration: {
      typical: 120,
      minimum: 90,
      maximum: 150
    },
    pricing: {
      basePrice: 2100,
      priceRange: {
        min: 1800,
        max: 3500
      },
      factors: [
        { name: "Full Moon Day", multiplier: 1.1, description: "Additional charges for Purnima puja" }
      ]
    },
    requirements: {
      materials: [
        { name: "Banana Leaves", isOptional: false, quantity: "5-7 leaves", providedBy: "devotee" },
        { name: "Panchamrit", isOptional: false, quantity: "As required", providedBy: "devotee" },
        { name: "Sweets and Fruits", isOptional: false, quantity: "As required", providedBy: "devotee" },
        { name: "Silver/Steel Kalash", isOptional: false, quantity: "1", providedBy: "devotee" }
      ],
      participants: {
        required: 1,
        maximum: 25
      },
      spaceRequirements: "Clean space with provision for sitting arrangement",
      specialInstructions: [
        "All participants should maintain ritual purity",
        "Arrange for community prasad distribution",
        "Keep fast until puja completion (optional)",
        "Have the Satyanarayan Katha book ready"
      ]
    },
    tags: ["satyanarayan puja", "puja", "katha", "prosperity", "blessing"],
    keywords: ["satyanarayan puja", "purnima puja", "prosperity puja", "katha"],
    searchTerms: ["satyanarayan puja", "satyanarayan katha", "prosperity ritual"],
    images: [
      {
        url: "https://example.com/satyanarayan-puja-1.jpg",
        alt: "Satyanarayan Puja Ceremony",
        isPrimary: true
      }
    ],
    religiousTraditions: ["Hindu"],
    regions: ["All India"],
    languages: ["Hindi", "Sanskrit"],
    seasonality: {
      preferredMonths: [1, 2, 3, 4, 9, 10, 11, 12],
      avoidMonths: [],
      preferredDays: ["Thursday", "Friday", "Sunday"],
      preferredTimes: [
        { start: "08:00", end: "12:00", significance: "Morning auspicious time" },
        { start: "18:00", end: "21:00", significance: "Evening puja time" }
      ]
    },
    statistics: {
      bookingCount: 95,
      averageRating: 4.5,
      reviewCount: 28,
      popularityScore: 0
    },
    isActive: true,
    isFeatured: false,
    isPopular: true
  },
  {
    name: "Thread Ceremony (Yajnopavita Sanskar)",
    description: "Sacred thread ceremony marking the beginning of formal education and spiritual journey for young boys in Hindu tradition.",
    category: "thread-ceremony",
    subcategory: "yajnopavita-sanskar",
    duration: {
      typical: 180,
      minimum: 120,
      maximum: 240
    },
    pricing: {
      basePrice: 8500,
      priceRange: {
        min: 6500,
        max: 15000
      },
      factors: [
        { name: "Multiple Children", multiplier: 1.3, description: "Additional charges for multiple thread ceremonies" },
        { name: "Extended Rituals", multiplier: 1.4, description: "Complete traditional ceremony with all rituals" }
      ]
    },
    requirements: {
      materials: [
        { name: "Sacred Thread (Yajnopavita)", isOptional: false, quantity: "As required", providedBy: "priest" },
        { name: "Sacred Fire Setup", isOptional: false, quantity: "1", providedBy: "priest" },
        { name: "Traditional Clothes", isOptional: false, quantity: "1 set", providedBy: "devotee" },
        { name: "Rudraksha Mala", isOptional: true, quantity: "1", providedBy: "devotee" }
      ],
      participants: {
        required: 1, // The child
        maximum: 100
      },
      spaceRequirements: "Space for sacred fire and large family gathering",
      specialInstructions: [
        "Child should be between 8-16 years of age",
        "Child should observe ritual purity",
        "Traditional feast arrangement for guests",
        "Coordinate with extended family for auspicious timing"
      ]
    },
    tags: ["thread ceremony", "yajnopavita", "sanskar", "coming of age", "education"],
    keywords: ["thread ceremony", "yajnopavita sanskar", "upanayana", "sacred thread"],
    searchTerms: ["thread ceremony", "sacred thread ceremony", "yajnopavita sanskar", "upanayana"],
    images: [
      {
        url: "https://example.com/thread-ceremony-1.jpg",
        alt: "Yajnopavita Thread Ceremony",
        isPrimary: true
      }
    ],
    religiousTraditions: ["Hindu", "Vedic"],
    regions: ["North India", "Central India"],
    languages: ["Hindi", "Sanskrit"],
    seasonality: {
      preferredMonths: [1, 2, 3, 4, 5, 10, 11, 12],
      avoidMonths: [7, 8], // Avoid during monsoon
      preferredDays: ["Thursday", "Friday", "Sunday"],
      preferredTimes: [
        { start: "06:00", end: "12:00", significance: "Brahma Muhurat and morning time" }
      ]
    },
    statistics: {
      bookingCount: 45,
      averageRating: 4.9,
      reviewCount: 15,
      popularityScore: 0
    },
    isActive: true,
    isFeatured: true,
    isPopular: false
  }
];

async function seedCeremonies() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing ceremonies
    await Ceremony.deleteMany({});
    console.log('Cleared existing ceremonies');

    // Insert new ceremonies
    for (const ceremonyData of ceremonies) {
      const ceremony = new Ceremony(ceremonyData);
      ceremony.calculatePopularityScore();
      await ceremony.save();
      console.log(`Added ceremony: ${ceremony.name}`);
    }

    console.log('Successfully seeded ceremonies database');
    
    // Create text indexes
    await Ceremony.ensureIndexes();
    console.log('Ensured database indexes');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seeding function
if (require.main === module) {
  seedCeremonies();
}

module.exports = { ceremonies, seedCeremonies };
