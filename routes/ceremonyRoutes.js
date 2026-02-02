const express = require("express");
const router = express.Router();
const ceremonyController = require("../controllers/ceremonyController");

// Routes
router.get("/", ceremonyController.getAllCeremonies);
router.get("/search", ceremonyController.searchCeremonies);
router.get("/categories", ceremonyController.getCategories);
router.get("/category/:category", ceremonyController.getCeremoniesByCategory);
router.get("/:id", ceremonyController.getCeremonyById);

module.exports = router;
