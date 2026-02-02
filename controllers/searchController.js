// controllers/searchController.js
const User = require('../models/user');
const PriestProfile = require('../models/priestProfile');
const Ceremony = require('../models/ceremony');

// Universal search function
const universalSearch = async (req, res) => {
  try {
    const { 
      query, 
      type = 'all', // 'priests', 'ceremonies', 'all'
      location,
      priceRange,
      category,
      religiousTradition,
      page = 1,
      limit = 20,
      sortBy = 'relevance' // 'relevance', 'price', 'rating', 'popularity'
    } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchResults = {
      priests: [],
      ceremonies: [],
      totalResults: 0,
      pagination: {
        current: parseInt(page),
        total: 0,
        hasMore: false
      }
    };

    const skip = (page - 1) * limit;

    // Search priests if type is 'priests' or 'all'
    if (type === 'priests' || type === 'all') {
      const priestSearchQuery = {
        $and: [
          { userType: 'priest' },
          { isActive: true },
          {
            $or: [
              { name: { $regex: query, $options: 'i' } },
              { email: { $regex: query, $options: 'i' } },
              { 'profilePicture.alt': { $regex: query, $options: 'i' } }
            ]
          }
        ]
      };

      // Add location filter if provided
      if (location) {
        priestSearchQuery['$and'].push({
          $or: [
            { 'address.city': { $regex: location, $options: 'i' } },
            { 'address.state': { $regex: location, $options: 'i' } }
          ]
        });
      }

      const priests = await User.find(priestSearchQuery)
        .select('name email phone profilePicture createdAt')
        .populate({
          path: 'priestProfile',
          model: 'PriestProfile',
          select: 'experience religiousTradition description ratings priceList currentAvailability serviceAreas',
          match: religiousTradition ? { religiousTradition: { $regex: religiousTradition, $options: 'i' } } : {}
        })
        .skip(type === 'all' ? 0 : skip)
        .limit(type === 'all' ? 10 : parseInt(limit))
        .lean();

      // Filter priests by price range if provided
      let filteredPriests = priests.filter(priest => priest.priestProfile);

      if (priceRange) {
        const [minPrice, maxPrice] = priceRange.split('-').map(Number);
        filteredPriests = filteredPriests.filter(priest => {
          const prices = Array.from(priest.priestProfile.priceList.values());
          const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
          return avgPrice >= minPrice && avgPrice <= maxPrice;
        });
      }

      // Sort priests based on sortBy parameter
      switch (sortBy) {
        case 'rating':
          filteredPriests.sort((a, b) => b.priestProfile.ratings.average - a.priestProfile.ratings.average);
          break;
        case 'price':
          filteredPriests.sort((a, b) => {
            const aPrice = Math.min(...Array.from(a.priestProfile.priceList.values()));
            const bPrice = Math.min(...Array.from(b.priestProfile.priceList.values()));
            return aPrice - bPrice;
          });
          break;
        case 'experience':
          filteredPriests.sort((a, b) => b.priestProfile.experience - a.priestProfile.experience);
          break;
        default: // relevance
          // Keep original order (MongoDB text search relevance)
          break;
      }

      searchResults.priests = filteredPriests.map(priest => ({
        id: priest._id,
        name: priest.name,
        profilePicture: priest.profilePicture,
        experience: priest.priestProfile.experience,
        religiousTradition: priest.priestProfile.religiousTradition,
        rating: priest.priestProfile.ratings,
        rating: priest.priestProfile.ratings,
        // ceremonies: priest.priestProfile.ceremonies, // removed
        description: priest.priestProfile.description,
        priceRange: {
          min: Math.min(...Array.from(priest.priestProfile.priceList.values())),
          max: Math.max(...Array.from(priest.priestProfile.priceList.values()))
        },
        availability: priest.priestProfile.currentAvailability,
        serviceAreas: priest.priestProfile.serviceAreas,
        type: 'priest'
      }));
    }

    // Search ceremonies if type is 'ceremonies' or 'all'
    if (type === 'ceremonies' || type === 'all') {
      const ceremonySearchQuery = {
        $and: [
          { isActive: true },
          {
            $text: { $search: query }
          }
        ]
      };

      // Add category filter if provided
      if (category) {
        ceremonySearchQuery['$and'].push({ category: category });
      }

      // Add religious tradition filter if provided
      if (religiousTradition) {
        ceremonySearchQuery['$and'].push({ 
          religiousTraditions: { $in: [new RegExp(religiousTradition, 'i')] }
        });
      }

      // Add price range filter if provided
      if (priceRange) {
        const [minPrice, maxPrice] = priceRange.split('-').map(Number);
        ceremonySearchQuery['$and'].push({
          'pricing.priceRange.min': { $gte: minPrice },
          'pricing.priceRange.max': { $lte: maxPrice }
        });
      }

      let ceremonySort = {};
      switch (sortBy) {
        case 'price':
          ceremonySort = { 'pricing.basePrice': 1 };
          break;
        case 'rating':
          ceremonySort = { 'statistics.averageRating': -1 };
          break;
        case 'popularity':
          ceremonySort = { 'statistics.popularityScore': -1 };
          break;
        default: // relevance
          ceremonySort = { score: { $meta: 'textScore' } };
          break;
      }

      const ceremonies = await Ceremony.find(ceremonySearchQuery, 
        sortBy === 'relevance' ? { score: { $meta: 'textScore' } } : {}
      )
        .sort(ceremonySort)
        .skip(type === 'all' ? 0 : skip)
        .limit(type === 'all' ? 10 : parseInt(limit))
        .lean();

      searchResults.ceremonies = ceremonies.map(ceremony => ({
        id: ceremony._id,
        name: ceremony.name,
        description: ceremony.description,
        category: ceremony.category,
        subcategory: ceremony.subcategory,
        duration: ceremony.duration,
        pricing: ceremony.pricing,
        primaryImage: ceremony.images.find(img => img.isPrimary) || ceremony.images[0],
        rating: {
          average: ceremony.statistics.averageRating,
          count: ceremony.statistics.reviewCount
        },
        popularityScore: ceremony.statistics.popularityScore,
        bookingCount: ceremony.statistics.bookingCount,
        religiousTraditions: ceremony.religiousTraditions,
        tags: ceremony.tags,
        type: 'ceremony'
      }));
    }

    // Calculate total results
    searchResults.totalResults = searchResults.priests.length + searchResults.ceremonies.length;
    
    // Update pagination
    const totalPages = Math.ceil(searchResults.totalResults / limit);
    searchResults.pagination.total = totalPages;
    searchResults.pagination.hasMore = page < totalPages;

    // Combine and sort results if searching all
    if (type === 'all') {
      const combinedResults = [
        ...searchResults.priests.slice(0, 5),
        ...searchResults.ceremonies.slice(0, 5)
      ];
      
      searchResults.combined = combinedResults;
    }

    res.json({
      success: true,
      query: query,
      filters: {
        type,
        location,
        priceRange,
        category,
        religiousTradition,
        sortBy
      },
      data: searchResults
    });

  } catch (error) {
    console.error('Universal search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
};

// Get popular ceremonies
const getPopularCeremonies = async (req, res) => {
  try {
    const { limit = 20, category, religiousTradition } = req.query;

    const query = { isActive: true };
    
    if (category) {
      query.category = category;
    }

    if (religiousTradition) {
      query.religiousTraditions = { $in: [new RegExp(religiousTradition, 'i')] };
    }

    const ceremonies = await Ceremony.find(query)
      .sort({ 'statistics.popularityScore': -1, 'statistics.bookingCount': -1 })
      .limit(parseInt(limit))
      .lean();

    const formattedCeremonies = ceremonies.map(ceremony => ({
      id: ceremony._id,
      name: ceremony.name,
      description: ceremony.description,
      category: ceremony.category,
      subcategory: ceremony.subcategory,
      priceDisplay: ceremony.pricing.priceRange.min === ceremony.pricing.priceRange.max 
        ? `₹${ceremony.pricing.priceRange.min}`
        : `₹${ceremony.pricing.priceRange.min} - ₹${ceremony.pricing.priceRange.max}`,
      durationDisplay: (() => {
        const hours = Math.floor(ceremony.duration.typical / 60);
        const minutes = ceremony.duration.typical % 60;
        if (hours === 0) return `${minutes} minutes`;
        if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        return `${hours}h ${minutes}m`;
      })(),
      primaryImage: ceremony.images.find(img => img.isPrimary) || ceremony.images[0],
      rating: {
        average: ceremony.statistics.averageRating,
        count: ceremony.statistics.reviewCount
      },
      bookingCount: ceremony.statistics.bookingCount,
      popularityScore: ceremony.statistics.popularityScore,
      tags: ceremony.tags.slice(0, 5), // Limit tags for display
    }));

    res.json({
      success: true,
      data: formattedCeremonies,
      total: formattedCeremonies.length
    });

  } catch (error) {
    console.error('Get popular ceremonies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular ceremonies',
      error: error.message
    });
  }
};

// Get ceremony details
const getCeremonyDetails = async (req, res) => {
  try {
    const { ceremonyId } = req.params;

    const ceremony = await Ceremony.findById(ceremonyId).lean();

    if (!ceremony) {
      return res.status(404).json({
        success: false,
        message: 'Ceremony not found'
      });
    }

    if (!ceremony.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Ceremony is not available'
      });
    }

    // Format ceremony data for response
    const formattedCeremony = {
      ...ceremony,
      priceDisplay: ceremony.pricing.priceRange.min === ceremony.pricing.priceRange.max 
        ? `₹${ceremony.pricing.priceRange.min}`
        : `₹${ceremony.pricing.priceRange.min} - ₹${ceremony.pricing.priceRange.max}`,
      durationDisplay: (() => {
        const hours = Math.floor(ceremony.duration.typical / 60);
        const minutes = ceremony.duration.typical % 60;
        if (hours === 0) return `${minutes} minutes`;
        if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        return `${hours}h ${minutes}m`;
      })(),
      primaryImage: ceremony.images.find(img => img.isPrimary) || ceremony.images[0],
    };

    res.json({
      success: true,
      data: formattedCeremony
    });

  } catch (error) {
    console.error('Get ceremony details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ceremony details',
      error: error.message
    });
  }
};

