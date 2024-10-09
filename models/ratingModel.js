// models/Rating.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ratingSchema = new Schema(
  {
    product_id: {
      type: Schema.Types.ObjectId,
      ref: "Product", // Assuming "User" model is used for teachers
      required: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User", // Assuming "User" model is used for students/users
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    message: {
      type: String,
    },
  },
  { timestamps: true }
);

const Rating = mongoose.model("Rating", ratingSchema);
module.exports = Rating;
