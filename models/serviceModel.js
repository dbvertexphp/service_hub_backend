// models/Service.js
const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  service_name: { type: String, required: true },
  service_image: { type: String, required: true }, // Assuming this is a URL or path to the image
  service_description: { type: String, required: true },
  service_amount: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
