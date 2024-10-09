const dotenv = require("dotenv");
const fs = require("fs");
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const { Reel, ReelLike, ReelComment } = require("../models/reelsModel.js");

const Subscribes = require("../models/subscribeModel.js");
const multer = require("multer");
const path = require("path");
const { AdminDashboard } = require("../models/userModel.js");
const {
      getSignedUrlS3,
      PutObjectReels,
      PutObjectReelsthumbnail,
      DeleteSignedUrlS3,
} = require("../config/aws-s3.js");
const { tr } = require("date-fns/locale");
require("dotenv").config();
const baseURL = process.env.BASE_URL;

const reel_names_path = [];
const thumbnail_names_path = [];

const uploadReel = asyncHandler(async (req, res) => {
      const { category_id, description, title, reels_key, thumbnail_key } =
            req.body;
      const user_id = req.user._id;

      if (!category_id || !description || !title) {
            return res.status(400).json({
                  message: "Please enter all the required fields.",
                  status: false,
            });
      }

      const reelPath = reel_names_path[0];
      const thumbnailPath = thumbnail_names_path[0];

      const reel = await Reel.create({
            reel_name: reels_key,
            category_id,
            title,
            thumbnail_name: thumbnail_key,
            description,
            user_id,
      });

      if (reel) {
            // Increment reels_count in AdminDashboard
            try {
                  const adminDashboard = await AdminDashboard.findOne();
                  adminDashboard.reels_count++;
                  await adminDashboard.save();
            } catch (error) {
                  console.error("Error incrementing reels count:", error);
            }
      }

      if (reel) {
            res.status(201).json({
                  _id: reel._id,
                  reel_name: reel.reel_name,
                  category_id: reel.category_id,
                  title: reel.title,
                  thumbnail_name: reel.thumbnail_name,
                  description: reel.description,
                  user_id: reel.user_id,
                  status: true,
            });
      } else {
            res.status(200).json({
                  message: "Reel Not Uploaded.",
                  status: false,
            });
      }
});

const getReelLikeCount = async (reel_id) => {
      try {
            const reelLike = await ReelLike.findOne(
                  { reel_id: reel_id },
                  { count: 1, _id: 0 }
            );
            return reelLike ? reelLike.count : 0;
      } catch (error) {
            throw new Error("Error fetching Reel like count");
      }
};

const getPaginatedReel = asyncHandler(async (req, res) => {
      const page = parseInt(req.params.page) || 1;
      const limit = parseInt(req.query.limit) || 5;
      const startIndex = (page - 1) * limit;

      try {
            let reeldQuery = Reel.find({ deleted_at: null });

            if (req.body.category_id) {
                  reeldQuery = reeldQuery.where({
                        category_id: req.body.category_id,
                  });
            }

            if (req.body.search) {
                  reeldQuery = reeldQuery.where({
                        title: { $regex: req.body.search, $options: "i" },
                  });
            }

            let totalReels;

            const category_id = req.body.category_id;
            const search = req.body.search;

            if (category_id) {
                  reeldQuery = reeldQuery
                        .where("category_id")
                        .equals(category_id);
                  totalReels = await Reel.countDocuments({
                        category_id,
                        deleted_at: null,
                  });
            } else if (search) {
                  reeldQuery = reeldQuery.where(
                        "title",
                        new RegExp(search, "i")
                  );
                  totalReels = await Reel.countDocuments({
                        title: search,
                        deleted_at: null,
                  });
            } else {
                  totalReels = await Reel.countDocuments({
                        deleted_at: null,
                  });
            }

            const paginatedReels = await reeldQuery
                  .sort({ view_count: -1 })
                  .skip(startIndex)
                  .limit(limit)
                  .populate({
                        path: "user_id",
                        select: "first_name last_name pic",
                  })
                  .populate({
                        path: "category_id",
                        select: "category_name",
                  })
                  .exec();

            const hasMore = startIndex + paginatedReels.length < totalReels;

            if (paginatedReels.length === 0) {
                  return res.json({
                        message: "Reels Not Found",
                        status: true,
                        data: [],
                  });
            }

            const transformedReels = [];
            const token = req.header("Authorization");

            for (const reel of paginatedReels) {
                  let like_status = "No";
                  let subscribe_status = "No";
                  let like_count = 0;

                  const reelLikeCount = await ReelLike.find({
                        reel_id: reel._id,
                  });

                  for (const reelLikeCountUpdate of reelLikeCount) {
                        like_count += reelLikeCountUpdate.count;
                  }

                  const pic_name_url = await getSignedUrlS3(reel.user_id.pic);
                  const updatedUser = {
                        ...reel.user_id._doc,
                        pic: pic_name_url,
                  };

                  if (token && req.user) {
                        const isLiked = await ReelLike.exists({
                              reel_id: reel._id,
                              user_ids: req.user._id,
                        });

                        like_status = isLiked ? "Yes" : "No";

                        const isSubscribed = await Subscribes.exists({
                              my_id: reel.user_id._id,
                              subscriber_id: req.user._id,
                        });

                        subscribe_status = isSubscribed ? "Yes" : "No";
                  }

                  const thumbnail_name_url = await getSignedUrlS3(
                        reel.thumbnail_name
                  );
                  const video_name_url = await getSignedUrlS3(reel.reel_name);

                  transformedReels.push({
                        ...reel._doc,
                        reel_url: video_name_url,
                        thumbnail_name: thumbnail_name_url,
                        user_id: updatedUser,
                        like_count,
                        like_status,
                        subscribe_status,
                  });
            }

            res.json({
                  page,
                  limit,
                  data: transformedReels,
                  hasMore,
                  status: true,
            });
      } catch (error) {
            res.status(500).json({
                  message: "Internal Server Error",
                  error: error.message,
                  status: false,
            });
      }
});

