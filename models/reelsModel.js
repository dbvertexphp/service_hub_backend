const mongoose = require("mongoose");
const moment = require("moment-timezone");
const autoIncrement = require("mongoose-auto-increment");
autoIncrement.initialize(mongoose.connection);

const reelSchema = mongoose.Schema({
      share_Id: { type: Number, required: true, unique: true },
      reel_name: { type: String, trim: true, required: true },
      title: { type: String },
      thumbnail_name: {
            type: String,
            trim: true,
            default: "Reels_defult/reel_defult_thumbunil.jpg",
      },
      user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      category_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
      },
      comment_count: { type: Number, default: 0 },
      view_count: { type: Number, default: 0 },
      description: { type: String, maxlength: 2000 },
      status: { type: Number, default: 0 },
      view_user: [
            {
                  type: mongoose.Schema.Types.ObjectId,
                  ref: "User", // Assuming you have a User model, adjust the ref accordingly
                  required: true,
            },
      ],
      datetime: {
            type: String,
            default: moment().tz("Asia/Kolkata").format("DD-MM-YYYY HH:mm:ss"),
      }, // Adjust the maxlength as needed
      deleted_at: { type: Date, default: null },
});
reelSchema.plugin(autoIncrement.plugin, {
      model: "Reel",
      field: "share_Id",
      startAt: 1,
});

reelSchema.pre("save", function (next) {
      // Capitalize the first letter of title
      if (this.isModified("title")) {
            this.title =
                  this.title.charAt(0).toUpperCase() + this.title.slice(1);
      }
      // Capitalize the first letter of description
      if (this.isModified("description")) {
            this.description =
                  this.description.charAt(0).toUpperCase() +
                  this.description.slice(1);
      }
      next();
});

const reelLikeSchema = mongoose.Schema({
      user_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      reel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Reel" },
      count: { type: Number, default: 0 },
      datetime: {
            type: String,
            default: moment().tz("Asia/Kolkata").format("DD-MM-YYYY HH:mm:ss"),
      },
});
const reelCommentSchema = mongoose.Schema({
      user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Reel" },
      comment: { type: String, required: true },
      datetime: {
            type: String,
            default: moment().tz("Asia/Kolkata").format("DD-MM-YYYY HH:mm:ss"),
      },
});

reelSchema.set("toJSON", {
      transform: (doc, ret) => {
            const { reel_name, updatedAt, __v, ...response } = ret;
            return response;
      },
});

const ReelComment = mongoose.model("ReelComment", reelCommentSchema);
const ReelLike = mongoose.model("ReelLike", reelLikeSchema);
const Reel = mongoose.model("Reel", reelSchema);

module.exports = { Reel, ReelLike, ReelComment };
