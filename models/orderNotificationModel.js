const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
  message: { type: String },
  title: { type: String },
  totalamount: { type: Number },
  created_at: { type: Date, default: Date.now },
});

const OrderNotification = mongoose.model("OrderNotification", notificationSchema);

module.exports = OrderNotification;