const getPaginatedReelsAdmin = asyncHandler(async (req, res) => {
      const page = parseInt(req.body.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const startIndex = (page - 1) * limit;
      const { Short } = req.body;

      try {
            let reelQuery = Reel.find();

            if (req.body.search) {
                  reelQuery = reelQuery.where({
                        title: { $regex: req.body.search, $options: "i" },
                  });
            }

            let sortCriteria = {};
            if (Short === "view_count") {
                  sortCriteria = { view_count: -1 }; // Sort by review in descending order
            } else if (Short === "comment_count") {
                  sortCriteria = { comment_count: -1 }; // Sort by watch_time in descending order
            } else {
                  sortCriteria = { _id: -1 }; // Default sorting
            }

            // Use Mongoose to fetch paginated reels from the database
            const paginatedReels = await reelQuery
                  .sort(sortCriteria)
                  .skip(startIndex)
                  .limit(limit)
                  .populate({
                        path: "user_id",
                        select: "first_name last_name pic", // Adjust these fields based on your User schema
                  })
                  .populate({
                        path: "category_id",
                        select: "category_name", // Adjust this field based on your Category schema
                  });

            const totalReels = await Reel.countDocuments(reelQuery.getQuery());
            const totalPages = Math.ceil(totalReels / limit);
            const hasMore = startIndex + paginatedReels.length < totalReels;

            if (paginatedReels.length === 0) {
                  return res.json({
                        message: "Reels Not Found",
                        status: true,
                  });
            }

            // Transform and exclude specific fields in the response
            const transformedReels = [];
            const token = req.header("Authorization");

            for (const reel of paginatedReels) {
                  const { reel_name, updatedAt, __v, ...response } = reel._doc;

                  let like_status = "No";
                  let subscribe_status = "No";
                  let like_count = 0;

                  // Get the total like count for each reel
                  const reelLikeCount = await ReelLike.findOne({
                        reel_id: reel._id,
                  }).select("count");

                  if (reelLikeCount) {
                        like_count = reelLikeCount.count;
                  }

                  const pic_name_url = await getSignedUrlS3(reel.user_id.pic);
                  const updatedUser = {
                        ...reel.user_id._doc,
                        pic: pic_name_url,
                  };

                  if (token) {
                        // Check if the user has liked the current reel
                        const isLiked = await ReelLike.exists({
                              reel_id: reel._id,
                              user_ids: req.user._id,
                        });

                        like_status = isLiked ? "Yes" : "No";

                        // Check if the user has subscribed to the author
                        const isSubscribed = await Subscribes.exists({
                              my_id: reel.user_id?._id,
                              subscriber_id: req.user?._id,
                        });

                        subscribe_status = isSubscribed ? "Yes" : "No";
                  }

                  const thumbnail_name_url = await getSignedUrlS3(
                        reel.thumbnail_name
                  );
                  const reel_name_url = await getSignedUrlS3(reel.reel_name);

                  transformedReels.push({
                        ...response,
                        video_url: reel_name_url,
                        thumbnail_name: thumbnail_name_url,
                        user_id: updatedUser,
                        like_count,
                        like_status,
                        subscribe_status,
                  });
            }
            const paginationDetails = {
                  current_page: page,
                  data: transformedReels,
                  first_page_url: `${baseURL}api/reels?page=1&limit=${limit}`,
                  from: startIndex + 1,
                  last_page: totalPages,
                  last_page_url: `${baseURL}api/reels?page=${totalPages}&limit=${limit}`,
                  next_page_url:
                        page < totalPages
                              ? `${baseURL}api/reels?page=${
                                      page + 1
                                }&limit=${limit}`
                              : null,
                  path: `${baseURL}api/reels`,
                  per_page: limit,
                  prev_page_url:
                        page > 1
                              ? `${baseURL}api/reels?page=${
                                      page - 1
                                }&limit=${limit}`
                              : null,
                  to: startIndex + transformedReels.length,
                  total: totalReels,
                  hasMore: hasMore, // Include the hasMore flag in the response
            };

            res.json({
                  Reels: paginationDetails,
                  page: page.toString(),
                  total_rows: totalReels,
            });
      } catch (error) {
            res.status(500).json({
                  message: "Internal Server Error",
                  error: error.message,
                  status: false,
            });
      }
});

const getReel_ByCategory = asyncHandler(async (req, res) => {
      const { category_id, page_number } = req.body;
      const limit = parseInt(req.query.limit) || 1; // Default limit set to 10
      const page = parseInt(page_number) || 1;
      const startIndex = (page - 1) * limit;

      try {
            const paginatedReels = await Reel.find({
                  category_id,
                  deleted_at: null,
            }) // Query by category_id
                  .skip(startIndex)
                  .limit(limit)
                  .populate({
                        path: "user_id",
                        select: "first_name last_name pic",
                  })
                  .populate({
                        path: "category_id",
                        select: "category_name",
                  });

            const totalReels = await Reel.countDocuments({ category_id }); // Count documents based on category_id
            const hasMore = startIndex + paginatedReels.length < totalReels;

            if (paginatedReels.length === 0) {
                  return res.json({
                        message: "Reels Not Found",
                        status: true,
                        data: [],
                  });
            }

            const transformedReels = [];

            const token = req.header("Authorization");

            for (const reel of paginatedReels) {
                  const { reel_name, updatedAt, __v, ...response } = reel._doc;

                  let like_status = "No";
                  let subscribe_status = "No";
                  let like_count = 0;

                  // Get the like count for each reel
                  const reelLikeCount = await ReelLike.find({
                        reel_id: reel._id,
                  });

                  for (const reelLikeCountUpdate of reelLikeCount) {
                        like_count = reelLikeCountUpdate.count; // Fix the assignment here, use '=' instead of ':'
                  }
                  const pic_name_url = await getSignedUrlS3(reel.user_id.pic);
                  // Add the base URL to the user's profile picture
                  const updatedUser = {
                        ...reel.user_id._doc,
                        pic: pic_name_url,
                  };

                  if (token) {
                        // Check if the user has liked the current reel
                        const isLiked = await ReelLike.exists({
                              reel_id: reel._id,
                              user_ids: req.user._id,
                        });

                        // Set like_status based on whether the user has liked the reel
                        like_status = isLiked ? "Yes" : "No";

                        // Check if the user has subscribed to the author
                        const isSubscribed = await Subscribes.exists({
                              my_id: reel.user_id._id,
                              subscriber_id: req.user._id,
                        });

                        // Set subscribe_status based on whether the user has subscribed to the author
                        subscribe_status = isSubscribed ? "Yes" : "No";
                  }
                  const thumbnail_name_url = await getSignedUrlS3(
                        reel.thumbnail_name
                  );
                  const video_name_url = await getSignedUrlS3(reel.reel_name);

                  transformedReels.push({
                        ...response,
                        reel_url: video_name_url,
                        thumbnail_name: thumbnail_name_url,
                        user_id: updatedUser,
                        like_count,
                        like_status,
                        subscribe_status,
                  });
            }

            res.json({
                  page,
                  limit,
                  data: transformedReels,
                  hasMore,
                  status: true,
            });
      } catch (error) {
            res.status(500).json({
                  message: "Internal Server Error",
                  error: error.message,
                  status: false,
            });
      }
});

const streamReel = asyncHandler(async (req, res) => {
      const reelId = req.params.reelId;

      const reel = await Reel.findById({ reelId, deleted_at: null });

      if (!reel) {
            return res.status(404).json({
                  message: "Reel not found",
                  status: false,
            });
      }

      const fileName = reel.reel_name;
      const filePath = path.join("public", "reels", fileName);

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            const chunksize = end - start + 1;
            const fileStream = fs.createReadStream(filePath, { start, end });

            const headers = {
                  "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                  "Accept-Ranges": "bytes",
                  "Content-Length": chunksize,
                  "Content-Type": "video/mp4",
            };

            res.writeHead(206, headers);
            fileStream.pipe(res);
      } else {
            const headers = {
                  "Content-Length": fileSize,
                  "Content-Type": "video/mp4",
            };

            res.writeHead(200, headers);
            fs.createReadStream(filePath).pipe(res);
      }
});