// Get ceremony categories
const getCeremonyCategories = async (req, res) => {
  try {
    const categories = await Ceremony.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          subcategories: { $addToSet: '$subcategory' },
          avgPrice: { $avg: '$pricing.basePrice' },
          minPrice: { $min: '$pricing.priceRange.min' },
          maxPrice: { $max: '$pricing.priceRange.max' },
          popularCeremonies: { $push: { name: '$name', id: '$_id', bookingCount: '$statistics.bookingCount' } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Format the results
    const formattedCategories = categories.map(category => ({
      name: category._id,
      count: category.count,
      subcategories: category.subcategories,
      priceRange: {
        min: category.minPrice,
        max: category.maxPrice,
        average: Math.round(category.avgPrice)
      },
      popularCeremonies: category.popularCeremonies
        .sort((a, b) => b.bookingCount - a.bookingCount)
        .slice(0, 3)
        .map(c => ({ name: c.name, id: c.id }))
    }));

    res.json({
      success: true,
      data: formattedCategories,
      total: formattedCategories.length
    });

  } catch (error) {
    console.error('Get ceremony categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ceremony categories',
      error: error.message
    });
  }
};

// Search suggestions (autocomplete)
const getSearchSuggestions = async (req, res) => {
  try {
    const { query, type = 'all' } = req.query;

    if (!query || query.trim().length < 1) {
      return res.json({
        success: true,
        data: { priests: [], ceremonies: [], combined: [] }
      });
    }

    const suggestions = {
      priests: [],
      ceremonies: [],
      combined: []
    };

    // Get priest name suggestions
    if (type === 'priests' || type === 'all') {
      const priestSuggestions = await User.find({
        userType: 'priest',
        isActive: true,
        name: { $regex: query, $options: 'i' }
      })
      .select('name profilePicture')
      .limit(5)
      .lean();

      suggestions.priests = priestSuggestions.map(priest => ({
        id: priest._id,
        name: priest.name,
        profilePicture: priest.profilePicture,
        type: 'priest'
      }));
    }

    // Get ceremony name suggestions
    if (type === 'ceremonies' || type === 'all') {
      const ceremonySuggestions = await Ceremony.find({
        isActive: true,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { tags: { $regex: query, $options: 'i' } },
          { keywords: { $regex: query, $options: 'i' } }
        ]
      })
      .select('name category primaryImage')
      .limit(5)
      .lean();

      suggestions.ceremonies = ceremonySuggestions.map(ceremony => ({
        id: ceremony._id,
        name: ceremony.name,
        category: ceremony.category,
        type: 'ceremony'
      }));
    }

    // Combine suggestions for 'all' type
    if (type === 'all') {
      suggestions.combined = [
        ...suggestions.priests.slice(0, 3),
        ...suggestions.ceremonies.slice(0, 3)
      ];
    }

    res.json({
      success: true,
      query,
      data: suggestions
    });

  } catch (error) {
    console.error('Get search suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch search suggestions',
      error: error.message
    });
  }
};

module.exports = {
  universalSearch,
  getPopularCeremonies,
  getCeremonyDetails,
  getCeremonyCategories,
  getSearchSuggestions,
};
