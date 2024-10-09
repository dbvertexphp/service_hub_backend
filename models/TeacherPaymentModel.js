const mongoose = require("mongoose");

const teacherPaymentSchema = new mongoose.Schema(
  {
    master: {
      type: Number,
    },
    advance: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

const TeacherPayment = mongoose.model("TeacherPayment", teacherPaymentSchema);

module.exports = TeacherPayment;