const updateReelLike = asyncHandler(async (req, res) => {
      try {
            const user_id = req.user._id;
            const { reel_id, count } = req.body;

            // Ensure reel_id is a valid ObjectId
            if (!mongoose.Types.ObjectId.isValid(reel_id)) {
                  return res.status(200).json({
                        message: "Invalid reel_id format.",
                        status: false,
                  });
            }

            // Convert the reel_id to ObjectId
            const objectIdReelId = mongoose.Types.ObjectId(reel_id);

            // Find the reel in the ReelLike collection
            let existingLike = await ReelLike.findOne({
                  reel_id: objectIdReelId,
            });

            if (existingLike) {
                  // Check if the user_id is already in the user_ids array
                  const userIndex = existingLike.user_ids.indexOf(user_id);

                  if (count === "1" && userIndex === -1) {
                        // Increment count and add user_id if count is 1 and user_id is not already present
                        existingLike.count += 1;
                        existingLike.user_ids.push(user_id);
                  } else if (count === "0" && userIndex !== -1) {
                        // Decrement count and remove user_id if count is 0 and user_id is present
                        existingLike.count -= 1;
                        existingLike.user_ids.splice(userIndex, 1);
                  }

                  // Save the updated record
                  existingLike = await existingLike.save();

                  res.status(200).json({
                        message: "Reel like updated successfully.",
                        status: true,
                        data: existingLike,
                  });
            } else {
                  // Create a new record if the reel is not already in the ReelLike collection
                  const newLike = new ReelLike({
                        user_ids: [user_id],
                        reel_id: objectIdReelId,
                        count: count === "1" ? 1 : 0, // Set count based on input
                  });

                  const savedLike = await newLike.save();

                  res.status(201).json({
                        message: "Reel like created successfully.",
                        status: true,
                        data: savedLike,
                  });
            }
      } catch (error) {
            console.error(error);
            res.status(500).json({
                  message: "Internal Server Error",
                  status: false,
            });
      }
});

const addReelComment = asyncHandler(async (req, res) => {
      try {
            // Extract user_id from headers
            const user_id = req.user._id;
            const { reel_id, comment } = req.body;

            // Ensure reel_id is a valid ObjectId
            if (!mongoose.Types.ObjectId.isValid(reel_id)) {
                  return res.status(200).json({
                        message: "Invalid reel_id format.",
                        status: false,
                  });
            }

            // Convert reel_id to ObjectId
            const objectIdReelId = mongoose.Types.ObjectId(reel_id);

            // Create a new ReelComment
            const newComment = new ReelComment({
                  user_id: mongoose.Types.ObjectId(user_id),
                  reel_id: objectIdReelId,
                  comment,
            });

            // Save the comment
            const savedComment = await newComment.save();

            await Reel.findByIdAndUpdate(
                  objectIdReelId,
                  { $inc: { comment_count: 1 } }, // Increment comment_count by 1
                  { new: true } // Return the updated document
            );

            res.status(201).json({
                  message: "Reel comment added successfully.",
                  status: true,
                  data: savedComment,
            });
      } catch (error) {
            console.error(error);
            res.status(500).json({
                  message: "Internal Server Error",
                  status: false,
            });
      }
});

const getReelComments = asyncHandler(async (req, res) => {
      const { reelId } = req.params;

      try {
            // Use Mongoose to fetch reel comments from the database
            const reelComments = await ReelComment.find({ reel_id: reelId })
                  .populate({
                        path: "user_id",
                        select: "first_name last_name pic", // Adjust these fields based on your User schema
                  })
                  .exec();

            // Check if there are no comments
            if (!reelComments || reelComments.length === 0) {
                  return res.json({
                        message: "No Comments Available.",
                        status: true,
                        data: [],
                  });
            }

            // Fetch reel details
            const reelDetails = await Reel.findOne({
                  _id: reelId,
                  deleted_at: null,
            })
                  .populate({
                        path: "user_id",
                        select: "first_name last_name pic", // Adjust these fields based on your User schema
                  })
                  .populate({
                        path: "category_id",
                        select: "category_name", // Adjust this field based on your Category schema
                  })
                  .exec();

            const likeCount = await getReelLikeCount(reelId);

            // Add the base URL to the pic field in reel details
            const pic_name_url = await getSignedUrlS3(reelDetails.user_id.pic);
            const updatedReelDetails = {
                  ...reelDetails._doc,
                  user_id: {
                        ...reelDetails.user_id._doc,
                        pic: pic_name_url,
                  },
            };

            // Add the base URL to the pic field in comments
            const updatedReelComments = await Promise.all(
                  reelComments.map(async (comment) => {
                        const pic_name_url = await getSignedUrlS3(
                              comment.user_id.pic
                        );
                        return {
                              ...comment._doc,
                              user_id: {
                                    ...comment.user_id._doc,
                                    pic: pic_name_url,
                              },
                        };
                  })
            );

            res.json({
                  message: "Reel comments fetched successfully.",
                  status: true,
                  reel_details: updatedReelDetails,
                  comments: updatedReelComments,
            });
      } catch (error) {
            console.error(error);
            res.status(500).json({
                  message: "Internal Server Error",
                  status: false,
            });
      }
});

const updateReelViewCount = asyncHandler(async (req, res) => {
      try {
            // Extract reel_id from the request body
            const { reel_id } = req.body;

            // Ensure reel_id is a valid ObjectId
            if (!mongoose.Types.ObjectId.isValid(reel_id)) {
                  return res.status(200).json({
                        message: "Invalid reel_id format.",
                        status: false,
                  });
            }

            // Convert reel_id to ObjectId
            const objectIdReelId = mongoose.Types.ObjectId(reel_id);

            // Update the view count in the Reel model
            const updatedReel = await Reel.findByIdAndUpdate(
                  objectIdReelId
                  // { $inc: { view_count: 1 } },
                  // { new: true }
            );

            if (!updatedReel) {
                  return res.status(404).json({
                        message: "Reel not found.",
                        status: false,
                  });
            }

            res.status(200).json({
                  message: "View count updated successfully.",
                  status: true,
                  data: updatedReel,
            });
      } catch (error) {
            console.error(error);
            res.status(500).json({
                  message: "Internal Server Error",
                  status: false,
            });
      }
});

