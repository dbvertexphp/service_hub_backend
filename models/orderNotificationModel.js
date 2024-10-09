const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  message: { type: String },
  title: { type: String },
  type: { type: String },
  totalamount: { type: Number },
  supplier_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  userstatus: { type: String, enum: ["unread", "read"], default: "unread" },
  supplierstatus: { type: String, enum: ["unread", "read"], default: "unread" },
  created_at: { type: Date, default: Date.now },
});

const OrderNotification = mongoose.model("OrderNotification", notificationSchema);

module.exports = OrderNotification;
