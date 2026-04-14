const mongoose = require('mongoose');
const Ceremony = require('../models/ceremony');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const ceremonies = [
  // --- DEITY PUJAS (Image: deity_puja.png) ---
  {
    name: 'Ganesh Puja',
    description:
      'Invocation of Lord Ganesha to remove obstacles and ensure success in new ventures.',
    history:
      'Ganesh Puja is one of the most important Hindu rituals. Lord Ganesha, the elephant-headed deity, is worshipped first before any auspicious occasion. The tradition stems from the belief that Ganesha is the remover of obstacles (Vighnaharta) and the lord of beginnings. This puja is performed across India during festivals like Ganesh Chaturthi and before starting any new venture.',
    category: 'puja',
    subcategory: 'deity',
    duration: { typical: 60, minimum: 45, maximum: 90 },
    pricing: { basePrice: 1100, priceRange: { min: 1100, max: 2100 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      {
        url: '/public/images/ceremonies/deity_puja.png',
        alt: 'Ganesh Puja Setup',
        isPrimary: true,
      },
    ],
    requirements: {
      materials: [
        {
          name: 'Modak (Sweet Dumplings)',
          quantity: '21 pieces',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Durva Grass', quantity: '21 blades', isOptional: false, providedBy: 'devotee' },
        { name: 'Red Flowers', quantity: '1 bunch', isOptional: false, providedBy: 'devotee' },
        { name: 'Coconut', quantity: '1', isOptional: false, providedBy: 'devotee' },
        { name: 'Supari (Betel Nut)', quantity: '5', isOptional: false, providedBy: 'devotee' },
        { name: 'Paan (Betel Leaves)', quantity: '5', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Turmeric Powder (Haldi)',
          quantity: '50g',
          isOptional: false,
          providedBy: 'devotee',
        },
        {
          name: 'Kumkum (Vermillion)',
          quantity: '1 packet',
          isOptional: false,
          providedBy: 'devotee',
        },
        {
          name: 'Incense Sticks (Agarbatti)',
          quantity: '1 packet',
          isOptional: false,
          providedBy: 'devotee',
        },
        {
          name: 'Camphor (Kapoor)',
          quantity: 'Small box',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Ghee Lamp (Diya)', quantity: '1', isOptional: false, providedBy: 'devotee' },
        { name: 'Cotton Wicks', quantity: '5', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Fruits (Banana, Apple)',
          quantity: '5 pieces',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Ganesh Murti or Photo', quantity: '1', isOptional: true, providedBy: 'devotee' },
      ],
      specialInstructions: [
        'Clean the puja area and place a red cloth before the ceremony.',
        'Keep a small Kalash (water pot) filled with water and mango leaves.',
      ],
    },
    ritualSteps: [
      {
        stepNumber: 1,
        title: 'Ganapati Avahana',
        description: 'Invoking Lord Ganesha and establishing the kalash.',
        durationEstimate: 10,
      },
      {
        stepNumber: 2,
        title: 'Shodashopachara Puja',
        description: 'Performing the 16 steps of worship including Abhishekam and Archana.',
        durationEstimate: 20,
      },
      {
        stepNumber: 3,
        title: 'Ganesha Atharvashirsha',
        description: 'Recitation of the sacred Ganesha Atharvashirsha hymns.',
        durationEstimate: 15,
      },
      {
        stepNumber: 4,
        title: 'Aarti & Pushpanjali',
        description: 'Concluding with the offering of light and flowers.',
        durationEstimate: 10,
      },
    ],
  },
  {
    name: 'Lakshmi Puja',
    description:
      'Worship of Goddess Lakshmi for wealth, prosperity, and well-being, especially during Diwali.',
    history:
      'Lakshmi Puja is a vital Hindu ritual performed to seek the blessings of Goddess Lakshmi, the consort of Lord Vishnu. It is most prominently performed on Diwali night and on Fridays. The tradition holds that Goddess Lakshmi visits clean and well-lit homes, bringing fortune and abundance. The ritual is deeply connected to the harvest season and the celebration of prosperity.',
    category: 'puja',
    subcategory: 'deity',
    duration: { typical: 90, minimum: 60, maximum: 120 },
    pricing: { basePrice: 2100, priceRange: { min: 2100, max: 5100 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      {
        url: '/public/images/ceremonies/deity_puja.png',
        alt: 'Lakshmi Puja Setup',
        isPrimary: true,
      },
    ],
    requirements: {
      materials: [
        { name: 'Lotus Flowers', quantity: '5', isOptional: false, providedBy: 'devotee' },
        { name: 'Coconut', quantity: '1', isOptional: false, providedBy: 'devotee' },
        { name: 'Paan (Betel Leaves)', quantity: '5', isOptional: false, providedBy: 'devotee' },
        { name: 'Supari (Betel Nut)', quantity: '5', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Turmeric Powder (Haldi)',
          quantity: '50g',
          isOptional: false,
          providedBy: 'devotee',
        },
        {
          name: 'Kumkum (Vermillion)',
          quantity: '1 packet',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Ghee', quantity: '200ml', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Panchamrut (Milk, Curd, Ghee, Honey, Sugar)',
          quantity: '1 set',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Incense Sticks', quantity: '1 packet', isOptional: false, providedBy: 'devotee' },
        { name: 'Camphor', quantity: 'Small box', isOptional: false, providedBy: 'devotee' },
        { name: 'Diyas (Oil Lamps)', quantity: '5', isOptional: false, providedBy: 'devotee' },
        { name: 'Cotton Wicks', quantity: '10', isOptional: false, providedBy: 'devotee' },
        { name: 'Coins (for Lakshmi)', quantity: 'Few', isOptional: true, providedBy: 'devotee' },
        {
          name: 'Fruits & Sweets',
          quantity: 'As available',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Lakshmi Murti or Photo', quantity: '1', isOptional: true, providedBy: 'devotee' },
      ],
      specialInstructions: [
        'Light diyas and keep the house well-lit during the puja.',
        'Place a red or yellow cloth on the puja platform.',
      ],
    },
    ritualSteps: [
      {
        stepNumber: 1,
        title: 'Lakshmi Avahana',
        description: 'Invoking Goddess Lakshmi and Establishing the main deity.',
        durationEstimate: 10,
      },
      {
        stepNumber: 2,
        title: 'Panchamrut Abhishekam',
        description: 'Sacred bath using milk, curd, ghee, honey, and sugar.',
        durationEstimate: 20,
      },
      {
        stepNumber: 3,
        title: 'Lakshmi Ashtottara Shatanamavali',
        description: 'Chanting of the 108 names of Goddess Lakshmi.',
        durationEstimate: 15,
      },
      {
        stepNumber: 4,
        title: 'Deepa Puja & Aarti',
        description: 'Offering of lamps and final prayers for prosperity.',
        durationEstimate: 15,
      },
    ],
  },
  {
    name: 'Saraswati Puja',
    description:
      'Ritual dedicated to Goddess Saraswati, the deity of knowledge, music, arts, and wisdom.',
    history:
      'Saraswati Puja celebrates the goddess of learning and arts. The tradition dates back to Vedic times where knowledge was considered the highest pursuit. Celebrated prominently on Vasant Panchami, students and scholars worship books, instruments, and tools of their craft. Yellow is the symbolic color representing the mustard fields of spring.',
    category: 'puja',
    subcategory: 'deity',
    duration: { typical: 60, minimum: 45, maximum: 90 },
    pricing: { basePrice: 1500, priceRange: { min: 1500, max: 2500 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      {
        url: '/public/images/ceremonies/deity_puja.png',
        alt: 'Saraswati Puja Setup',
        isPrimary: true,
      },
    ],
    requirements: {
      materials: [
        { name: 'Yellow Flowers', quantity: '1 bunch', isOptional: false, providedBy: 'devotee' },
        { name: 'White Cloth', quantity: '1', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Books/Instruments (for blessing)',
          quantity: 'As needed',
          isOptional: true,
          providedBy: 'devotee',
        },
        { name: 'Incense Sticks', quantity: '1 packet', isOptional: false, providedBy: 'devotee' },
        { name: 'Camphor', quantity: 'Small box', isOptional: false, providedBy: 'devotee' },
        { name: 'Ghee Lamp', quantity: '1', isOptional: false, providedBy: 'devotee' },
        { name: 'Fruits', quantity: '5 pieces', isOptional: false, providedBy: 'devotee' },
        { name: 'Turmeric & Kumkum', quantity: '1 set', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Saraswati Murti or Photo',
          quantity: '1',
          isOptional: true,
          providedBy: 'devotee',
        },
      ],
      specialInstructions: [
        'Place books and musical instruments near the puja area for blessings.',
      ],
    },
  },

  // --- FIRE RITUALS (Image: havan.png) ---
  {
    name: 'Maha Mrityunjaya Homa',
    description:
      'Powerful fire ritual dedicated to Lord Shiva for health, longevity, and protection from untimely death.',
    history:
      "The Maha Mrityunjaya mantra is one of the oldest and most powerful Vedic mantras, found in the Rig Veda. This homa is performed to seek Lord Shiva's protection from illness and death. It is often conducted during health crises, birthdays, or to mark recovery from illness.",
    category: 'puja',
    subcategory: 'havan',
    duration: { typical: 180, minimum: 120, maximum: 240 },
    pricing: { basePrice: 5100, priceRange: { min: 5100, max: 11000 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [{ url: '/public/images/ceremonies/havan.png', alt: 'Havan Ritual', isPrimary: true }],
    requirements: {
      materials: [
        {
          name: 'Ghee (Clarified Butter)',
          quantity: '1 kg',
          isOptional: false,
          providedBy: 'devotee',
        },
        {
          name: 'Havan Samagri (Pre-mixed)',
          quantity: '500g',
          isOptional: false,
          providedBy: 'priest',
        },
        {
          name: 'Mango Wood (Aam ki Lakdi)',
          quantity: '2 kg',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Camphor', quantity: '1 box', isOptional: false, providedBy: 'devotee' },
        { name: 'Coconut', quantity: '2', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Black Sesame Seeds (Til)',
          quantity: '250g',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Honey', quantity: '100ml', isOptional: false, providedBy: 'devotee' },
        { name: 'Incense Sticks', quantity: '1 packet', isOptional: false, providedBy: 'devotee' },
        { name: 'Havan Kund (Fire Pit)', quantity: '1', isOptional: false, providedBy: 'either' },
      ],
      spaceRequirements: 'Open or well-ventilated area required for fire ritual.',
      specialInstructions: [
        'Ensure proper ventilation.',
        'Keep fire extinguisher or water bucket nearby.',
      ],
    },
  },
  {
    name: 'Navagraha Shanti Homa',
    description: 'Ceremony to appease the nine planetary deities and remove astrological doshas.',
    history:
      "Navagraha worship traces its roots to Vedic astrology (Jyotish Shastra). The nine planets — Surya, Chandra, Mangal, Budh, Guru, Shukra, Shani, Rahu, and Ketu — influence all aspects of human life. This homa pacifies unfavorable planetary positions in one's horoscope.",
    category: 'puja',
    subcategory: 'havan',
    duration: { typical: 150, minimum: 120, maximum: 180 },
    pricing: { basePrice: 4100, priceRange: { min: 4100, max: 7100 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      { url: '/public/images/ceremonies/havan.png', alt: 'Navagraha Havan', isPrimary: true },
    ],
    requirements: {
      materials: [
        {
          name: 'Navagraha Samidha (9 types of wood)',
          quantity: '1 set',
          isOptional: false,
          providedBy: 'priest',
        },
        {
          name: 'Navagraha Dhanya (9 types of grains)',
          quantity: '1 set',
          isOptional: false,
          providedBy: 'priest',
        },
        { name: 'Ghee', quantity: '500g', isOptional: false, providedBy: 'devotee' },
        { name: 'Havan Samagri', quantity: '500g', isOptional: false, providedBy: 'priest' },
        {
          name: 'Flowers (mixed colors)',
          quantity: '1 bunch',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Coconut', quantity: '1', isOptional: false, providedBy: 'devotee' },
        { name: 'Incense Sticks', quantity: '1 packet', isOptional: false, providedBy: 'devotee' },
        { name: 'Havan Kund', quantity: '1', isOptional: false, providedBy: 'either' },
      ],
      specialInstructions: ['Bring your horoscope (Kundli) if available for personalized mantras.'],
    },
  },
  {
    name: 'Vastu Shanti Puja',
    description:
      'Ritual performed before entering a new home or office to remove negative energies and invoke blessings.',
    history:
      'Vastu Shastra is the ancient Indian science of architecture and spatial arrangement. Vastu Shanti Puja is performed to harmonize the five elements (Panch Mahabhuta) in a new dwelling and appease Vastu Purusha, the deity of directions. It ensures peace, prosperity, and protection from negative influences.',
    category: 'housewarming',
    subcategory: 'havan',
    duration: { typical: 180, minimum: 120, maximum: 240 },
    pricing: { basePrice: 5100, priceRange: { min: 5100, max: 11000 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      { url: '/public/images/ceremonies/havan.png', alt: 'Vastu Shanti Havan', isPrimary: true },
    ],
    requirements: {
      materials: [
        { name: 'Pumpkins', quantity: '2', isOptional: false, providedBy: 'devotee' },
        { name: 'Coconut', quantity: '5', isOptional: false, providedBy: 'devotee' },
        { name: 'Ghee', quantity: '1 kg', isOptional: false, providedBy: 'devotee' },
        { name: 'Havan Samagri', quantity: '500g', isOptional: false, providedBy: 'priest' },
        {
          name: 'Red Thread (Mauli)',
          quantity: '1 roll',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Turmeric & Kumkum', quantity: '1 set', isOptional: false, providedBy: 'devotee' },
        { name: 'Incense Sticks', quantity: '1 packet', isOptional: false, providedBy: 'devotee' },
        { name: 'Camphor', quantity: '1 box', isOptional: false, providedBy: 'devotee' },
        { name: 'Flowers', quantity: '1 bunch', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Milk (for boiling ritual)',
          quantity: '1 litre',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Havan Kund', quantity: '1', isOptional: false, providedBy: 'either' },
      ],
      spaceRequirements: 'Performed inside the new home/office — needs open central area.',
      specialInstructions: [
        'Home should be cleaned before the puja.',
        'Boil milk to overflowing as part of Griha Pravesh ritual.',
      ],
    },
  },
  {
    name: 'Upanayana (Thread Ceremony)',
    description:
      'Sacred rite of passage that marks the acceptance of a student by a Guru (initiation).',
    history:
      "Upanayana is one of the 16 Samskaras (sacraments) in Hinduism, marking the child's entry into formal education under a Guru. The sacred thread (Yagnopavita) represents the three debts — to the sages, ancestors, and gods. This ceremony has been practiced since Vedic times and is considered a spiritual rebirth.",
    category: 'thread-ceremony',
    subcategory: 'samskara',
    duration: { typical: 240, minimum: 180, maximum: 360 },
    pricing: { basePrice: 7100, priceRange: { min: 7100, max: 15000 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      { url: '/public/images/ceremonies/havan.png', alt: 'Thread Ceremony Fire', isPrimary: true },
    ],
    requirements: {
      materials: [
        {
          name: 'Yagnopavita (Sacred Thread)',
          quantity: '1',
          isOptional: false,
          providedBy: 'priest',
        },
        {
          name: 'Mekala (Girdle of Munja Grass)',
          quantity: '1',
          isOptional: false,
          providedBy: 'priest',
        },
        { name: 'Danda (Staff)', quantity: '1', isOptional: false, providedBy: 'priest' },
        {
          name: 'Ajina (Deer Skin or Cloth)',
          quantity: '1',
          isOptional: true,
          providedBy: 'devotee',
        },
        { name: 'Ghee', quantity: '500g', isOptional: false, providedBy: 'devotee' },
        { name: 'Havan Samagri', quantity: '500g', isOptional: false, providedBy: 'priest' },
        {
          name: 'New Dhoti for the child',
          quantity: '1',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Coconut', quantity: '2', isOptional: false, providedBy: 'devotee' },
        { name: 'Flowers & Fruits', quantity: '1 set', isOptional: false, providedBy: 'devotee' },
        { name: 'Havan Kund', quantity: '1', isOptional: false, providedBy: 'either' },
      ],
      specialInstructions: [
        'The child should fast from the previous night.',
        'New white/yellow clothes for the child.',
      ],
    },
  },

  // --- BABY CEREMONIES (Image: baby_ceremony.png) ---
  {
    name: 'Namkaran Sanskar',
    description:
      'Naming ceremony for the newborn, invoking blessings for a long and prosperous life.',
    history:
      "Namkaran is one of the 16 Samskaras in Hinduism. It is traditionally performed on the 11th or 12th day after birth. The name is chosen based on the child's Nakshatra (birth star) and horoscope. A formal announcement is made to family and community, and the priest chants mantras for the child's well-being.",
    category: 'baby-naming',
    subcategory: 'samskara',
    duration: { typical: 60, minimum: 45, maximum: 90 },
    pricing: { basePrice: 2100, priceRange: { min: 2100, max: 3100 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      {
        url: '/public/images/ceremonies/baby_ceremony.png',
        alt: 'Naming Ceremony',
        isPrimary: true,
      },
    ],
    requirements: {
      materials: [
        { name: 'Honey', quantity: 'Small bowl', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Gold Ring or Pen (for writing name)',
          quantity: '1',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Rice Grains', quantity: '250g', isOptional: false, providedBy: 'devotee' },
        { name: 'Turmeric & Kumkum', quantity: '1 set', isOptional: false, providedBy: 'devotee' },
        { name: 'Flowers', quantity: '1 bunch', isOptional: false, providedBy: 'devotee' },
        { name: 'New Cloth for Baby', quantity: '1', isOptional: false, providedBy: 'devotee' },
        { name: 'Incense & Camphor', quantity: '1 set', isOptional: false, providedBy: 'devotee' },
        { name: 'Ghee Lamp', quantity: '1', isOptional: false, providedBy: 'devotee' },
      ],
      specialInstructions: [
        'Baby should be bathed and dressed in new clothes before the ceremony.',
      ],
    },
  },
  {
    name: 'Annaprashan',
    description: "First rice-feeding ceremony, marking the baby's transition to solid food.",
    history:
      "Annaprashan, also known as the first rice-feeding ceremony, is performed when the baby is 6-7 months old. It marks the child's transition from mother's milk to solid food. The ceremony symbolizes the child's growth and is believed to bless the child with a healthy appetite and good health.",
    category: 'baby-naming',
    subcategory: 'samskara',
    duration: { typical: 60, minimum: 45, maximum: 90 },
    pricing: { basePrice: 2100, priceRange: { min: 2100, max: 3100 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      {
        url: '/public/images/ceremonies/baby_ceremony.png',
        alt: 'First Rice Feeding',
        isPrimary: true,
      },
    ],
    requirements: {
      materials: [
        { name: 'Payasam/Kheer', quantity: '1 bowl', isOptional: false, providedBy: 'devotee' },
        { name: 'Cooked Rice', quantity: '1 plate', isOptional: false, providedBy: 'devotee' },
        { name: 'Silver Bowl & Spoon', quantity: '1 set', isOptional: true, providedBy: 'devotee' },
        { name: 'Flowers', quantity: '1 bunch', isOptional: false, providedBy: 'devotee' },
        { name: 'Turmeric & Kumkum', quantity: '1 set', isOptional: false, providedBy: 'devotee' },
        {
          name: 'New Clothes for Baby',
          quantity: '1 set',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Incense & Camphor', quantity: '1 set', isOptional: false, providedBy: 'devotee' },
      ],
      specialInstructions: [
        'Baby should be dressed in new clothes.',
        'Place symbolic items (book, pen, clay, gold) for the baby to pick.',
      ],
    },
  },
  {
    name: 'Mundan Sanskar',
    description:
      "Head tonsuring ceremony for the child, symbolizing purity and the shedding of past life's negativity.",
    history:
      "Mundan Sanskar is believed to cleanse the child by removing the birth hair, which is considered impure. The ceremony usually takes place in the first or third year of the child's life. It is believed to stimulate brain growth, strengthen the skull, and mark a fresh start in the child's life.",
    category: 'special-occasion',
    subcategory: 'samskara',
    duration: { typical: 90, minimum: 60, maximum: 120 },
    pricing: { basePrice: 2500, priceRange: { min: 2500, max: 3500 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      {
        url: '/public/images/ceremonies/baby_ceremony.png',
        alt: 'Mundan Ceremony',
        isPrimary: true,
      },
    ],
    requirements: {
      materials: [
        { name: 'Barber (Nai)', quantity: '1', isOptional: false, providedBy: 'devotee' },
        { name: 'Razor/Scissors', quantity: '1', isOptional: false, providedBy: 'devotee' },
        { name: 'Turmeric Paste', quantity: '50g', isOptional: false, providedBy: 'devotee' },
        { name: 'Coconut', quantity: '1', isOptional: false, providedBy: 'devotee' },
        {
          name: 'New Clothes for Child',
          quantity: '1 set',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Flowers & Fruits', quantity: '1 set', isOptional: false, providedBy: 'devotee' },
        { name: 'Incense & Camphor', quantity: '1 set', isOptional: false, providedBy: 'devotee' },
      ],
      specialInstructions: [
        'Arrange a barber in advance.',
        "Apply turmeric paste on the child's head after shaving.",
      ],
    },
  },

  // --- WEDDING RITUALS (Image: wedding.png) ---
  {
    name: 'Vivah Sanskar',
    description:
      'Complete Hindu wedding ceremony comprising rituals like Kanyadaan, Panigrahana, and Saptapadi.',
    history:
      'Vivah is the most sacred of all Hindu Samskaras. It unites two souls and two families through sacred fire and Vedic mantras. The Saptapadi (seven steps) represents seven vows taken around the fire, and the ceremony typically includes Kanyadaan, Mangal Sutra, Sindoor, and blessings from elders.',
    category: 'wedding',
    subcategory: 'samskara',
    duration: { typical: 240, minimum: 180, maximum: 480 },
    pricing: { basePrice: 21000, priceRange: { min: 21000, max: 51000 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      { url: '/public/images/ceremonies/wedding.png', alt: 'Wedding Rituals', isPrimary: true },
    ],
    requirements: {
      materials: [
        { name: 'Garlands (Varmala)', quantity: '2', isOptional: false, providedBy: 'devotee' },
        { name: 'Mangal Sutra', quantity: '1', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Sindoor (Vermillion)',
          quantity: '1 box',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Rice (Akshata)', quantity: '2 kg', isOptional: false, providedBy: 'devotee' },
        { name: 'Ghee', quantity: '1 kg', isOptional: false, providedBy: 'devotee' },
        { name: 'Havan Samagri', quantity: '1 kg', isOptional: false, providedBy: 'priest' },
        { name: 'Coconuts', quantity: '5', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Sacred Fire (Havan Kund)',
          quantity: '1',
          isOptional: false,
          providedBy: 'either',
        },
        {
          name: 'Puffed Rice (Lajja Hom)',
          quantity: '500g',
          isOptional: false,
          providedBy: 'devotee',
        },
        {
          name: 'Flowers & Fruits',
          quantity: '1 large set',
          isOptional: false,
          providedBy: 'devotee',
        },
      ],
      spaceRequirements: 'Mandap (canopy) area with seating for families.',
      specialInstructions: [
        'Mandap should be set up before the priest arrives.',
        'Both families should be present for Kanyadaan.',
      ],
    },
  },
  {
    name: 'Sagaai (Engagement)',
    description:
      'Ring exchange ceremony marking the formal agreement of marriage between families.',
    history:
      "Sagaai, or the engagement ceremony, is the formal announcement of a couple's intention to marry. Both families exchange rings, gifts, and sweets as a symbol of agreement. The ceremony is often accompanied by prayers and blessings from the priest.",
    category: 'wedding',
    subcategory: 'pre-wedding',
    duration: { typical: 90, minimum: 60, maximum: 120 },
    pricing: { basePrice: 5100, priceRange: { min: 5100, max: 11000 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      {
        url: '/public/images/ceremonies/wedding.png',
        alt: 'Engagement Ring Ceremony',
        isPrimary: true,
      },
    ],
    requirements: {
      materials: [
        { name: 'Rings', quantity: '2', isOptional: false, providedBy: 'devotee' },
        { name: 'Sweets', quantity: '2 kg', isOptional: false, providedBy: 'devotee' },
        { name: 'Fruits', quantity: '1 basket', isOptional: false, providedBy: 'devotee' },
        { name: 'Flowers', quantity: '1 bunch', isOptional: false, providedBy: 'devotee' },
        { name: 'Coconut', quantity: '2', isOptional: false, providedBy: 'devotee' },
        { name: 'Turmeric & Kumkum', quantity: '1 set', isOptional: false, providedBy: 'devotee' },
      ],
    },
  },
  {
    name: 'Roka Ceremony',
    description:
      'The first official step towards marriage, where families exchange gifts and blessings.',
    history:
      "The Roka ceremony is a North Indian tradition that formally initiates the marriage process. It involves the girl's family visiting the boy's family to 'reserve' or 'block' the groom. Gifts, dry fruits, and shagun (auspicious amount) are exchanged, symbolizing the families' acceptance of each other.",
    category: 'wedding',
    subcategory: 'pre-wedding',
    duration: { typical: 60, minimum: 45, maximum: 90 },
    pricing: { basePrice: 3100, priceRange: { min: 3100, max: 5100 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      { url: '/public/images/ceremonies/wedding.png', alt: 'Roka Ceremony', isPrimary: true },
    ],
    requirements: {
      materials: [
        { name: 'Sweets', quantity: '2 kg', isOptional: false, providedBy: 'devotee' },
        { name: 'Dry Fruits', quantity: '1 kg', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Shagun Envelope (Cash Gift)',
          quantity: '1',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Coconut', quantity: '1', isOptional: false, providedBy: 'devotee' },
        { name: 'Fruits', quantity: '1 basket', isOptional: true, providedBy: 'devotee' },
      ],
    },
  },

  // --- HOLY READINGS (Image: reading.png) ---
  {
    name: 'Sundarkand Path',
    description:
      'Recitation of the Sundarkand chapter from Ramayana, dedicated to Lord Hanuman for strength and courage.',
    history:
      "Sundarkand is the fifth book of the Ramayana, describing Hanuman's journey to Lanka to find Sita. It is considered the most beautiful (Sundar) chapter. Regular recitation is believed to remove obstacles, grant courage, and bring peace. It is often performed on Tuesdays and Saturdays.",
    category: 'puja',
    subcategory: 'reading',
    duration: { typical: 150, minimum: 120, maximum: 180 },
    pricing: { basePrice: 3500, priceRange: { min: 3500, max: 5100 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      { url: '/public/images/ceremonies/reading.png', alt: 'Sundarkand Reading', isPrimary: true },
    ],
    requirements: {
      materials: [
        { name: 'Ramcharitmanas Book', quantity: '1', isOptional: false, providedBy: 'priest' },
        { name: 'Ghee Lamp', quantity: '1', isOptional: false, providedBy: 'devotee' },
        { name: 'Incense Sticks', quantity: '1 packet', isOptional: false, providedBy: 'devotee' },
        { name: 'Flowers', quantity: '1 bunch', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Prasad (Fruits & Sweets)',
          quantity: 'As available',
          isOptional: false,
          providedBy: 'devotee',
        },
      ],
    },
  },
  {
    name: 'Akhand Ramayan Path',
    description: 'Continuous 24-hour recitation of the entire Ramcharitmanas.',
    history:
      "Akhand Ramayan Path is a non-stop recitation of Goswami Tulsidas's Ramcharitmanas, spanning 24 hours. It requires a team of priests who take turns reading. This path is performed during auspicious occasions, festivals, or to seek divine intervention during difficult times. It fills the home with sacred vibrations.",
    category: 'puja',
    subcategory: 'reading',
    duration: { typical: 1440, minimum: 1400, maximum: 1500 }, // 24 hours
    pricing: { basePrice: 15000, priceRange: { min: 15000, max: 25000 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      { url: '/public/images/ceremonies/reading.png', alt: 'Ramayan Reading', isPrimary: true },
    ],
    requirements: {
      materials: [
        { name: 'Ramcharitmanas Book', quantity: '1', isOptional: false, providedBy: 'priest' },
        { name: 'Ghee Lamps', quantity: '2', isOptional: false, providedBy: 'devotee' },
        { name: 'Incense Sticks', quantity: '3 packets', isOptional: false, providedBy: 'devotee' },
        { name: 'Flowers', quantity: '2 bunches', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Prasad (for distribution)',
          quantity: 'As needed',
          isOptional: false,
          providedBy: 'devotee',
        },
        {
          name: 'Seating Arrangements for Priests',
          quantity: 'For team',
          isOptional: false,
          providedBy: 'devotee',
        },
      ],
      spaceRequirements: 'Dedicated room or area that can remain undisturbed for 24+ hours.',
      specialInstructions: [
        'Reading must not be interrupted once started.',
        'At least one listener should be present at all times.',
      ],
    },
    ritualSteps: [
      {
        stepNumber: 1,
        title: 'Sankalpam',
        description: 'Vowing to complete the parayan with devotion.',
        durationEstimate: 10,
      },
      {
        stepNumber: 2,
        title: 'Katha Path',
        description: 'Continuous reading of the sacred text.',
        durationEstimate: 120,
      },
    ],
  },
  {
    name: 'Satyanarayan Puja',
    description:
      'A popular ritual dedicated to Lord Vishnu in his form as Satyanarayan (The Lord of Truth).',
    history:
      'Satyanarayan Puja is one of the most common and beloved Hindu rituals. It is performed on any auspicious occasion or on Purnima (full moon) days. The ritual emphasizes the importance of truth and gratitude. It involves the reading of the Satyanaran Katha, which consists of five short stories illustrating the benefits of performing the puja and the consequences of neglecting it.',
    category: 'puja',
    subcategory: 'deity',
    duration: { typical: 120, minimum: 90, maximum: 150 },
    pricing: { basePrice: 2100, priceRange: { min: 2100, max: 3500 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      {
        url: '/public/images/ceremonies/deity_puja.png',
        alt: 'Satyanarayan Puja Setup',
        isPrimary: true,
      },
    ],
    requirements: {
      materials: [
        { name: 'Satyanarayan Photo', quantity: '1', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Banana Stems & Leaves',
          quantity: '4 stems',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Mango Leaves', quantity: '11', isOptional: false, providedBy: 'devotee' },
        { name: 'Coconut', quantity: '2', isOptional: false, providedBy: 'devotee' },
        { name: 'Panchamrut', quantity: '1 bowl', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Suji (Semolina) for Prasad',
          quantity: '250g',
          isOptional: false,
          providedBy: 'devotee',
        },
        {
          name: 'Sugar & Milk for Prasad',
          quantity: 'As needed',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Fruits & Flowers', quantity: '1 set', isOptional: false, providedBy: 'devotee' },
        { name: 'Incense & Camphor', quantity: '1 set', isOptional: false, providedBy: 'devotee' },
        { name: 'Tulsi Leaves', quantity: '1 bunch', isOptional: false, providedBy: 'devotee' },
      ],
      specialInstructions: [
        "Prepare the 'Sheera' (Prasad) using suji, sugar, milk, and bananas.",
        'A mandap should be prepared using banana stems at the four corners.',
      ],
    },
    ritualSteps: [
      {
        stepNumber: 1,
        title: 'Ganesh & Navagraha Puja',
        description: 'Initial worship to avoid obstacles and seek planetary blessings.',
        durationEstimate: 20,
      },
      {
        stepNumber: 2,
        title: 'Satyanarayan Avahana',
        description: 'Invoking Lord Satyanarayan into the main deity/kalash.',
        durationEstimate: 15,
      },
      {
        stepNumber: 3,
        title: 'Satyanarayan Katha',
        description: 'Reading and listening to the five sacred stories of the ritual.',
        durationEstimate: 60,
      },
      {
        stepNumber: 4,
        title: 'Aarti & Distribution of Prasad',
        description: 'Concluding prayers and sharing the blessed offering.',
        durationEstimate: 25,
      },
    ],
  },
  {
    name: 'Griha Pravesh',
    description: 'Housewarming ceremony performed when entering a new house for the first time.',
    history:
      'Griha Pravesh is a sacred ceremony to purify a new home and protect it from negative energies. It is usually performed on an auspicious date (Muhurta) determined by the lunar calendar. The ritual involves Vastu Shanti (to appease the gods of directions) and Navagraha Homa. Boiling milk until it overflows is a symbolic tradition representing abundance and prosperity.',
    category: 'housewarming',
    subcategory: 'domestic',
    duration: { typical: 180, minimum: 120, maximum: 240 },
    pricing: { basePrice: 5100, priceRange: { min: 5100, max: 11000 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      {
        url: '/public/images/ceremonies/housewarming.png',
        alt: 'Griha Pravesh Setup',
        isPrimary: true,
      },
    ],
    requirements: {
      materials: [
        {
          name: 'Kalash (Copper/Brass pot)',
          quantity: '1',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Milk for boiling', quantity: '1 Litre', isOptional: false, providedBy: 'devotee' },
        { name: 'New Vessel for milk', quantity: '1', isOptional: false, providedBy: 'devotee' },
        { name: 'Havan Kund & Wood', quantity: '1 set', isOptional: true, providedBy: 'priest' },
        { name: 'Ghee & Havan Samagri', quantity: '500g', isOptional: false, providedBy: 'priest' },
        { name: 'Flowers & Garlands', quantity: '3-4', isOptional: false, providedBy: 'devotee' },
        {
          name: 'Toran (Mango leaves string)',
          quantity: '1',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Gourd (for Vastu)', quantity: '1', isOptional: false, providedBy: 'devotee' },
      ],
      specialInstructions: [
        'The auspicious entry (Pravesh) should happen at the exact Muhurta time.',
        'Ensure the kitchen stove is ready for the milk boiling ritual.',
      ],
    },
    ritualSteps: [
      {
        stepNumber: 1,
        title: 'Dwara Puja',
        description: 'Worshipping the main entrance of the house.',
        durationEstimate: 15,
      },
      {
        stepNumber: 2,
        title: 'Vastu Shanti & Navagraha Homa',
        description: 'Sacred fire ritual to purify the space and appease planetary deities.',
        durationEstimate: 90,
      },
      {
        stepNumber: 3,
        title: 'Milk Boiling Ritual',
        description: 'Symbolic boiling of milk in the kitchen until it overflows.',
        durationEstimate: 20,
      },
      {
        stepNumber: 4,
        title: 'Ganapati Aarti & Satyanarayan Path',
        description: 'Final prayers and establishment of the deity in the new home.',
        durationEstimate: 55,
      },
    ],
  },
  {
    name: 'Ganapati Homa',
    description:
      'Sacred fire ritual dedicated to Lord Ganesha for success and removal of obstacles.',
    history:
      'Ganapati Homa is a powerful Vedic fire ritual. It is often performed early in the morning, usually before sunrise. The offerings of Modak, Ghee, and Ashwagandha into the sacred fire are believed to invoke the energy of Ganesha directly. It is recommended for students, businessmen, and anyone facing persistent hurdles in their life path.',
    category: 'puja',
    subcategory: 'homa',
    duration: { typical: 90, minimum: 60, maximum: 120 },
    pricing: { basePrice: 3500, priceRange: { min: 3500, max: 7500 }, factors: [] },
    religiousTraditions: ['Hindu'],
    images: [
      { url: '/public/images/ceremonies/homa.png', alt: 'Ganapati Homa Setup', isPrimary: true },
    ],
    requirements: {
      materials: [
        { name: 'Havan Kund', quantity: '1', isOptional: true, providedBy: 'priest' },
        {
          name: 'Dried Coconut (Whole)',
          quantity: '8-10',
          isOptional: false,
          providedBy: 'devotee',
        },
        { name: 'Ghee', quantity: '1 Litre', isOptional: false, providedBy: 'devotee' },
        { name: 'Modak (for Ahuti)', quantity: '21', isOptional: false, providedBy: 'devotee' },
        { name: 'Havan Samagri Mix', quantity: '1kg', isOptional: false, providedBy: 'priest' },
        { name: 'Sandalwood sticks', quantity: '5-6', isOptional: false, providedBy: 'priest' },
        {
          name: 'Fruits & Dry fruits',
          quantity: '1 set',
          isOptional: false,
          providedBy: 'devotee',
        },
      ],
      specialInstructions: [
        'Homa should ideally be performed during Brahma Muhurta (early morning).',
        'Participant should wear traditional clean clothes.',
      ],
    },
    ritualSteps: [
      {
        stepNumber: 1,
        title: 'Agni Mukham',
        description: 'Preparing the sacred fire and invoking the god of fire, Agni.',
        durationEstimate: 20,
      },
      {
        stepNumber: 2,
        title: 'Ganapati Atharvashirsha Ahuti',
        description: 'Offering oblations while chanting the sacred Ganesha hymns.',
        durationEstimate: 40,
      },
      {
        stepNumber: 3,
        title: 'Purnahuti',
        description:
          'The final offering representing the complete surrender and fulfillment of the ritual.',
        durationEstimate: 10,
      },
      {
        stepNumber: 4,
        title: 'Ganesha Aarti',
        description: 'Closing prayers and distribution of the sacred ash (Vibhuti).',
        durationEstimate: 20,
      },
    ],
  },
];

const seedCeremonies = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) throw new Error('Missing MONGO_URI in .env');
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