const getMyReels = asyncHandler(async (req, res) => {
      const user_id = req.user._id;
      const page = parseInt(req.params.page) || 1;
      const limit = parseInt(req.query.limit) || 5;
      const startIndex = (page - 1) * limit;

      try {
            // Fetch reels from the database for the given user_id with pagination
            let reeldQuery = Reel.find({ user_id, deleted_at: null });

            if (req.body.category_id) {
                  reeldQuery = reeldQuery.where({
                        category_id: req.body.category_id,
                  });
            }

            if (req.body.search) {
                  reeldQuery = reeldQuery.where({
                        title: { $regex: req.body.search, $options: "i" },
                  });
            }

            let totalReels;

            const category_id = req.body.category_id;
            const search = req.body.search;

            if (category_id) {
                  reeldQuery = reeldQuery
                        .where("category_id")
                        .equals(category_id);
                  totalReels = await Reel.countDocuments({
                        user_id,
                        category_id,
                        deleted_at: null,
                  });
            } else if (search) {
                  reeldQuery = reeldQuery.where(
                        "title",
                        new RegExp(search, "i")
                  );
                  totalReels = await Reel.countDocuments({
                        user_id,
                        title: search,
                        deleted_at: null,
                  });
            } else {
                  totalReels = await Reel.countDocuments({
                        user_id,
                        deleted_at: null,
                  });
                  console.log(totalReels);
            }

            const paginatedReels = await reeldQuery
                  .sort({ view_count: -1 })
                  .skip(startIndex)
                  .limit(limit)
                  .populate({
                        path: "user_id",
                        select: "first_name last_name pic",
                  })
                  .populate({
                        path: "category_id",
                        select: "category_name",
                  })
                  .exec();

            const hasMore = startIndex + paginatedReels.length < totalReels;

            if (paginatedReels.length === 0) {
                  return res.json({
                        message: "Reels Not Found",
                        status: true,
                        data: [],
                  });
            }

            const token = req.header("Authorization");

            // Add the base URL to the pic field in user details and handle likes and subscriptions
            const updatedReels = await Promise.all(
                  paginatedReels.map(async (reel) => {
                        let like_status = "No"; // Move the declaration inside the loop
                        let subscribe_status = "No"; // Move the declaration inside the loop
                        const likeCount = await getReelLikeCount(reel._id);

                        if (token) {
                              // Check if the user has liked the current post
                              const isLiked = await ReelLike.exists({
                                    reel_id: reel._id,
                                    user_ids: req.user._id,
                              });

                              // Set like_status based on whether the user has liked the post
                              like_status = isLiked ? "Yes" : "No";

                              const issubscribe = await Subscribes.exists({
                                    my_id: reel.user_id._id,
                                    subscriber_id: req.user._id,
                              });

                              // Set subscribe_status based on whether the user has subscribed to the author
                              subscribe_status = issubscribe ? "Yes" : "No";
                        }
                        const thumbnail_name_url = await getSignedUrlS3(
                              reel.thumbnail_name
                        );
                        const video_name_url = await getSignedUrlS3(
                              reel.reel_name
                        );
                        const pic_name_url = await getSignedUrlS3(
                              reel.user_id.pic
                        );
                        return {
                              ...reel._doc,
                              user_id: {
                                    ...reel.user_id._doc,
                                    pic: pic_name_url, // Assuming "pic" is the field in your User schema that contains the URL
                              },
                              like_count: likeCount,
                              like_status: like_status,
                              subscribe_status: subscribe_status,
                              reel_url: video_name_url,
                              thumbnail_name: thumbnail_name_url,
                        };
                  })
            );

            res.json({
                  message: "Reels fetched successfully.",
                  status: true,
                  data: updatedReels,
                  hasMore,
            });
      } catch (error) {
            console.error(error);
            res.status(500).json({
                  message: "Internal Server Error",
                  status: false,
            });
      }
});

const getUserReels = asyncHandler(async (req, res) => {
      const { user_id, page } = req.params;
      const limit = parseInt(req.query.limit) || 5;
      const startIndex = (page - 1) * limit;

      try {
            // Fetch reels from the database for the given user_id with pagination
            let reeldQuery = Reel.find({ user_id, deleted_at: null });

            if (req.body.category_id) {
                  reeldQuery = reeldQuery.where({
                        category_id: req.body.category_id,
                  });
            }

            if (req.body.search) {
                  reeldQuery = reeldQuery.where({
                        title: { $regex: req.body.search, $options: "i" },
                  });
            }

            let totalReels;

            const category_id = req.body.category_id;
            const search = req.body.search;

            if (category_id) {
                  reeldQuery = reeldQuery
                        .where("category_id")
                        .equals(category_id);
                  totalReels = await Reel.countDocuments({
                        user_id,
                        category_id,
                        deleted_at: null,
                  });
            } else if (search) {
                  reeldQuery = reeldQuery.where(
                        "title",
                        new RegExp(search, "i")
                  );
                  totalReels = await Reel.countDocuments({
                        user_id,
                        title: search,
                        deleted_at: null,
                  });
            } else {
                  totalReels = await Reel.countDocuments({
                        user_id,
                        deleted_at: null,
                  });
                  console.log(totalReels);
            }

            const paginatedReels = await reeldQuery
                  .sort({ view_count: -1 })
                  .skip(startIndex)
                  .limit(limit)
                  .populate({
                        path: "user_id",
                        select: "first_name last_name pic",
                  })
                  .populate({
                        path: "category_id",
                        select: "category_name",
                  })
                  .exec();

            const hasMore = startIndex + paginatedReels.length < totalReels;

            if (paginatedReels.length === 0) {
                  return res.json({
                        message: "Reels Not Found",
                        status: true,
                        data: [],
                  });
            }

            const token = req.header("Authorization");

            // Add the base URL to the pic field in user details and handle likes and subscriptions
            const updatedReels = await Promise.all(
                  paginatedReels.map(async (reel) => {
                        let like_status = "No"; // Move the declaration inside the loop
                        let subscribe_status = "No"; // Move the declaration inside the loop
                        const likeCount = await getReelLikeCount(reel._id);

                        if (token) {
                              // Check if the user has liked the current post
                              const isLiked = await ReelLike.exists({
                                    reel_id: reel._id,
                                    user_ids: req.user._id,
                              });

                              // Set like_status based on whether the user has liked the post
                              like_status = isLiked ? "Yes" : "No";

                              const issubscribe = await Subscribes.exists({
                                    my_id: reel.user_id._id,
                                    subscriber_id: req.user._id,
                              });

                              // Set subscribe_status based on whether the user has subscribed to the author
                              subscribe_status = issubscribe ? "Yes" : "No";
                        }
                        const thumbnail_name_url = await getSignedUrlS3(
                              reel.thumbnail_name
                        );
                        const video_name_url = await getSignedUrlS3(
                              reel.reel_name
                        );
                        const pic_name_url = await getSignedUrlS3(
                              reel.user_id.pic
                        );
                        return {
                              ...reel._doc,
                              user_id: {
                                    ...reel.user_id._doc,
                                    pic: pic_name_url, // Assuming "pic" is the field in your User schema that contains the URL
                              },
                              like_count: likeCount,
                              like_status: like_status,
                              subscribe_status: subscribe_status,
                              reel_url: video_name_url,
                              thumbnail_name: thumbnail_name_url,
                        };
                  })
            );

            res.json({
                  message: "Reels fetched successfully.",
                  status: true,
                  data: updatedReels,
                  hasMore,
            });
      } catch (error) {
            console.error(error);
            res.status(500).json({
                  message: "Internal Server Error",
                  status: false,
            });
      }
});

