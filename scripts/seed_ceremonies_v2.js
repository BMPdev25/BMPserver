const mongoose = require('mongoose');
const Ceremony = require('../models/ceremony');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const ceremonies = [
  // --- DEITY PUJAS (Image: deity_puja.png) ---
  {
    name: "Ganesh Puja",
    description: "Invocation of Lord Ganesha to remove obstacles and ensure success in new ventures.",
    category: "puja",
    subcategory: "deity",
    duration: { typical: 60, minimum: 45, maximum: 90 },
    pricing: { basePrice: 1100, priceRange: { min: 1100, max: 2100 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/deity_puja.png", alt: "Ganesh Puja Setup", isPrimary: true }],
    requirements: { materials: [{ name: "Modak", quantity: "21", isOptional: false }] }
  },
  {
    name: "Lakshmi Puja",
    description: "Worship of Goddess Lakshmi for wealth, prosperity, and well-being, especially during Diwali.",
    category: "puja",
    subcategory: "deity",
    duration: { typical: 90, minimum: 60, maximum: 120 },
    pricing: { basePrice: 2100, priceRange: { min: 2100, max: 5100 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/deity_puja.png", alt: "Lakshmi Puja Setup", isPrimary: true }],
    requirements: { materials: [{ name: "Lotus Flowers", quantity: "5", isOptional: true }] }
  },
  {
    name: "Saraswati Puja",
    description: "Ritual dedicated to Goddess Saraswati, the deity of knowledge, music, arts, and wisdom.",
    category: "puja",
    subcategory: "deity",
    duration: { typical: 60, minimum: 45, maximum: 90 },
    pricing: { basePrice: 1500, priceRange: { min: 1500, max: 2500 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/deity_puja.png", alt: "Saraswati Puja Setup", isPrimary: true }],
    requirements: { materials: [{ name: "Yellow Flowers", quantity: "Bunch", isOptional: false }] }
  },

  // --- FIRE RITUALS (Image: havan.png) ---
  {
    name: "Maha Mrityunjaya Homa",
    description: "Powerful fire ritual dedicated to Lord Shiva for health, longevity, and protection from untimely death.",
    category: "puja",
    subcategory: "havan",
    duration: { typical: 180, minimum: 120, maximum: 240 },
    pricing: { basePrice: 5100, priceRange: { min: 5100, max: 11000 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/havan.png", alt: "Havan Ritual", isPrimary: true }],
    requirements: { materials: [{ name: "Ghee", quantity: "1kg", isOptional: false }] }
  },
  {
    name: "Navagraha Shanti Homa",
    description: "Ceremony to appease the nine planetary deities and remove astrological doshas.",
    category: "puja",
    subcategory: "havan",
    duration: { typical: 150, minimum: 120, maximum: 180 },
    pricing: { basePrice: 4100, priceRange: { min: 4100, max: 7100 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/havan.png", alt: "Navagraha Havan", isPrimary: true }],
    requirements: { materials: [{ name: "Navagraha Samidha", quantity: "1 Set", isOptional: false }] }
  },
  {
    name: "Vastu Shanti Puja",
    description: "Ritual performed before entering a new home or office to remove negative energies and invoke blessings.",
    category: "housewarming",
    subcategory: "havan",
    duration: { typical: 180, minimum: 120, maximum: 240 },
    pricing: { basePrice: 5100, priceRange: { min: 5100, max: 11000 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/havan.png", alt: "Vastu Shanti Havan", isPrimary: true }],
    requirements: { materials: [{ name: "Pumpkins", quantity: "2", isOptional: false }] }
  },
  {
    name: "Upanayana (Thread Ceremony)",
    description: "Sacred rite of passage that marks the acceptance of a student by a Guru (initiation).",
    category: "thread-ceremony",
    subcategory: "samskara",
    duration: { typical: 240, minimum: 180, maximum: 360 },
    pricing: { basePrice: 7100, priceRange: { min: 7100, max: 15000 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/havan.png", alt: "Thread Ceremony Fire", isPrimary: true }],
    requirements: { materials: [{ name: "Yagnopavita (Sacred Thread)", quantity: "1", isOptional: false }] }
  },

  // --- BABY CEREMONIES (Image: baby_ceremony.png) ---
  {
    name: "Namkaran Sanskar",
    description: "Naming ceremony for the newborn, invoking blessings for a long and prosperous life.",
    category: "baby-naming",
    subcategory: "samskara",
    duration: { typical: 60, minimum: 45, maximum: 90 },
    pricing: { basePrice: 2100, priceRange: { min: 2100, max: 3100 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/baby_ceremony.png", alt: "Naming Ceremony", isPrimary: true }],
    requirements: { materials: [{ name: "Honey", quantity: "Small Bowl", isOptional: false }] }
  },
  {
    name: "Annaprashan",
    description: "First rice-feeding ceremony, marking the baby's transition to solid food.",
    category: "baby-naming",
    subcategory: "samskara",
    duration: { typical: 60, minimum: 45, maximum: 90 },
    pricing: { basePrice: 2100, priceRange: { min: 2100, max: 3100 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/baby_ceremony.png", alt: "First Rice Feeding", isPrimary: true }],
    requirements: { materials: [{ name: "Payasam/Kheer", quantity: "1 Bowl", isOptional: false }] }
  },
  {
    name: "Mundan Sanskar",
    description: "Head tonsuring ceremony for the child, symbolizing purity and the shedding of past life's negativity.",
    category: "special-occasion",
    subcategory: "samskara",
    duration: { typical: 90, minimum: 60, maximum: 120 },
    pricing: { basePrice: 2500, priceRange: { min: 2500, max: 3500 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/baby_ceremony.png", alt: "Mundan Ceremony", isPrimary: true }],
    requirements: { materials: [{ name: "Barber Arranged", quantity: "1", isOptional: false }] }
  },

  // --- WEDDING RITUALS (Image: wedding.png) ---
  {
    name: "Vivah Sanskar",
    description: "Complete Hindu wedding ceremony comprising rituals like Kanyadaan, Panigrahana, and Saptapadi.",
    category: "wedding",
    subcategory: "samskara",
    duration: { typical: 240, minimum: 180, maximum: 480 },
    pricing: { basePrice: 21000, priceRange: { min: 21000, max: 51000 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/wedding.png", alt: "Wedding Rituals", isPrimary: true }],
    requirements: { materials: [{ name: "Garlands", quantity: "2", isOptional: false }] }
  },
  {
    name: "Sagaai (Engagement)",
    description: "Ring exchange ceremony marking the formal agreement of marriage between families.",
    category: "wedding",
    subcategory: "pre-wedding",
    duration: { typical: 90, minimum: 60, maximum: 120 },
    pricing: { basePrice: 5100, priceRange: { min: 5100, max: 11000 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/wedding.png", alt: "Engagement Ring Ceremony", isPrimary: true }],
    requirements: { materials: [{ name: "Rings", quantity: "2", isOptional: false }] }
  },
  {
    name: "Roka Ceremony",
    description: "The first official step towards marriage, where families exchange gifts and blessings.",
    category: "wedding",
    subcategory: "pre-wedding",
    duration: { typical: 60, minimum: 45, maximum: 90 },
    pricing: { basePrice: 3100, priceRange: { min: 3100, max: 5100 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/wedding.png", alt: "Roka Ceremony", isPrimary: true }],
    requirements: { materials: [{ name: "Sweets", quantity: "2kg", isOptional: false }] }
  },

  // --- HOLY READINGS (Image: reading.png) ---
  {
    name: "Sundarkand Path",
    description: "Recitation of the Sundarkand chapter from Ramayana, dedicated to Lord Hanuman for strength and courage.",
    category: "puja",
    subcategory: "reading",
    duration: { typical: 150, minimum: 120, maximum: 180 },
    pricing: { basePrice: 3500, priceRange: { min: 3500, max: 5100 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/reading.png", alt: "Sundarkand Reading", isPrimary: true }],
    requirements: { materials: [{ name: "Ramayana Book", quantity: "1", isOptional: false }] }
  },
  {
    name: "Akhand Ramayan Path",
    description: "Continuous 24-hour recitation of the entire Ramcharitmanas.",
    category: "puja",
    subcategory: "reading",
    duration: { typical: 1440, minimum: 1400, maximum: 1500 }, // 24 hours
    pricing: { basePrice: 15000, priceRange: { min: 15000, max: 25000 }, factors: [] },
    religiousTraditions: ["Hindu"],
    images: [{ url: "/public/images/ceremonies/reading.png", alt: "Ramayan Reading", isPrimary: true }],
    requirements: { materials: [{ name: "Multiple Priests", quantity: "Team", isOptional: false }] }
  }
];

const seedCeremonies = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) throw new Error("Missing MONGO_URI in .env");
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');
        
        console.log(`Seeding ${ceremonies.length} ceremonies...`);
        
        for (const data of ceremonies) {
            // Upsert: Update if exists, Insert if new
            await Ceremony.findOneAndUpdate(
                { name: data.name },
                { $set: data },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            console.log(` - Processed: ${data.name}`);
        }
        
        console.log('Seeding complete!');
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
};

seedCeremonies();
