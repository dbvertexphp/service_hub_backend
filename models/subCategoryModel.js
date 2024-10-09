const mongoose = require("mongoose");
const moment = require("moment-timezone");

// Define the subcategory schema
const subcategorySchema = mongoose.Schema({
  subcategory_name: { type: String, required: true },
  datetime: {
    type: String,
    default: () => moment().tz("Asia/Kolkata").format("YYYY-MMM-DD hh:mm:ss A"),
  },
  subcategory_image: { type: String },
});

// Middleware to capitalize the first letter of subcategory names
subcategorySchema.pre("save", function (next) {
  if (this.isModified("subcategory_name")) {
    this.subcategory_name = this.subcategory_name.charAt(0).toUpperCase() + this.subcategory_name.slice(1);
  }
  next();
});

// Define and export the Subcategory model
const Subcategory = mongoose.model("Subcategory", subcategorySchema, "subcategory");

module.exports = Subcategory;
