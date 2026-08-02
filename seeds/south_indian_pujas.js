// One-off, non-destructive import of the "Top 20 South Indian Pujas" catalog.
// Upserts by name — safe to re-run, never touches unrelated ceremonies.
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Ceremony = require('../models/ceremony');

dotenv.config();

// Reusable descriptions for ritual step titles that recur across multiple
// ceremonies in the source data without their own per-step description.
const STEP_DESCRIPTIONS = {
  'Sankalpam': 'Ritual vow declaring the intention and purpose of the ceremony.',
  'Ganesh Puja': 'Worship of Lord Ganesha to remove obstacles before the main rite.',
  'Ganesh Avahanam': 'Invocation of Lord Ganesha into the ceremony.',
  'Ganesh Vandana': 'Invoking Lord Ganesha to remove obstacles.',
  'Shodashopachara Puja': 'Sixteen traditional offerings made to the deity.',
  'Archana': 'Chanting of sacred names while offering flowers.',
  'Naivedyam': 'Offering of food to the deity.',
  'Harathi': 'Waving of the ceremonial flame (aarti) before the deity.',
  'Ashirvadam': 'Final blessings given to the devotees.',
  'Kalasha Sthapana': 'Consecration of the sacred kalasha (pot), invoking holy rivers.',
  'Satyanarayana Puja': 'Main worship of Lord Satyanarayana with offerings.',
  'Vratha Katha': 'Recitation of the sacred story associated with the vow.',
  'Prasadam': 'Distribution of the blessed offering to all present.',
  'Vastu Puja': 'Worship of the Vastu Purusha for a harmonious dwelling.',
  'Punyahavachanam': 'Purification ritual invoking sanctified water.',
  'Homam': 'Sacred fire ritual with mantra-chanted offerings.',
  'Milk Boiling': 'Boiling of milk in the new home, symbolizing prosperity.',
  'Blessings': 'Elders and priest bless the family and devotee.',
  'Bhoomi Devi Puja': 'Worship of Mother Earth before construction begins.',
  'Digbandhanam': 'Ritual binding of the directions for protection of the site.',
  'Lakshmi Avahanam': 'Invocation of Goddess Lakshmi into the ceremony.',
  'Rudrabhishekam': 'Sacred bathing of the Shiva Lingam with holy substances.',
  'Rudram Chant': 'Chanting of the Sri Rudram hymn from the Krishna Yajurveda.',
  'Navagraha Avahanam': 'Invocation of the nine planetary deities.',
  'Graha Archana': 'Individual worship offered to each planetary deity.',
  'Kalasha Puja': 'Worship of the sacred kalasha before the fire ritual.',
  'Purnahuti': 'Final, complete offering made into the sacred fire.',
  'Ayush Homam': 'Fire ritual invoking blessings of health and longevity.',
  'Lakshmi Puja': 'Worship of Goddess Lakshmi for wealth and prosperity.',
  'Kubera Puja': 'Worship of Lord Kubera, the deity of wealth.',
  'Chandi Parayanam': 'Recitation of the Chandi / Devi Mahatmyam scripture.',
  'Vehicle Decoration': 'Decorating the vehicle with flowers, lemon and turmeric.',
  'Seemantham Ritual': 'Blessing ritual performed for the mother-to-be.',
  'Naming Ritual': 'The infant is formally given their name.',
  'Feeding Ritual': "The infant is fed solid food (rice) for the first time.",
  'Saraswati Puja': 'Worship of Goddess Saraswati, deity of knowledge.',
  'Letter Writing': "The child writes their first letters, guided by an elder.",
  'Vishnu Puja': 'Worship of Lord Vishnu, invoking protection and grace.',
  'Kashi Yatra': "The groom's symbolic departure for renunciation, stopped by the bride's father.",
  'Kanyadanam': 'The father formally gives away the bride.',
  'Jeelakarra Bellam': "Mixture of cumin and jaggery placed on the couple's heads, symbolizing unity.",
  'Mangalya Dharana': "The groom ties the mangalsutra around the bride's neck.",
  'Saptapadi': 'The couple take seven sacred steps together, exchanging vows.',
};

