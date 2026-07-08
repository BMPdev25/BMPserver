// controllers/searchController.js
const User = require('../models/user');
const Ceremony = require('../models/ceremony');
const { escapeRegex } = require('../utils/escapeRegex');

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
      sortBy = 'relevance', // 'relevance', 'price', 'rating', 'popularity'
    } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long',
      });
    }

    const searchResults = {
      priests: [],
      ceremonies: [],
      totalResults: 0,
      pagination: {
        current: parseInt(page),
        total: 0,
        hasMore: false,
      },
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
              { name: { $regex: escapeRegex(query), $options: 'i' } },
              { email: { $regex: escapeRegex(query), $options: 'i' } },
              { 'profilePicture.alt': { $regex: escapeRegex(query), $options: 'i' } },
            ],
          },
        ],
      };

      // Add location filter if provided
      if (location) {
        priestSearchQuery['$and'].push({
          $or: [
            { 'address.city': { $regex: escapeRegex(location), $options: 'i' } },
            { 'address.state': { $regex: escapeRegex(location), $options: 'i' } },
          ],
        });
      }

      const priests = await User.find(priestSearchQuery)
        .select('name email phone profilePicture createdAt')
        .populate({
          path: 'priestProfile',
          model: 'PriestProfile',
          select:
            'experience religiousTradition description ratings services currentAvailability serviceAreas',
          match: religiousTradition
            ? { religiousTradition: { $regex: escapeRegex(religiousTradition), $options: 'i' } }
            : {},
        })
        .skip(type === 'all' ? 0 : skip)
        .limit(type === 'all' ? 10 : parseInt(limit))
        .lean();

      // Filter priests by price range if provided
      let filteredPriests = priests.filter((priest) => priest.priestProfile);

      // Prices come from the active services[].price field (the legacy priceList
      // Map is empty, which made every price read ₹0). The schema has no per-service
      // "active" flag, so an active service is simply one with a numeric price.
      const servicePrices = (profile) =>
        (profile.services || [])
          .map((s) => s?.price)
          .filter((p) => typeof p === 'number');
      // "From" price for a priest = cheapest service they offer.
      const startingPriceOf = (profile) => {
        const prices = servicePrices(profile);
        return prices.length ? Math.min(...prices) : null;
      };

      if (priceRange) {
        const [minPrice, maxPrice] = priceRange.split('-').map(Number);
        filteredPriests = filteredPriests.filter((priest) => {
          const startingPrice = startingPriceOf(priest.priestProfile);
          if (startingPrice === null) return false;
          return startingPrice >= minPrice && startingPrice <= maxPrice;
        });
      }

      // Sort priests based on sortBy parameter
      switch (sortBy) {
        case 'rating':
          filteredPriests.sort(
            (a, b) => b.priestProfile.ratings.average - a.priestProfile.ratings.average
          );
          break;
        case 'price':
          filteredPriests.sort((a, b) => {
            const aPrice = startingPriceOf(a.priestProfile) ?? Infinity;
            const bPrice = startingPriceOf(b.priestProfile) ?? Infinity;
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

      searchResults.priests = filteredPriests.map((priest) => {
        const prices = servicePrices(priest.priestProfile);
        return {
          id: priest._id,
          name: priest.name,
          profilePicture: priest.profilePicture,
          experience: priest.priestProfile.experience,
          religiousTradition: priest.priestProfile.religiousTradition,
          rating: priest.priestProfile.ratings,
          // ceremonies: priest.priestProfile.ceremonies, // removed
          description: priest.priestProfile.description,
          startingPrice: prices.length ? Math.min(...prices) : 0,
          priceRange: {
            min: prices.length ? Math.min(...prices) : 0,
            max: prices.length ? Math.max(...prices) : 0,
          },
          availability: priest.priestProfile.currentAvailability,
          serviceAreas: priest.priestProfile.serviceAreas,
          type: 'priest',
        };
      });
    }

    // Search ceremonies if type is 'ceremonies' or 'all'
    if (type === 'ceremonies' || type === 'all') {
      const ceremonySearchQuery = {
        $and: [
          { isActive: true },
          {
            $text: { $search: query },
          },
        ],
      };

      // Add category filter if provided
      if (category) {
        ceremonySearchQuery['$and'].push({ category: category });
      }

      // Add religious tradition filter if provided
      if (religiousTradition) {
        ceremonySearchQuery['$and'].push({
          religiousTraditions: { $in: [new RegExp(escapeRegex(religiousTradition), 'i')] },
        });
      }

      // Add price range filter if provided
      if (priceRange) {
        const [minPrice, maxPrice] = priceRange.split('-').map(Number);
        ceremonySearchQuery['$and'].push({
          'pricing.priceRange.min': { $gte: minPrice },
          'pricing.priceRange.max': { $lte: maxPrice },
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

      const ceremonies = await Ceremony.find(
        ceremonySearchQuery,
        sortBy === 'relevance' ? { score: { $meta: 'textScore' } } : {}
      )
        .sort(ceremonySort)
        .skip(type === 'all' ? 0 : skip)
        .limit(type === 'all' ? 10 : parseInt(limit))
        .lean();

      searchResults.ceremonies = ceremonies.map((ceremony) => ({
        id: ceremony._id,
        name: ceremony.name,
        description: ceremony.description,
        category: ceremony.category,
        subcategory: ceremony.subcategory,
        duration: ceremony.duration,
        pricing: ceremony.pricing,
        primaryImage: ceremony.images.find((img) => img.isPrimary) || ceremony.images[0],
        rating: {
          average: ceremony.statistics.averageRating,
          count: ceremony.statistics.reviewCount,
        },
        popularityScore: ceremony.statistics.popularityScore,
        bookingCount: ceremony.statistics.bookingCount,
        religiousTraditions: ceremony.religiousTraditions,
        tags: ceremony.tags,
        type: 'ceremony',
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
        ...searchResults.ceremonies.slice(0, 5),
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
        sortBy,
      },
      data: searchResults,
    });
  } catch (error) {
    console.error('Universal search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message,
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
      query.religiousTraditions = { $in: [new RegExp(escapeRegex(religiousTradition), 'i')] };
    }

    const ceremonies = await Ceremony.find(query)
      .sort({ 'statistics.popularityScore': -1, 'statistics.bookingCount': -1 })
      .limit(parseInt(limit))
      .lean();

    const formattedCeremonies = ceremonies.map((ceremony) => ({
      id: ceremony._id,
      name: ceremony.name,
      description: ceremony.description,
      category: ceremony.category,
      subcategory: ceremony.subcategory,
      priceDisplay:
        ceremony.pricing.priceRange.min === ceremony.pricing.priceRange.max
          ? `â‚¹${ceremony.pricing.priceRange.min}`
          : `â‚¹${ceremony.pricing.priceRange.min} - â‚¹${ceremony.pricing.priceRange.max}`,
      durationDisplay: (() => {
        const hours = Math.floor(ceremony.duration.typical / 60);
        const minutes = ceremony.duration.typical % 60;
        if (hours === 0) return `${minutes} minutes`;
        if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        return `${hours}h ${minutes}m`;
      })(),
      primaryImage: ceremony.images.find((img) => img.isPrimary) || ceremony.images[0],
      rating: {
        average: ceremony.statistics.averageRating,
        count: ceremony.statistics.reviewCount,
      },
      bookingCount: ceremony.statistics.bookingCount,
      popularityScore: ceremony.statistics.popularityScore,
      tags: ceremony.tags.slice(0, 5), // Limit tags for display
    }));

    res.json({
      success: true,
      data: formattedCeremonies,
      total: formattedCeremonies.length,
    });
  } catch (error) {
    console.error('Get popular ceremonies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular ceremonies',
      error: error.message,
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
        message: 'Ceremony not found',
      });
    }

    if (!ceremony.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Ceremony is not available',
      });
    }

    // Format ceremony data for response
    const formattedCeremony = {
      ...ceremony,
      priceDisplay:
        ceremony.pricing.priceRange.min === ceremony.pricing.priceRange.max
          ? `â‚¹${ceremony.pricing.priceRange.min}`
          : `â‚¹${ceremony.pricing.priceRange.min} - â‚¹${ceremony.pricing.priceRange.max}`,
      durationDisplay: (() => {
        const hours = Math.floor(ceremony.duration.typical / 60);
        const minutes = ceremony.duration.typical % 60;
        if (hours === 0) return `${minutes} minutes`;
        if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        return `${hours}h ${minutes}m`;
      })(),
      primaryImage: ceremony.images.find((img) => img.isPrimary) || ceremony.images[0],
    };

    res.json({
      success: true,
      data: formattedCeremony,
    });
  } catch (error) {
    console.error('Get ceremony details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ceremony details',
      error: error.message,
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
          popularCeremonies: {
            $push: { name: '$name', id: '$_id', bookingCount: '$statistics.bookingCount' },
          },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Format the results
    const formattedCategories = categories.map((category) => ({
      name: category._id,
      count: category.count,
      subcategories: category.subcategories,
      priceRange: {
        min: category.minPrice,
        max: category.maxPrice,
        average: Math.round(category.avgPrice),
      },
      popularCeremonies: category.popularCeremonies
        .sort((a, b) => b.bookingCount - a.bookingCount)
        .slice(0, 3)
        .map((c) => ({ name: c.name, id: c.id })),
    }));

    res.json({
      success: true,
      data: formattedCategories,
      total: formattedCategories.length,
    });
  } catch (error) {
    console.error('Get ceremony categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ceremony categories',
      error: error.message,
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
        data: { priests: [], ceremonies: [], combined: [] },
      });
    }

    const suggestions = {
      priests: [],
      ceremonies: [],
      combined: [],
    };

    // Get priest name suggestions
    if (type === 'priests' || type === 'all') {
      const priestSuggestions = await User.find({
        userType: 'priest',
        isActive: true,
        name: { $regex: escapeRegex(query), $options: 'i' },
      })
        .select('name profilePicture')
        .limit(5)
        .lean();

      suggestions.priests = priestSuggestions.map((priest) => ({
        id: priest._id,
        name: priest.name,
        profilePicture: priest.profilePicture,
        type: 'priest',
      }));
    }

    // Get ceremony name suggestions
    if (type === 'ceremonies' || type === 'all') {
      const ceremonySuggestions = await Ceremony.find({
        isActive: true,
        $or: [
          { name: { $regex: escapeRegex(query), $options: 'i' } },
          { tags: { $regex: escapeRegex(query), $options: 'i' } },
          { keywords: { $regex: escapeRegex(query), $options: 'i' } },
        ],
      })
        .select('name category primaryImage')
        .limit(5)
        .lean();

      suggestions.ceremonies = ceremonySuggestions.map((ceremony) => ({
        id: ceremony._id,
        name: ceremony.name,
        category: ceremony.category,
        type: 'ceremony',
      }));
    }

    // Combine suggestions for 'all' type
    if (type === 'all') {
      suggestions.combined = [
        ...suggestions.priests.slice(0, 3),
        ...suggestions.ceremonies.slice(0, 3),
      ];
    }

    res.json({
      success: true,
      query,
      data: suggestions,
    });
  } catch (error) {
    console.error('Get search suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch search suggestions',
      error: error.message,
    });
  }
};


