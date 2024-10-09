const mongoose = require("mongoose");
const moment = require("moment-timezone");

const timelineSchema = mongoose.Schema({
      user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      title: { type: String },
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

timelineSchema.pre("save", function (next) {
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

const postTimelineLikeSchema = mongoose.Schema({
      user_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      post_timeline_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PostTimeline",
      },
      count: { type: Number, default: 0 },
      datetime: {
            type: String,
            default: moment().tz("Asia/Kolkata").format("DD-MM-YYYY HH:mm:ss"),
      },
});

const timelineCommentSchema = mongoose.Schema({
      user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timeline_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PostTimeline",
      },
      comment: { type: String, required: true },
      datetime: {
            type: String,
            default: moment().tz("Asia/Kolkata").format("DD-MM-YYYY HH:mm:ss"),
      },
});

timelineSchema.set("toJSON", {
      transform: (doc, ret) => {
            const { updatedAt, __v, ...response } = ret;
            return response;
      },
});

const TimelineComment = mongoose.model(
      "PostTimelineComment",
      timelineCommentSchema
);
const PostTimelineLike = mongoose.model(
      "PostTimelineLike",
      postTimelineLikeSchema
);
const PostTimeline = mongoose.model("PostTimeline", timelineSchema);

module.exports = { PostTimeline, PostTimelineLike, TimelineComment };
