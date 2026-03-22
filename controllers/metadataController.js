const Banner = require('../models/banner');
const Panchang = require('../models/panchang');
const CeremonyCategory = require('../models/ceremonyCategory');

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
          $lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000)
        }
      });

      if (!panchang) {
        // Return a mock default if not found in DB yet
        return res.status(200).json({
          title: "Today's Panchang",
          subtitle: "Auspicious day for ceremonies",
          nakshatra: "Default",
          tithi: "Day",
          date: searchDate
        });
      }

      res.status(200).json(panchang);
    } catch (error) {
      console.error('getPanchang error:', error);
      res.status(500).json({ message: 'Failed to fetch Panchang' });
    }
  },

  /**
   * Get all active ceremony categories
   */
  getCategories: async (req, res) => {
    try {
      const categories = await CeremonyCategory.find({ isActive: true }).sort({ order: 1 });
      res.status(200).json(categories);
    } catch (error) {
      console.error('getCategories error:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  }
};

module.exports = metadataController;
