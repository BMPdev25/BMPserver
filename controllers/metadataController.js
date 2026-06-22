const Banner = require('../models/banner');
const Panchang = require('../models/panchang');
const CeremonyCategory = require('../models/ceremonyCategory');
const Ceremony = require('../models/ceremony');
const PriestProfile = require('../models/priestProfile');

/**
 * Controller for application metadata (Home screen content)
 */
const metadataController = {
  /**
   * Get all active banners
   */
  getBanners: async (req, res) => {
    try {
      const banners = await Banner.find({ isActive: true }).sort({ order: 1 });
      res.status(200).json(banners);
    } catch (error) {
      console.error('getBanners error:', error);
      res.status(500).json({ message: 'Failed to fetch banners' });
    }
  },

  /**
   * Get Panchang for a specific date (defaults to today)
   */
  getPanchang: async (req, res) => {
    try {
      const { date } = req.query;
      const searchDate = date ? new Date(date) : new Date();
      searchDate.setHours(0, 0, 0, 0);

      const panchang = await Panchang.findOne({
        date: {
          $gte: searchDate,
          $lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000),
        },
      });

      if (!panchang) {
        return res.status(200).json({
          title: "Today's Panchang",
          subtitle: 'Auspicious day for ceremonies',
          nakshatra: 'Default',
          tithi: 'Day',
          date: searchDate,
        });
      }

      res.status(200).json(panchang);
    } catch (error) {
      console.error('getPanchang error:', error);
      res.status(500).json({ message: 'Failed to fetch Panchang' });
    }
  },

  /**
   * Get active ceremony categories enriched with:
   *  - representativeCeremonyId: first Ceremony doc whose category slug matches
   *  - filtered to only categories where at least one verified priest offers a ceremony
   */
  getCategories: async (req, res) => {
    try {
      const [categories, ceremonies, priestProfiles] = await Promise.all([
        CeremonyCategory.find({ isActive: true }).sort({ order: 1 }).lean(),
        Ceremony.find({}, '_id category').lean(),
        PriestProfile.find({ isVerified: true }, 'services.ceremonyId').lean(),
      ]);

      // Set of ceremony IDs offered by at least one verified priest
      const offeredCeremonyIds = new Set(
        priestProfiles.flatMap((p) =>
          (p.services || [])
            .map((s) => s.ceremonyId?.toString())
            .filter(Boolean)
        )
      );

      // Map: category slug -> first Ceremony _id (representative)
      const representativeMap = {};
      for (const c of ceremonies) {
        if (c.category && !representativeMap[c.category]) {
          representativeMap[c.category] = c._id.toString();
        }
      }

      // Set of category slugs backed by at least one verified priest's ceremony
      const activeSlugSet = new Set(
        ceremonies
          .filter((c) => offeredCeremonyIds.has(c._id.toString()))
          .map((c) => c.category)
      );

      const enriched = categories
        .filter((cat) => activeSlugSet.has(cat.slug))
        .map((cat) => ({
          ...cat,
          representativeCeremonyId: representativeMap[cat.slug] || null,
        }));

      res.status(200).json(enriched);
    } catch (error) {
      console.error('getCategories error:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  },

  /**
   * Get upcoming festivals (Manual List for 2026-2027)
   */
  getFestivals: async (req, res) => {
    try {
      const festivals = [
        // 2026
        { id: '2026-01-14-1', date: '2026-01-14', name: 'Makara Sankranti', description: 'Sun enters Capricorn' },
        { id: '2026-01-14-2', date: '2026-01-14', name: 'Shattila Ekadashi', description: 'Sacred fast day' },
        { id: '2026-01-15', date: '2026-01-15', name: 'Kanuma', description: 'Cattle festival' },
        { id: '2026-01-16', date: '2026-01-16', name: 'Mukkanuma', description: 'Third day of Sankranti' },
        { id: '2026-01-23', date: '2026-01-23', name: 'Vasant Panchami', description: 'Saraswati Puja' },
        { id: '2026-02-13-1', date: '2026-02-13', name: 'Ratha Saptami', description: 'Sun God Jayanti' },
        { id: '2026-02-13-2', date: '2026-02-13', name: 'Bhishma Ekadashi', description: 'Auspicious day' },
        { id: '2026-02-15', date: '2026-02-15', name: 'Maha Shivaratri', description: 'Great Night of Shiva' },
        { id: '2026-03-03', date: '2026-03-03', name: 'Holika Dahan', description: 'Bonfire before Holi' },
        { id: '2026-03-04', date: '2026-03-04', name: 'Holi', description: 'Festival of Colors' },
        { id: '2026-03-19', date: '2026-03-19', name: 'Ugadi', description: 'Telugu/Kannada New Year' },
        { id: '2026-03-27', date: '2026-03-27', name: 'Sri Rama Navami', description: 'Birth of Lord Rama' },
        { id: '2026-04-14', date: '2026-04-14', name: 'Mesha Sankranti', description: 'Solar New Year' },
        { id: '2026-04-19', date: '2026-04-19', name: 'Akshaya Tritiya', description: 'Eternal Success Day' },
        { id: '2026-04-30', date: '2026-04-30', name: 'Narasimha Jayanti', description: 'Incarnation of Lord Vishnu' },
        { id: '2026-05-12', date: '2026-05-12', name: 'Hanuman Jayanti (Telugu)', description: 'Birth of Lord Hanuman' },
        { id: '2026-05-17', date: '2026-05-17', name: 'Adhika Maas Begins', description: 'Extra month in lunar calendar' },
        { id: '2026-06-25', date: '2026-06-25', name: 'Nirjala Ekadashi', description: 'Waterless fast' },
        { id: '2026-07-31', date: '2026-07-31', name: 'Guru Purnima', description: 'Day of the Teacher' },
        { id: '2026-08-17', date: '2026-08-17', name: 'Nag Panchami', description: 'Snake festival' },
        { id: '2026-08-28-1', date: '2026-08-28', name: 'Varalakshmi Vratham', description: 'Goddess Lakshmi festival' },
        { id: '2026-08-28-2', date: '2026-08-28', name: 'Raksha Bandhan', description: 'Bond of protection' },
        { id: '2026-09-04', date: '2026-09-04', name: 'Krishna Janmashtami', description: 'Birth of Lord Krishna' },
        { id: '2026-09-14', date: '2026-09-14', name: 'Vinayaka Chavithi', description: 'Ganesh Chaturthi' },
        { id: '2026-09-17', date: '2026-09-17', name: 'Vishwakarma Puja', description: 'God of architecture' },
        { id: '2026-10-10', date: '2026-10-10', name: 'Mahalaya Amavasya', description: 'End of Pitru Paksha' },
        { id: '2026-10-11', date: '2026-10-11', name: 'Navratri Begins', description: 'Nine nights of Goddess' },
        { id: '2026-10-20', date: '2026-10-20', name: 'Dussehra (Vijayadashami)', description: 'Victory of Good over Evil' },
        { id: '2026-10-25', date: '2026-10-25', name: 'Sharad Purnima', description: 'Harvest festival' },
        { id: '2026-11-07', date: '2026-11-07', name: 'Naraka Chaturdashi', description: 'Choti Diwali' },
        { id: '2026-11-08', date: '2026-11-08', name: 'Diwali (Lakshmi Puja)', description: 'Festival of Lights' },
        { id: '2026-11-09', date: '2026-11-09', name: 'Bali Padyami', description: 'Govardhan Puja' },
        { id: '2026-11-24', date: '2026-11-24', name: 'Kartika Purnima', description: 'Dev Deepawali' },
        { id: '2026-12-30-1', date: '2026-12-30', name: 'Vaikuntha Ekadashi', description: 'Opening of Vaikuntha Dwar' },
        { id: '2026-12-30-2', date: '2026-12-30', name: 'Dattatreya Jayanti', description: 'Birth of Lord Dattatreya' },
        // 2027
        { id: '2027-01-14', date: '2027-01-14', name: 'Makara Sankranti', description: 'Solar New Year' },
        { id: '2027-03-06', date: '2027-03-06', name: 'Maha Shivaratri', description: 'Great Night of Shiva' },
        { id: '2027-03-23', date: '2027-03-23', name: 'Holi', description: 'Festival of Colors' },
        { id: '2027-04-08', date: '2027-04-08', name: 'Ugadi', description: 'Telugu New Year' },
        { id: '2027-04-16', date: '2027-04-16', name: 'Sri Rama Navami', description: 'Birth of Lord Rama' },
        { id: '2027-04-22', date: '2027-04-22', name: 'Hanuman Jayanti', description: 'Birth of Lord Hanuman' },
        { id: '2027-05-09', date: '2027-05-09', name: 'Akshaya Tritiya', description: 'Eternal Success Day' },
        { id: '2027-07-19', date: '2027-07-19', name: 'Guru Purnima', description: 'Day of the Teacher' },
        { id: '2027-08-20', date: '2027-08-20', name: 'Varalakshmi Vratham', description: 'Lakshmi Puja' },
        { id: '2027-08-28', date: '2027-08-28', name: 'Krishna Janmashtami', description: 'Birth of Lord Krishna' },
        { id: '2027-09-05', date: '2027-09-05', name: 'Ganesh Chaturthi', description: 'Ganesh Festival' },
        { id: '2027-10-06', date: '2027-10-06', name: 'Navratri Begins', description: 'Nine nights start' },
        { id: '2027-10-15', date: '2027-10-15', name: 'Dussehra', description: 'Vijayadashami' },
        { id: '2027-11-04', date: '2027-11-04', name: 'Diwali', description: 'Festival of Lights' },
        { id: '2027-12-20', date: '2027-12-20', name: 'Vaikuntha Ekadashi', description: 'Sacred fast day' },
      ];
      res.status(200).json(festivals);
    } catch (error) {
      console.error('getFestivals error:', error);
      res.status(500).json({ message: 'Failed to fetch festivals' });
    }
  },
};

module.exports = metadataController;
