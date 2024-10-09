const mongoose = require("mongoose");
const moment = require("moment-timezone");

// Define the subcategory schema
const subcategorySchema = new mongoose.Schema({
  subcategory_name: { type: String, required: true },
  datetime: {
    type: String,
    default: () => moment().tz("Asia/Kolkata").format("YYYY-MMM-DD hh:mm:ss A"),
  },
  subcategory_image: { type: String },
});

// Define the main category schema
const categorySchema = new mongoose.Schema({
  category_name: { type: String, required: true },
  datetime: {
    type: String,
    default: () => moment().tz("Asia/Kolkata").format("YYYY-MMM-DD hh:mm:ss A"),
  },
  category_image: { type: String },
  subcategories: [subcategorySchema], // Embed subcategories
});

// Middleware to capitalize the first letter of category names
categorySchema.pre("save", function (next) {
  if (this.isModified("category_name")) {
    this.category_name = this.category_name.charAt(0).toUpperCase() + this.category_name.slice(1);
  }

  // Capitalize first letter of each subcategory name
  if (this.subcategories && this.subcategories.length > 0) {
    this.subcategories.forEach((subcat) => {
      subcat.subcategory_name = subcat.subcategory_name.charAt(0).toUpperCase() + subcat.subcategory_name.slice(1);
    });
  }

  next();
});

// Define and export the Category model
const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
