// models/Banner.js
const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true, // Ensure that the title is mandatory
    trim: true,
  },
  image: { // Change this to a single image field
    type: String, // URL or file path to the uploaded image
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Banner = mongoose.model('Banner', bannerSchema);
module.exports = Banner;