const getPaginatedReelWebsite = asyncHandler(async (req, res) => {
      const page = parseInt(req.params.page) || 1;
      const share_Id = parseInt(req.params.share_Id);
      const limit = parseInt(req.query.limit) || 5;
      const startIndex = (page - 1) * limit;

      try {
            let reeldQuery = Reel.find({ deleted_at: null });
            let totalReels;
            const category_id = req.body.category_id;
            const search = req.body.search;
            if (req.body.category_id) {
                  reeldQuery = reeldQuery.where({
                        category_id: req.body.category_id,
                  });
                  totalReels = await Reel.countDocuments({
                        category_id,
                        deleted_at: null,
                  });
            } else if (req.body.search) {
                  reeldQuery = reeldQuery.where({
                        title: { $regex: req.body.search, $options: "i" },
                  });
                  totalReels = await Reel.countDocuments({
                        title: { $regex: req.body.search, $options: "i" },
                        deleted_at: null,
                  });
            } else if (share_Id !== 1) {
                  reeldQuery = reeldQuery.where({ share_Id: share_Id });
            } else {
                  totalReels = await Reel.countDocuments();
            }

            // Agar share_Id 1 hai, toh kuch nahi karna, waisa hi chalne dena

            const paginatedReels = await reeldQuery
                  .sort({ view_count: -1 })
                  .skip(startIndex)
                  .limit(limit)
                  .populate({
                        path: "user_id",
                        select: "first_name last_name pic",
                  })
                  .populate({
                        path: "category_id",
                        select: "category_name",
                  });

            const hasMore = startIndex + paginatedReels.length < totalReels;

            if (paginatedReels.length === 0) {
                  return res.json({
                        message: "Reels Not Found",
                        status: true,
                        data: [],
                        hasMore: false,
                  });
            }

            const transformedReels = [];

            const token = req.header("Authorization");

            for (const reel of paginatedReels) {
                  const { reel_name, updatedAt, __v, ...response } = reel._doc;

                  let like_status = "No";
                  let subscribe_status = "No";
                  let like_count = 0;

                  const reelLikeCount = await ReelLike.find({
                        reel_id: reel._id,
                  });

                  for (const reelLikeCountUpdate of reelLikeCount) {
                        like_count = reelLikeCountUpdate.count;
                  }
                  const pic_name_url = await getSignedUrlS3(reel.user_id.pic);

                  const updatedUser = {
                        ...reel.user_id._doc,
                        pic: pic_name_url,
                  };

                  if (token) {
                        const isLiked = await ReelLike.exists({
                              reel_id: reel._id,
                              user_ids: req.user._id,
                        });

                        like_status = isLiked ? "Yes" : "No";

                        const isSubscribed = await Subscribes.exists({
                              my_id: reel.user_id._id,
                              subscriber_id: req.user._id,
                        });

                        subscribe_status = isSubscribed ? "Yes" : "No";
                  }
                  const thumbnail_name_url = await getSignedUrlS3(
                        reel.thumbnail_name
                  );
                  const video_name_url = await getSignedUrlS3(reel.reel_name);

                  transformedReels.push({
                        ...response,
                        reel_url: video_name_url,
                        thumbnail_name: thumbnail_name_url,
                        user_id: updatedUser,
                        like_count,
                        like_status,
                        subscribe_status,
                  });
            }

            res.json({
                  page,
                  limit,
                  data: transformedReels,
                  hasMore,
                  status: true,
            });
      } catch (error) {
            res.status(500).json({
                  message: "Internal Server Error",
                  error: error.message,
                  status: false,
            });
      }
});

const getPaginatedReelWebsiteFillter = asyncHandler(async (req, res) => {
      const page = parseInt(req.params.page) || 1;
      const share_Id = parseInt(req.params.share_Id);
      const limit = parseInt(req.query.limit) || 100;
      const startIndex = (page - 1) * limit;

      try {
            let reeldQuery = Reel.find({ deleted_at: null });
            let totalReels;
            const category_id = req.body.category_id;
            const search = req.body.search;
            if (req.body.category_id) {
                  reeldQuery = reeldQuery.where({
                        category_id: req.body.category_id,
                  });
                  totalReels = await Reel.countDocuments({
                        category_id,
                        deleted_at: null,
                  });
            } else if (req.body.search) {
                  reeldQuery = reeldQuery.where({
                        title: { $regex: req.body.search, $options: "i" },
                  });
                  totalReels = await Reel.countDocuments({
                        title: { $regex: req.body.search, $options: "i" },
                        deleted_at: null,
                  });
            } else if (share_Id !== 1) {
                  reeldQuery = reeldQuery.where({ share_Id: share_Id });
            } else {
                  totalReels = await Reel.countDocuments();
            }

            // Agar share_Id 1 hai, toh kuch nahi karna, waisa hi chalne dena

            const paginatedReels = await reeldQuery
                  .sort({ view_count: -1 })
                  .skip(startIndex)
                  .limit(limit)
                  .populate({
                        path: "user_id",
                        select: "first_name last_name pic",
                  })
                  .populate({
                        path: "category_id",
                        select: "category_name",
                  });

            const hasMore = startIndex + paginatedReels.length < totalReels;

            if (paginatedReels.length === 0) {
                  return res.json({
                        message: "Reels Not Found",
                        status: true,
                        data: [],
                        hasMore: false,
                  });
            }

            const transformedReels = [];

            const token = req.header("Authorization");

            for (const reel of paginatedReels) {
                  const { reel_name, updatedAt, __v, ...response } = reel._doc;

                  let like_status = "No";
                  let subscribe_status = "No";
                  let like_count = 0;

                  const reelLikeCount = await ReelLike.find({
                        reel_id: reel._id,
                  });

                  for (const reelLikeCountUpdate of reelLikeCount) {
                        like_count = reelLikeCountUpdate.count;
                  }
                  const pic_name_url = await getSignedUrlS3(reel.user_id.pic);

                  const updatedUser = {
                        ...reel.user_id._doc,
                        pic: pic_name_url,
                  };

                  if (token) {
                        const isLiked = await ReelLike.exists({
                              reel_id: reel._id,
                              user_ids: req.user._id,
                        });

                        like_status = isLiked ? "Yes" : "No";

                        const isSubscribed = await Subscribes.exists({
                              my_id: reel.user_id._id,
                              subscriber_id: req.user._id,
                        });

                        subscribe_status = isSubscribed ? "Yes" : "No";
                  }
                  const thumbnail_name_url = await getSignedUrlS3(
                        reel.thumbnail_name
                  );
                  const video_name_url = await getSignedUrlS3(reel.reel_name);

                  transformedReels.push({
                        ...response,
                        reel_url: video_name_url,
                        thumbnail_name: thumbnail_name_url,
                        user_id: updatedUser,
                        like_count,
                        like_status,
                        subscribe_status,
                  });
            }

            res.json({
                  page,
                  limit,
                  data: transformedReels,
                  hasMore,
                  status: true,
            });
      } catch (error) {
            res.status(500).json({
                  message: "Internal Server Error",
                  error: error.message,
                  status: false,
            });
      }
});

