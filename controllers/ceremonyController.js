// controllers/ceremonyController.js
const Ceremony = require("../models/ceremony");

// -------------------------------------------
// GET ALL PUJAS
// -------------------------------------------
exports.getAllCeremonies = async (req, res) => {
  try {
    const ceremonies = await Ceremony.find({ isActive: true });
    res.status(200).json(ceremonies);
  } catch (error) {
    console.error("Error fetching ceremonies:", error);
    res.status(500).json({ message: "Failed to fetch ceremonies" });
  }
};

// -------------------------------------------
// GET PUJA BY ID
// -------------------------------------------
exports.getCeremonyById = async (req, res) => {
  try {
    const ceremony = await Ceremony.findById(req.params.id);

    if (!ceremony) {
      return res.status(404).json({ message: "Ceremony not found" });
    }

    res.status(200).json(ceremony);
  } catch (error) {
    console.error("Error fetching ceremony by ID:", error);
    res.status(500).json({ message: "Failed to fetch ceremony" });
  }
};

// -------------------------------------------
// SEARCH PUJAS
// -------------------------------------------
exports.searchCeremonies = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const results = await Ceremony.find({
      $text: { $search: query },
      isActive: true,
    });

    res.status(200).json(results);
  } catch (error) {
    console.error("Error searching ceremonies:", error);
    res.status(500).json({ message: "Failed to search ceremonies" });
  }
};

// -------------------------------------------
// GET UNIQUE CATEGORIES
// -------------------------------------------
exports.getCategories = async (req, res) => {
  try {
    const categories = await Ceremony.distinct("category", {
      isActive: true,
    });

    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
};

// -------------------------------------------
// GET PUJAS BY CATEGORY
// -------------------------------------------
exports.getCeremoniesByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const ceremonies = await Ceremony.find({
      category,
      isActive: true,
    });

    res.status(200).json(ceremonies);
  } catch (error) {
    console.error("Error fetching ceremonies by category:", error);
    res.status(500).json({ message: "Failed to fetch ceremonies" });
  }
};
