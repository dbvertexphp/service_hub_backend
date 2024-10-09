const mongoose = require("mongoose");

const TeacherAttendanceSchema = new mongoose.Schema({
  teacher_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  course_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  course_title: {
    type: String,
    required: true,
  },
  attended_at: {
    type: String, // Change to String to store formatted date
  },
});

// Middleware to format attended_at before saving
// TeacherAttendanceSchema.pre("save", function (next) {
//   const date = new Date();
//   const day = String(date.getDate()).padStart(2, "0");
//   const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-based
//   const year = date.getFullYear();
//   this.attended_at = `${day}/${month}/${year}`;
//   next();
// });

const TeacherAttendance = mongoose.model("TeacherAttendance", TeacherAttendanceSchema);

module.exports = TeacherAttendance;