// "Name (quantity[, providedBy])" or a bare name, semicolon-separated.
function parseMaterials(raw) {
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      if (!match) return { name: entry, quantity: 'As required', providedBy: 'devotee' };

      const name = match[1].trim();
      const [qtyRaw, providerRaw] = match[2].split(',').map((s) => s.trim());
      let providedBy = 'devotee';
      if (providerRaw) {
        const p = providerRaw.toLowerCase();
        if (p.includes('priest')) providedBy = 'priest';
        else if (p.includes('either')) providedBy = 'either';
      }
      return { name, quantity: qtyRaw || 'As required', providedBy };
    });
}

// "N. Title (mins): Description" or plain "Title (mins)", pipe-separated.
function parseSteps(raw) {
  return raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry, idx) => {
      const withoutNumbering = entry.replace(/^\d+\.\s*/, '');
      const match = withoutNumbering.match(/^(.*?)\s*\((\d+)\)\s*(?::\s*(.*))?$/);

      let title = withoutNumbering;
      let durationEstimate;
      let description;

      if (match) {
        title = match[1].trim();
        durationEstimate = parseInt(match[2], 10);
        description = match[3] ? match[3].trim() : undefined;
      }
      if (!description) {
        description = STEP_DESCRIPTIONS[title] || `${title} — part of the ceremony ritual sequence.`;
      }

      return { stepNumber: idx + 1, title, description, durationEstimate };
    });
}

