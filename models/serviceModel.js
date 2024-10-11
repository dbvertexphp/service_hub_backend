const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  service_name: { type: String, required: true },
  service_images: [{ type: String, required: true }], // Array of image paths
  service_description: { type: String, required: true },
  service_amount: { type: Number, required: true },
  active: {
      type: Boolean,
      default: false,
    },
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
