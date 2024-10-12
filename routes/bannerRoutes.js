// routes/bannerRoutes.js
const express = require('express');
const bannerRoutes = express.Router();
const {
  addBanner,
  getAllBanners,
  updateBanner,
  deleteBanner,
} = require('../controllers/bannerController');
const protect = require("../middleware/authMiddleware.js");
const Authorization = require("../middleware/Authorization.middleware.js");


// Route to add a banner with multiple images

bannerRoutes.route("/addBanner").post(protect, Authorization(["admin"]), addBanner);


bannerRoutes.route("/getAllBanners").get(protect, Authorization(["admin","user"]), getAllBanners);


bannerRoutes.route("/updateBanner/:id").put(protect, Authorization(["admin"]), updateBanner);


bannerRoutes.route("/deleteBanner/:id").delete(protect, Authorization(["admin"]), deleteBanner);

module.exports = bannerRoutes;
