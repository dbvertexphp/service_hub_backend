const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [
    {
      product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
      quantity: { type: Number, required: true },
      supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      verification_code: { type: String, required: true },
      status: { type: String, enum: ["order", "confirmed", "shipped", "ontheway", "delivered", "cancelled"], default: "order" }, // Status for each item
    },
  ],
  shipping_address: {
    name: { type: String, required: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    mobile_number: { type: String, required: true },
    remark: { type: String },
  },
  payment_method: { type: String, enum: ["online", "cod"], required: true },
  total_amount: { type: Number, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
