const Ceremony = require("../models/ceremony");

// Get all ceremonies (with search & pagination)
exports.getAllCeremonies = async (req, res) => {
  try {
    const { page = 1, limit = 10, query, category } = req.query;
    
    let filter = { isActive: true };

    if (query) {
      filter.$text = { $search: query };
    }
    
    if (category) {
      filter.category = category;
    }

    const ceremoniesDocs = await Ceremony.find(filter)
      .select("name description category subcategory duration pricing images statistics tags religiousTraditions isActive isFeatured")
      .sort(query ? { score: { $meta: "textScore" } } : { "statistics.popularityScore": -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean()
      .exec();

    const ceremonies = ceremoniesDocs.map(c => {
        const primaryImage = c.images?.find(img => img.isPrimary) || c.images?.[0];
        c.image = primaryImage ? primaryImage.url : null;
        return c;
    });

    const count = await Ceremony.countDocuments(filter);

    res.status(200).json({
      ceremonies,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalCeremonies: count,
    });
  } catch (error) {
    console.error("Error fetching ceremonies:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get ceremony by ID
exports.getCeremonyById = async (req, res) => {
  try {
    const ceremony = await Ceremony.findById(req.params.id);
    if (!ceremony) {
      return res.status(404).json({ message: "Ceremony not found" });
    }
    
    const doc = ceremony.toObject();
    const primaryImage = ceremony.images.find(img => img.isPrimary) || ceremony.images[0];
    doc.image = primaryImage ? primaryImage.url : null;

    res.status(200).json(doc);
  } catch (error) {
    console.error("Error fetching ceremony by ID:", error);
    if (error.kind === "ObjectId") {
       return res.status(404).json({ message: "Ceremony not found" });
    }
    res.status(500).json({ message: "Server Error" });
  }
};

// Search ceremonies (special route if needed, otherwise handled by getAll)
exports.searchCeremonies = async (req, res) => {
  // reusing getAllCeremonies logic via query param, or specific implementation
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: "Query is required" });

    const ceremonies = await Ceremony.find({
        isActive: true,
        $text: { $search: query }
    })
    .lean();

    res.status(200).json(ceremonies);
  } catch (error) {
    console.error("Error searching ceremonies:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get all categories
exports.getCategories = async (req, res) => {
  try {
    // Return distinct categories from DB or hardcoded list if preferred
    // Using distinct from DB ensures we only show what we have
    const categories = await Ceremony.distinct("category", { isActive: true });
    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get by category
exports.getCeremoniesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const ceremonies = await Ceremony.find({ category, isActive: true });
    res.status(200).json(ceremonies);
  } catch (error) {
    console.error("Error fetching ceremonies by category:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
