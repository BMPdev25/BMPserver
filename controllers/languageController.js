const Language = require('../models/language');

// Get all languages
exports.getAllLanguages = async (req, res) => {
  try {
    const languages = await Language.find().sort({ rank: 1 });
    res.status(200).json(languages);
  } catch (error) {
    console.error('Error fetching languages:', error);
    res.status(500).json({ message: 'Server error while fetching languages' });
  }
};

// Get language by ID
exports.getLanguageById = async (req, res) => {
  try {
    const language = await Language.findById(req.params.id);
    if (!language) {
      return res.status(404).json({ message: 'Language not found' });
    }
    res.status(200).json(language);
  } catch (error) {
    console.error('Error fetching language:', error);
    res.status(500).json({ message: 'Server error while fetching language' });
  }
};
