const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require("bcryptjs");
const moment = require("moment-timezone");
const { getSignedUrlS3 } = require("../config/aws-s3.js");

const teacherSchema = mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  full_name: { type: String },
  email: {
    type: String,
    required: true,
  },
  mobile: { type: Number, unique: true },
  password: { type: String, required: true },
  cpassword: { type: String },
  role: { type: String, required: true },
  otp: { type: String },
  otp_verified: { type: Number, default: 0 },
  pic: {
    type: String,
    required: true,
    default: "defult_profile/defult_pic.jpg",
  },
  ConnectyCube_token: { type: String, default: null },
  ConnectyCube_id: { type: String, default: null },
  experience: { type: String },
  education: { type: String },
  languages: [{ type: String, max: 4 }], // Maximum 4 languages
  expertise: { type: String },
  about_me: { type: String },

  datetime: {
    type: String,
    default: () => moment().tz("Asia/Kolkata").format("YYYY-MMM-DD hh:mm:ss A"),
  },
});

teacherSchema.post(["find", "findOne"], async function (result) {
  if (result && result.pic && typeof result.pic === "string") {
    result.pic = await getSignedUrlS3(result.pic);
  }
});

teacherSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

teacherSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

teacherSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
  },
});

teacherSchema.statics.findById = function (userId) {
  return this.findOne({ _id: userId });
};

teacherSchema.pre("save", function (next) {
  if (this.isModified("first_name")) {
    this.first_name = this.first_name.charAt(0).toUpperCase() + this.first_name.slice(1);
  }
  if (this.isModified("about_me")) {
    this.about_me = this.about_me.charAt(0).toUpperCase() + this.about_me.slice(1);
  }
  next();
});

const Teacher = mongoose.model("Teacher", teacherSchema);

module.exports = Teacher;