const getMyReelsWebsite = asyncHandler(async (req, res) => {
      const user_id = req.user._id; // Assuming you have user authentication middleware
      const page = parseInt(req.params.page) || 1;
      const limit = parseInt(req.query.limit) || 100;
      const startIndex = (page - 1) * limit;

      try {
            // Use Mongoose to fetch paginated Reels from the database
            const paginatedReels = await Reel.find({
                  user_id,
                  deleted_at: null,
            })
                  .skip(startIndex)
                  .limit(limit)
                  .populate({
                        path: "user_id",
                        select: "first_name last_name pic", // Adjust these fields based on your User schema
                  })
                  .populate({
                        path: "category_id",
                        select: "category_name", // Adjust this field based on your Category schema
                  });

            const totalReels = await Reel.countDocuments();
            const hasMore = startIndex + paginatedReels.length < totalReels;

            if (paginatedReels.length === 0) {
                  return res.json({
                        message: "Reels Not Found",
                        status: true,
                        data: [],
                  });
            }

            // Transform and exclude specific fields in the response
            const transformedReels = [];

            const token = req.header("Authorization");

            for (const reel of paginatedReels) {
                  const { reel_name, updatedAt, __v, ...response } = reel._doc;

                  let like_status = "No";
                  let subscribe_status = "No";
                  let like_count = 0;

                  // Get the like count for each reel
                  const reelLikeCount = await ReelLike.find({
                        reel_id: reel._id,
                  });

                  for (const reelLikeCountUpdate of reelLikeCount) {
                        like_count = reelLikeCountUpdate.count; // Fix the assignment here, use '=' instead of ':'
                  }
                  const pic_name_url = await getSignedUrlS3(reel.user_id.pic);
                  // Add the base URL to the user's profile picture
                  const updatedUser = {
                        ...reel.user_id._doc,
                        pic: pic_name_url,
                  };

                  if (token) {
                        // Check if the user has liked the current reel
                        const isLiked = await ReelLike.exists({
                              reel_id: reel._id,
                              user_ids: req.user._id,
                        });

                        // Set like_status based on whether the user has liked the reel
                        like_status = isLiked ? "Yes" : "No";

                        // Check if the user has subscribed to the author
                        const isSubscribed = await Subscribes.exists({
                              my_id: reel.user_id._id,
                              subscriber_id: req.user._id,
                        });

                        // Set subscribe_status based on whether the user has subscribed to the author
                        subscribe_status = isSubscribed ? "Yes" : "No";
                  }
                  const thumbnail_name_url = await getSignedUrlS3(
                        reel.thumbnail_name
                  );
                  const video_name_url = await getSignedUrlS3(reel.reel_name);

                  transformedReels.push({
                        ...response,
                        reel_url: video_name_url,
                        thumbnail_name: thumbnail_name_url,
                        user_id: updatedUser,
                        like_count,
                        like_status,
                        subscribe_status,
                  });
            }

            res.json({
                  page,
                  limit,
                  data: transformedReels,
                  hasMore,
                  status: true,
            });
      } catch (error) {
            res.status(500).json({
                  message: "Internal Server Error",
                  error: error.message,
                  status: false,
            });
      }
});

const getMyReel_ByCategory = asyncHandler(async (req, res) => {
      const user_id = req.user._id;
      const { category_id, page_number } = req.body;
      const limit = parseInt(req.query.limit) || 1; // Default limit set to 1
      const page = parseInt(page_number) || 1;
      const startIndex = (page - 1) * limit;

      try {
            const paginatedReels = await Reel.find({
                  user_id,
                  category_id,
                  deleted_at: null,
            }) // Query by both user_id and category_id
                  .skip(startIndex)
                  .limit(limit)
                  .populate({
                        path: "user_id",
                        select: "first_name last_name pic",
                  })
                  .populate({
                        path: "category_id",
                        select: "category_name",
                  });

            const totalReels = await Reel.countDocuments({
                  user_id,
                  category_id,
            }); // Count documents based on both user_id and category_id
            const hasMore = startIndex + paginatedReels.length < totalReels;

            if (paginatedReels.length === 0) {
                  return res.json({
                        message: "Reels Not Found",
                        status: true,
                        data: [],
                  });
            }

            const transformedReels = [];

            const token = req.header("Authorization");

            for (const reel of paginatedReels) {
                  const { reel_name, updatedAt, __v, ...response } = reel._doc;

                  let like_status = "No";
                  let subscribe_status = "No";
                  let like_count = 0;

                  // Get the like count for each reel
                  const reelLikeCount = await ReelLike.find({
                        reel_id: reel._id,
                  });

                  for (const reelLikeCountUpdate of reelLikeCount) {
                        like_count = reelLikeCountUpdate.count; // Fix the assignment here, use '=' instead of ':'
                  }
                  const pic_name_url = await getSignedUrlS3(reel.user_id.pic);
                  // Add the base URL to the user's profile picture
                  const updatedUser = {
                        ...reel.user_id._doc,
                        pic: pic_name_url,
                  };

                  if (token) {
                        // Check if the user has liked the current reel
                        const isLiked = await ReelLike.exists({
                              reel_id: reel._id,
                              user_ids: req.user._id,
                        });

                        // Set like_status based on whether the user has liked the reel
                        like_status = isLiked ? "Yes" : "No";

                        // Check if the user has subscribed to the author
                        const isSubscribed = await Subscribes.exists({
                              my_id: reel.user_id._id,
                              subscriber_id: req.user._id,
                        });

                        // Set subscribe_status based on whether the user has subscribed to the author
                        subscribe_status = isSubscribed ? "Yes" : "No";
                  }
                  const thumbnail_name_url = await getSignedUrlS3(
                        reel.thumbnail_name
                  );
                  const video_name_url = await getSignedUrlS3(reel.reel_name);

                  transformedReels.push({
                        ...response,
                        reel_url: video_name_url,
                        thumbnail_name: thumbnail_name_url,
                        user_id: updatedUser,
                        like_count,
                        like_status,
                        subscribe_status,
                  });
            }

            res.json({
                  page,
                  limit,
                  data: transformedReels,
                  hasMore,
                  status: true,
            });
      } catch (error) {
            res.status(500).json({
                  message: "Internal Server Error",
                  error: error.message,
                  status: false,
            });
      }
});

const getUserReelsWebsite = asyncHandler(async (req, res) => {
      const { user_id, page } = req.body;
      const limit = parseInt(req.query.limit) || 100;
      const startIndex = (page - 1) * limit;
      try {
            const reels = await Reel.find({ user_id, deleted_at: null })
                  .skip(startIndex)
                  .limit(limit)
                  .populate({
                        path: "user_id",
                        select: "first_name last_name pic",
                  })
                  .populate({
                        path: "category_id",
                        select: "category_name",
                  });

            if (!reels || reels.length === 0) {
                  return res.json({
                        message: "Koi Reel Posts Available Nahi Hai.",
                        status: true,
                        data: [],
                  });
            }

            const updatedReels = await Promise.all(
                  reels.map(async (reel) => {
                        let like_status = "No";
                        let subscribe_status = "No";
                        const likeCount = await getReelLikeCount(reel._id);

                        if (req.user) {
                              const isLiked = await ReelLike.exists({
                                    reel_id: reel._id,
                                    user_ids: req.user._id,
                              });

                              like_status = isLiked ? "Yes" : "No";

                              const issubscribe = await Subscribes.exists({
                                    my_id: reel.user_id._id,
                                    subscriber_id: req.user._id,
                              });

                              subscribe_status = issubscribe ? "Yes" : "No";
                        }
                        const thumbnail_name_url = await getSignedUrlS3(
                              reel.thumbnail_name
                        );
                        const video_name_url = await getSignedUrlS3(
                              reel.reel_name
                        );
                        const pic_name_url = await getSignedUrlS3(
                              reel.user_id.pic
                        );

                        return {
                              ...reel._doc,
                              user_id: {
                                    ...reel.user_id._doc,
                                    pic: pic_name_url,
                              },
                              like_count: likeCount,
                              like_status: like_status,
                              subscribe_status: subscribe_status,
                              reel_url: video_name_url,
                              thumbnail_name: thumbnail_name_url,
                        };
                  })
            );

            res.json({
                  message: "Reels fetched successfully.",
                  status: true,
                  data: updatedReels,
            });
      } catch (error) {
            console.error(error);
            res.status(500).json({
                  message: "Internal Server Error",
                  status: false,
            });
      }
});

