const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const productTypeSchema = new Schema(
  {
    type_name: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const ProductType = mongoose.model("ProductType", productTypeSchema);
module.exports = ProductType;