// Raw rows transcribed from BMP_Top20_South_Indian_Pujas.csv, plus a
// category/subcategory assignment (not present in the source file — mapped
// onto the app's fixed Ceremony.category enum).
const ROWS = [
  { name: 'Ganesh Puja', category: 'puja', subcategory: 'ganesh-puja',
    description: 'Worship of Lord Ganesha to remove obstacles before new beginnings.',
    history: 'Lord Ganesha is revered as Vighnaharta. This puja is traditionally performed before every auspicious ceremony.',
    duration: [120, 90, 180], price: [2100, 2100, 5100],
    materials: 'Kumkum (1 pkt, Devotee); Turmeric (1 pkt); Rice (2 kg); Flowers (2 kg); Coconut (2); Betel Leaves (21); Betel Nuts (11); Fruits (5 varieties); Incense (1 pack); Camphor (1 pack); Ghee (500 ml); Ganesh Idol (1)',
    steps: '1. Sankalpam (10): Initial resolution chant | 2. Ganesh Avahanam (10): Invocation | 3. Shodashopachara Puja (40): Sixteen offerings | 4. Archana (20): Chanting 108 names | 5. Naivedyam (15): Food offering | 6. Harathi (10): Aarti | 7. Ashirvadam (15): Blessings' },

  { name: 'Satyanarayana Swamy Vratham', category: 'puja', subcategory: 'satyanarayana-vratham',
    description: 'Sacred Vishnu vrata for prosperity and family well-being.',
    history: 'Mentioned in Skanda Purana and widely observed after marriages and housewarming.',
    duration: [180, 150, 240], price: [3500, 3000, 7000],
    materials: 'Kalash; Mango Leaves; Coconut; Flowers; Fruits; Banana Leaves; Kumkum; Turmeric; Milk; Honey; Ghee; Sugar; Wheat Rava',
    steps: 'Sankalpam (15) | Ganesh Puja (20) | Kalasha Sthapana (15) | Satyanarayana Puja (60) | Vratha Katha (40) | Harathi (10) | Prasadam (20)' },

  { name: 'Gruha Pravesham', category: 'housewarming', subcategory: 'griha-pravesham',
    description: 'Housewarming ceremony seeking divine blessings before occupying a new home.',
    history: 'Ancient Vastu tradition performed before residing in a newly built or purchased house.',
    duration: [300, 240, 420], price: [8000, 7000, 18000],
    materials: 'Kalash; Mango Leaves; Cow Milk; Cow Dung; Flowers; Fruits; Rice; Coconut; Navadhanyalu; Ghee; Camphor',
    steps: 'Ganesh Puja (20) | Vastu Puja (30) | Punyahavachanam (15) | Kalasha Sthapana (15) | Homam (60) | Milk Boiling (15) | Harathi (10) | Blessings (10)' },

  { name: 'Bhoomi Puja', category: 'special-occasion', subcategory: 'bhoomi-puja',
    description: 'Ritual before construction begins.',
    history: 'Performed to seek permission from Mother Earth and Vastu Purusha.',
    duration: [180, 150, 240], price: [4500, 4000, 9000],
    materials: 'Bricks; Sand; Coconut; Flowers; Rice; Kumkum; Turmeric; Navadhanyalu; Kalash',
    steps: 'Sankalpam (10) | Ganesh Puja (15) | Bhoomi Devi Puja (30) | Vastu Puja (30) | Digbandhanam (20) | Homam (60) | Harathi (15)' },

  { name: 'Lakshmi Puja', category: 'puja', subcategory: 'lakshmi-puja',
    description: 'Prayer for wealth and prosperity.',
    history: 'Dedicated to Goddess Lakshmi, especially during Deepavali and Fridays.',
    duration: [90, 60, 120], price: [1800, 1800, 4500],
    materials: 'Lotus Flowers; Kumkum; Turmeric; Coins; Fruits; Sweets; Coconut; Ghee Lamp',
    steps: 'Sankalpam (10) | Ganesh Puja (15) | Lakshmi Avahanam (15) | Archana (20) | Naivedyam (15) | Harathi (10)' },

  { name: 'Rudrabhishekam', category: 'puja', subcategory: 'shiva-abhishekam',
    description: 'Abhishekam to Lord Shiva for peace and health.',
    history: 'Based on Sri Rudram from Krishna Yajurveda.',
    duration: [150, 120, 180], price: [3500, 3500, 8000],
    materials: 'Shiva Lingam; Milk; Curd; Honey; Ghee; Sugar; Bilva Leaves; Flowers; Coconut',
    steps: 'Sankalpam (10) | Ganesh Puja (15) | Rudrabhishekam (60) | Rudram Chant (30) | Archana (20) | Harathi (15)' },

  { name: 'Navagraha Puja', category: 'puja', subcategory: 'navagraha-puja',
    description: 'Prayer to the nine planetary deities.',
    history: 'Recommended in Vedic astrology for reducing planetary doshas.',
    duration: [150, 120, 210], price: [4000, 3500, 8500],
    materials: '9 Cloth Pieces; Navadhanyalu; Flowers; Kalash; Coconut; Fruits; Ghee',
    steps: 'Sankalpam (10) | Ganesh Puja (15) | Navagraha Avahanam (20) | Graha Archana (60) | Homam (30) | Harathi (15)' },

  { name: 'Maha Mrityunjaya Homam', category: 'puja', subcategory: 'homam',
    description: 'Homam for health and longevity.',
    history: 'Performed using the Maha Mrityunjaya Mantra dedicated to Lord Shiva.',
    duration: [240, 180, 300], price: [8000, 7000, 15000],
    materials: 'Homam Kundam; Samidhas; Ghee; Herbs; Bilva Leaves; Fruits; Flowers',
    steps: 'Sankalpam (15) | Ganesh Puja (15) | Kalasha Puja (15) | Homam (120) | Purnahuti (20) | Harathi (15)' },

  { name: 'Ganapathi Homam', category: 'puja', subcategory: 'homam',
    description: 'Fire ritual to invoke Lord Ganesha.',
    history: 'One of the most auspicious homams before major undertakings.',
    duration: [180, 150, 240], price: [5000, 4500, 9000],
    materials: 'Homam Kundam; Ghee; Samidhas; Durva Grass; Coconut; Fruits',
    steps: 'Sankalpam (15) | Ganesh Puja (15) | Homam (90) | Purnahuti (15) | Harathi (15)' },

  { name: 'Sudarshana Homam', category: 'puja', subcategory: 'homam',
    description: 'Homam for protection and removal of negativity.',
    history: "Dedicated to Lord Vishnu's Sudarshana Chakra.",
    duration: [240, 180, 300], price: [9000, 8000, 18000],
    materials: 'Homam Kundam; Ghee; Herbs; Tulasi; Flowers; Fruits',
    steps: 'Sankalpam (15) | Vishnu Puja (20) | Homam (120) | Purnahuti (20) | Harathi (15)' },

  { name: 'Ayush Homam', category: 'special-occasion', subcategory: 'ayush-homam',
    description: "Prayer for children's health and longevity.",
    history: 'Traditionally performed on birthdays, especially the first birthday.',
    duration: [180, 150, 240], price: [5500, 5000, 10000],
    materials: 'Kalash; Ghee; Herbs; Fruits; Flowers; Coconut',
    steps: 'Sankalpam (15) | Ganesh Puja (15) | Ayush Homam (90) | Purnahuti (15) | Harathi (15)' },

  { name: 'Lakshmi Kubera Homam', category: 'puja', subcategory: 'homam',
    description: 'Homam for wealth and financial prosperity.',
    history: 'Invokes Goddess Lakshmi and Lord Kubera.',
    duration: [240, 180, 300], price: [8500, 8000, 18000],
    materials: 'Lotus; Coins; Ghee; Herbs; Flowers; Coconut',
    steps: 'Sankalpam (15) | Lakshmi Puja (20) | Kubera Puja (20) | Homam (90) | Harathi (15)' },

  { name: 'Chandi Homam', category: 'puja', subcategory: 'homam',
    description: 'Powerful Devi homam for victory and protection.',
    history: 'Based on Devi Mahatmyam.',
    duration: [360, 300, 480], price: [15000, 12000, 30000],
    materials: 'Homam Kundam; Ghee; Herbs; Kumkum; Flowers; Fruits',
    steps: 'Sankalpam (15) | Ganesh Puja (15) | Chandi Parayanam (120) | Homam (90) | Purnahuti (20) | Harathi (20)' },

  { name: 'Vehicle Puja', category: 'special-occasion', subcategory: 'vehicle-puja',
    description: 'Blessing ceremony for a new vehicle.',
    history: 'Performed for safe journeys and protection.',
    duration: [45, 30, 60], price: [800, 500, 1500],
    materials: 'Lemon; Coconut; Flowers; Kumkum; Turmeric; Camphor',
    steps: 'Sankalpam (10) | Ganesh Puja (10) | Vehicle Decoration (15) | Harathi (10)' },

  { name: 'Office Opening Puja', category: 'corporate', subcategory: 'office-opening',
    description: 'Blessings for a new business or office.',
    history: 'Performed before commencing business operations.',
    duration: [90, 60, 120], price: [2500, 2000, 5000],
    materials: 'Kalash; Flowers; Coconut; Fruits; Kumkum; Turmeric',
    steps: 'Sankalpam (10) | Ganesh Puja (15) | Lakshmi Puja (20) | Harathi (10)' },

  { name: 'Seemantham', category: 'baby-naming', subcategory: 'seemantham',
    description: 'Traditional baby shower ceremony.',
    history: 'Blesses mother and unborn child.',
    duration: [180, 150, 240], price: [5000, 4500, 10000],
    materials: 'Turmeric; Kumkum; Bangles; Flowers; Fruits; Saree',
    steps: 'Sankalpam (10) | Ganesh Puja (15) | Seemantham Ritual (60) | Blessings (15) | Harathi (10)' },

  { name: 'Namakaranam', category: 'baby-naming', subcategory: 'namakaranam',
    description: 'Naming ceremony for a newborn.',
    history: 'One of the sixteen Hindu samskaras.',
    duration: [90, 60, 120], price: [2500, 2000, 5000],
    materials: 'Kalash; Flowers; Rice; Honey; Gold Ring',
    steps: 'Sankalpam (10) | Ganesh Puja (15) | Naming Ritual (30) | Blessings (15) | Harathi (10)' },

  { name: 'Annaprasana', category: 'baby-naming', subcategory: 'annaprasana',
    description: "Infant's first solid food ceremony.",
    history: 'Marks the first feeding of rice.',
    duration: [90, 60, 120], price: [2500, 2000, 5000],
    materials: 'Cooked Rice; Silver Bowl; Flowers; Fruits',
    steps: 'Sankalpam (10) | Ganesh Puja (15) | Feeding Ritual (30) | Blessings (15) | Harathi (10)' },

  { name: 'Aksharabhyasam', category: 'baby-naming', subcategory: 'aksharabhyasam',
    description: 'Initiation into education.',
    history: "Child writes first letters seeking Saraswati's blessings.",
    duration: [90, 60, 120], price: [2500, 2000, 5000],
    materials: 'Rice Tray; Slate; Chalk; Saraswati Photo; Flowers',
    steps: 'Sankalpam (10) | Ganesh Puja (15) | Saraswati Puja (20) | Letter Writing (25) | Harathi (10)' },

  { name: 'Vivaham (Hindu Wedding)', category: 'wedding', subcategory: 'vivaham',
    description: 'Complete Vedic marriage ceremony.',
    history: 'One of the most important Hindu samskaras uniting two families.',
    duration: [360, 300, 600], price: [25000, 15000, 75000],
    materials: 'Mangalasutra; Jeelakarra Bellam; Rice; Flowers; Coconuts; Garlands; Homam Items',
    steps: 'Ganesh Puja (20) | Kashi Yatra (15) | Kanyadanam (20) | Jeelakarra Bellam (10) | Mangalya Dharana (15) | Saptapadi (20) | Homam (60) | Ashirvadam (15)' },
];