const getReelThumbnails = asyncHandler(async (req, res) => {
      try {
            const limit = parseInt(req.params.limit, 10);
            const category_id = req.body.category_id;

            // Construct the query based on whether category_id is provided or not
            const query = category_id ? { category_id } : {};

            // Include the condition for deleted_at: null
            query.deleted_at = null;

            // Fetch thumbnails based on the limit and category_id (if provided)
            const thumbnails = await Reel.find(query)
                  .limit(limit)
                  .select("thumbnail_name title reel_name")
                  .exec();

            if (!thumbnails || thumbnails.length === 0) {
                  return res.status(404).json({
                        message: "No Reel Found.",
                        status: false,
                  });
            }

            // Construct full URLs for thumbnails
            const thumbnailData = await Promise.all(
                  thumbnails.map(async (thumbnail) => {
                        const thumbnail_name_url = await getSignedUrlS3(
                              thumbnail.thumbnail_name
                        );
                        const video_name_url = await getSignedUrlS3(
                              thumbnail.reel_name
                        );

                        return {
                              id: thumbnail._id,
                              title: thumbnail.title,
                              thumbnail_url: thumbnail_name_url,
                              reel_url: video_name_url,
                        };
                  })
            );

            res.status(200).json({
                  data: thumbnailData,
                  status: true,
            });
      } catch (error) {
            console.error("Error fetching thumbnails:", error);
            res.status(500).json({
                  message: "Internal Server Error.",
                  status: false,
            });
      }
});

const deleteReel = asyncHandler(async (req, res) => {
      try {
            // Extract user_id from headers
            const user_id = req.user._id;
            const { reel_id } = req.body;

            // Ensure reel_id is a valid ObjectId
            if (!mongoose.Types.ObjectId.isValid(reel_id)) {
                  return res.status(200).json({
                        message: "Invalid reel_id format.",
                        status: false,
                  });
            }

            const reelDetails = await Reel.findById(reel_id);

            if (!reelDetails) {
                  return res.status(403).json({
                        message: "Reels Id Not Found.",
                        status: false,
                  });
            }

            // Convert reel_id to ObjectId
            const objectIdReelId = mongoose.Types.ObjectId(reel_id);

            // Check if the user has the right to delete the reel
            const reel = await Reel.findOne({
                  _id: objectIdReelId,
                  user_id: user_id,
            });

            if (!reel) {
                  return res.status(403).json({
                        message: "You do not have permission to delete this reel.",
                        status: false,
                  });
            }

            // Get the reel details

            // Delete the reel document from the database
            await Reel.findByIdAndDelete(objectIdReelId);

            // Delete the reel file
            if (
                  reelDetails.thumbnail_name !=
                  "Reels_defult/reel_defult_thumbunil.jpg"
            ) {
                  const thumbnail_name_url = await DeleteSignedUrlS3(
                        reelDetails.thumbnail_name
                  );
                  const deleteThumbnailResponse = await fetch(
                        thumbnail_name_url,
                        {
                              method: "DELETE",
                        }
                  );
            }

            const reels_name_url = await DeleteSignedUrlS3(
                  reelDetails.reel_name
            );

            const deleteVideoResponse = await fetch(reels_name_url, {
                  method: "DELETE",
            });

            await AdminDashboard.updateOne({ $inc: { reels_count: -1 } });

            // Delete reel comments and likes (if you have models for them)
            await ReelComment.deleteMany({ reel_id: objectIdReelId });
            await ReelLike.deleteMany({ reel_id: objectIdReelId });

            res.status(200).json({
                  message: "Reel deleted successfully.",
                  status: true,
            });
      } catch (error) {
            console.error(error);
            res.status(500).json({
                  message: "Internal Server Error",
                  status: false,
            });
      }
});

const getReelsUploadUrlS3 = asyncHandler(async (req, res) => {
      const user_id = req.user._id;
      const randomFilenameReels = `Reels-${Math.random()
            .toString(36)
            .substring(2)}`;
      const randomFilenameThumbnail = `Thumbnail-${Math.random()
            .toString(36)
            .substring(2)}`;
      const videoget_url = await PutObjectReels(user_id, randomFilenameReels);
      const thumbnailget_url = await PutObjectReelsthumbnail(
            user_id,
            randomFilenameThumbnail
      );

      return res.status(200).json({
            message: { videoget_url, thumbnailget_url },
            status: true,
      });
});

const getAllReels = asyncHandler(async (req, res) => {
      const { page = 1, search = "" } = req.query; // Using req.query for query parameters
      const perPage = 10;

      const query = search
            ? {
                    description: { $regex: search, $options: "i" },
              }
            : {};

      try {
            const reels = await Reel.find({ query, deleted_at: null })
                  .skip((page - 1) * perPage)
                  .limit(perPage)
                  .populate({
                        path: "user_id",
                        select: "first_name last_name pic",
                  })
                  .populate({
                        path: "category_id",
                        select: "category_name",
                  });

            const totalCount = await Reel.countDocuments(query);
            const totalPages = Math.ceil(totalCount / perPage);

            const transformedReels = await Promise.all(
                  reels.map(async (reel) => {
                        let transformedReel = { ...reel.toObject() };
                        if (transformedReel.thumbnail_name) {
                              transformedReel.thumbnail_name =
                                    await getSignedUrlS3(reel.thumbnail_name);
                        }
                        return transformedReel;
                  })
            );

            const paginationDetails = {
                  current_page: parseInt(page),
                  data: transformedReels,
                  first_page_url: `${baseURL}api/reels?page=1`,
                  from: (page - 1) * perPage + 1,
                  last_page: totalPages,
                  last_page_url: `${baseURL}api/reels?page=${totalPages}`,
                  links: [
                        {
                              url: null,
                              label: "&laquo; Previous",
                              active: false,
                        },
                        {
                              url: `${baseURL}api/reels?page=${page}`,
                              label: page.toString(),
                              active: true,
                        },
                        {
                              url: null,
                              label: "Next &raquo;",
                              active: false,
                        },
                  ],
                  next_page_url: null,
                  path: `${baseURL}api/reels`,
                  per_page: perPage,
                  prev_page_url: null,
                  to: (page - 1) * perPage + transformedReels.length,
                  total: totalCount,
            };

            res.json({
                  Reels: paginationDetails,
                  page: page.toString(),
                  total_rows: totalCount,
            });
      } catch (error) {
            console.error(error);
            res.status(500).json({
                  message: "Internal Server Error",
                  status: false,
            });
      }
});

const statusUpdate = async (req, res) => {
      const { status } = req.body;
      const { id } = req.body;

      try {
            const reel = await Reel.findById(id);

            if (!reel) {
                  return res
                        .status(200)
                        .json({ message: "Project not found", status: false });
            }

            reel.status = status;
            await reel.save();

            return res.status(200).json({
                  message: "Status updated successfully",
                  status: true,
            });
      } catch (error) {
            console.error(error);
            return res
                  .status(500)
                  .json({ message: "Internal Server Error", status: false });
      }
};