// ---------------------------------------------------------------------------
// Unified search  GET /api/search?q=<query>&limit=<n>
// Returns up to <limit> matching ceremonies + priests (name or service match).
// ---------------------------------------------------------------------------
const PriestProfile = require('../models/priestProfile');

const unifiedSearch = async (req, res) => {
  try {
    const { q = '', limit = '5' } = req.query;
    const trimmed = q.trim();

    if (trimmed.length < 2) {
      return res.json({ success: true, data: { ceremonies: [], priests: [] } });
    }

    const maxResults = Math.min(parseInt(limit, 10) || 5, 10);
    const regex = new RegExp(escapeRegex(trimmed), 'i');

    // Parallel: find ceremony IDs matching name, and user IDs matching priest name
    const [matchingCeremonyDocs, matchingUserDocs] = await Promise.all([
      Ceremony.find({ name: regex }).select('_id').lean(),
      User.find({ name: regex, userType: 'priest', isActive: true }).select('_id').lean(),
    ]);

    const matchingCeremonyIds = matchingCeremonyDocs.map((c) => c._id);
    const matchingUserIds = matchingUserDocs.map((u) => u._id);

    // Parallel: fetch ceremony details + priests who match name or offer a matching ceremony
    const [ceremonies, priests] = await Promise.all([
      Ceremony.find({ name: regex, isActive: true })
        .select('_id name category description pricing')
        .limit(maxResults)
        .lean(),
      PriestProfile.find({
        isVerified: true,
        $or: [
          { userId: { $in: matchingUserIds } },
          { 'services.ceremonyId': { $in: matchingCeremonyIds } },
        ],
      })
        .populate('userId', 'name profilePicture')
        .select('_id userId ratings services')
        .limit(maxResults)
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        ceremonies: ceremonies.map((c) => ({
          _id: c._id,
          name: c.name,
          category: c.category,
          shortDescription: c.description
            ? c.description.slice(0, 80) + (c.description.length > 80 ? '…' : '')
            : null,
          pricing: c.pricing,
        })),
        priests: priests.map((p) => ({
          _id: p._id,
          userId: p.userId,
          ratings: p.ratings,
          services: p.services,
        })),
      },
    });
  } catch (error) {
    console.error('Unified search error:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
};
module.exports = {
  unifiedSearch,
  universalSearch,
  getPopularCeremonies,
  getCeremonyDetails,
  getCeremonyCategories,
  getSearchSuggestions,
};

