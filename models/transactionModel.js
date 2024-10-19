// models/Transaction.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const Schema = mongoose.Schema;

const transactionSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    service_id: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    payment_id: {
      type: String,
    },
    payment_status: {
      type: String,
      enum: ["Completed","Cancelled"], default: "Pending"
    },
    order_id: {
      type: String,
    },
    total_amount: {
      type: Number,
      required: true,
    },
    status: { type: String, enum: ["Waiting", "Accepted", "Rejected"], default: "Waiting" },
    datetime: {
      type: String,
      default: () => moment().tz("Asia/Kolkata").format("YYYY-MMM-DD hh:mm:ss A"),
    },
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