const searchReels = asyncHandler(async (req, res) => {
      const { page = 1, title = "" } = req.body;
      const perPage = 100; // You can adjust this according to your requirements

      // Build the query based on title with case-insensitive search
      const query = {
            title: { $regex: title, $options: "i" },
      };

      try {
            const reels = await Reel.find({ ...query, deleted_at: null })
                  .select("_id title share_Id")
                  .skip((page - 1) * perPage)
                  .limit(perPage);

            const totalCount = await Reel.countDocuments(query);
            const totalPages = Math.ceil(totalCount / perPage);

            // Add the label "Reels List" to each item in the reels array
            let transformedReels = reels.map((reel) => ({
                  ...reel.toObject(),
                  label: "Quicky List",
            }));

            res.json({
                  data: transformedReels,
                  page: page.toString(),
                  total_rows: totalCount,
            });
      } catch (error) {
            console.error(error);
            res.status(500).json({
                  message: "Internal Server Error",
                  status: false,
            });
      }
});

const ReelsAdminStatus = asyncHandler(async (req, res) => {
      const reelsId = req.body.reelsId;
      try {
            // Find the reels by its _id
            const reels = await Reel.findById(reelsId);

            if (!reels) {
                  return res.status(404).json({ message: "Reels not found" });
            }

            // Check if deleted_at field is null or has a value
            if (reels.deleted_at === null) {
                  // If deleted_at is null, update it with new Date()
                  reels.deleted_at = new Date();
            } else {
                  // If deleted_at has a value, update it with null
                  reels.deleted_at = null;
            }

            // Save the updated reels
            await reels.save();

            return res.status(200).json({
                  message: "Reels soft delete status toggled successfully",
            });
      } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Internal Server Error" });
      }
});

const getReelThumbnailsHome = asyncHandler(async (category_id) => {
      try {
            const limit = parseInt(10);

            // Construct the query based on whether category_id is provided or not
            const query = category_id ? { category_id } : {};

            // Include the condition for deleted_at: null
            query.deleted_at = null;

            // Fetch thumbnails based on the limit and category_id (if provided)
            const thumbnails = await Reel.find(query)
                  .sort({ view_count: -1 })
                  .limit(limit)
                  .select("thumbnail_name title reel_name")
                  .exec();

            if (!thumbnails || thumbnails.length === 0) {
                  return {
                        data: [],
                        status: false,
                        message: "No Reel Found.",
                  };
            }

            // Construct full URLs for thumbnails
            const thumbnailData = await Promise.all(
                  thumbnails.map(async (thumbnail) => {
                        const thumbnail_name_url = await getSignedUrlS3(
                              thumbnail.thumbnail_name
                        );
                        const video_name_url = await getSignedUrlS3(
                              thumbnail.reel_name
                        );

                        return {
                              id: thumbnail._id,
                              title: thumbnail.title,
                              thumbnail_url: thumbnail_name_url,
                              reel_url: video_name_url,
                        };
                  })
            );

            return {
                  data: thumbnailData,
                  status: true,
                  message: "Thumbnails fetched successfully.",
            };
      } catch (error) {
            console.error("Error fetching thumbnails:", error);
            return {
                  data: [],
                  status: false,
                  message: "Internal Server Error.",
            };
      }
});

const ViewCountAdd = asyncHandler(async (req, res) => {
      const { Reels_Id } = req.body;
      const userId = req.user._id;

      try {
            // Find the video by its _id
            const reels = await Reel.findById(Reels_Id);

            // Check if the reel exists
            if (!reels) {
                  return res.status(404).json({ message: "Reels not found" });
            }

            // Check if user_id is already in view_user array
            if (!reels.view_user || !reels.view_user.includes(userId)) {
                  // Initialize view_user property if not already initialized
                  if (!reels.view_user) {
                        reels.view_user = [];
                  }

                  // Add the user_id to the view_user array
                  reels.view_user.push(userId);

                  // Increment the view_count
                  reels.view_count += 1;

                  // Save the updated video
                  await reels.save();

                  return res.status(200).json({
                        message: "Reels view count updated successfully",
                        view_count: reels.view_count,
                        status: true,
                  });
            } else {
                  return res.status(200).json({
                        message: "User has already viewed this Reels",
                        status: true,
                  });
            }
      } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Internal Server Error" });
      }
});

const ReelViewUserList = asyncHandler(async (req, res) => {
      const { ReelId, page = 1, limit = 10 } = req.body; // Default page is 1 and limit is 10

      try {
            // Query the database to retrieve details of users who viewed the specified video
            const video = await Reel.findById(ReelId).populate({
                  path: "view_user",
                  select: "first_name last_name email mobile username pic",
                  options: {
                        sort: { createdAt: -1 },
                        skip: (page - 1) * limit,
                        limit: limit,
                  }, // Sorting view_user entries by createdAt in descending order and applying pagination
            });

            if (!video) {
                  return res.status(404).json({ message: "Video not found" });
            }

            const videoReturn = video.view_user.reverse();

            // Format the response
            const users = await Promise.all(
                  videoReturn.map(async (user) => {
                        // Get signed URL for user's profile picture
                        const pic = await getSignedUrlS3(`${user.pic}`);

                        return {
                              user: {
                                    otp_verified: user.otp_verified,
                                    review: user.review,
                                    watch_time: user.watch_time,
                                    subscribe: user.subscribe,
                                    interest: user.interest,
                                    pic: pic, // Assign the signed URL to the pic field
                                    deleted: user.deleted,
                                    deleted_at: user.deleted_at,
                                    datetime: user.datetime,
                                    _id: user._id,
                                    first_name: user.first_name,
                                    last_name: user.last_name,
                                    email: user.email,
                                    mobile: user.mobile,
                                    username: user.username,
                                    password: user.password,
                                    otp: user.otp,
                                    dob: user.dob,
                                    __v: user.__v,
                              },
                        };
                  })
            );

            res.json({
                  Users: {
                        current_page: page,
                        data: users,
                        first_page_url: req.originalUrl,
                        from: (page - 1) * limit + 1,
                        last_page: Math.ceil(videoReturn.length / limit),
                        last_page_url: `${req.originalUrl}?page=${Math.ceil(
                              videoReturn.length / limit
                        )}`,
                        links: [],
                        next_page_url:
                              page < Math.ceil(videoReturn.length / limit)
                                    ? `${req.originalUrl}?page=${page + 1}`
                                    : null,
                        path: req.baseUrl,
                        per_page: limit,
                        prev_page_url:
                              page > 1
                                    ? `${req.originalUrl}?page=${page - 1}`
                                    : null,
                        to: Math.min(page * limit, videoReturn.length),
                        total: videoReturn.length,
                  },
                  page: page.toString(),
                  total_rows: videoReturn.length,
            });
      } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal Server Error" });
      }
});

module.exports = {
      uploadReel,
      getPaginatedReel,
      streamReel,
      updateReelLike,
      addReelComment,
      updateReelViewCount,
      getReelComments,
      deleteReel,
      getReelThumbnails,
      getMyReels,
      getUserReels,
      getReelsUploadUrlS3,
      getAllReels,
      statusUpdate,
      getReel_ByCategory,
      getMyReelsWebsite,
      getMyReel_ByCategory,
      getUserReelsWebsite,
      searchReels,
      getPaginatedReelsAdmin,
      ReelsAdminStatus,
      getPaginatedReelWebsite,
      getReelThumbnailsHome,
      ViewCountAdd,
      ReelViewUserList,
      getPaginatedReelWebsiteFillter,
};