function buildCeremonyDoc(row) {
  const [typical, minimum, maximum] = row.duration;
  const [basePrice, min, max] = row.price;
  return {
    name: row.name,
    description: row.description,
    history: row.history,
    category: row.category,
    subcategory: row.subcategory,
    duration: { typical, minimum, maximum },
    pricing: { basePrice, priceRange: { min, max } },
    requirements: { materials: parseMaterials(row.materials) },
    ritualSteps: parseSteps(row.steps),
    religiousTraditions: ['Hindu'],
    regions: ['South India'],
    languages: ['Telugu', 'Tamil', 'Kannada', 'Sanskrit'],
    isActive: true,
  };
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' });
  console.log('MongoDB connected');

  let created = 0;
  let updated = 0;
  const failures = [];

  for (const row of ROWS) {
    try {
      const doc = buildCeremonyDoc(row);
      const existing = await Ceremony.findOne({ name: doc.name }).select('_id').lean();
      await Ceremony.findOneAndUpdate({ name: doc.name }, doc, {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      });
      if (existing) updated += 1;
      else created += 1;
      console.log(`${existing ? 'Updated' : 'Created'}: ${doc.name}`);
    } catch (err) {
      failures.push({ name: row.name, error: err.message });
      console.error(`Failed: ${row.name} — ${err.message}`);
    }
  }

  console.log(`\nDone. Created ${created}, updated ${updated}, failed ${failures.length}.`);
  await mongoose.disconnect();
  process.exit(failures.length > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('Seed run failed:', err);
  process.exit(1);
});
