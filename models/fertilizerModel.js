const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const fertilizerSchema = new Schema(
  {
    product_name: {
      type: String,
      required: true,
    },
    product_weight: {
      type: String,
    },
    product_price: {
      type: String,
    },
    product_image: String,
    supplier_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product_quantity: {
      type: Number,
    },
    pin_code: [Number],
    averageRating: {
      type: Number,
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Fertilizer = mongoose.model("Fertilizer", fertilizerSchema);
module.exports = Fertilizer;
