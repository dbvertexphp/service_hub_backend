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
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    payment_id: {
      type: String,
    },
    payment_status: {
      type: String,
    },
    status: { type: String, enum: ["order", "confirmed", "shipped", "ontheway", "delivered", "cancelled"], default: "order" },
    total_amount: {
      type: Number,
      required: true,
    },
    payment_method: { type: String, enum: ["online", "cod"], required: true },
    items: [
      {
        product_id: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        supplier_id: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
      },
    ],
    datetime: {
      type: String,
      default: () => moment().tz("Asia/Kolkata").format("YYYY-MMM-DD hh:mm:ss A"),
    },
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
