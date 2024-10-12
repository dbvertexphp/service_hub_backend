const asyncHandler = require("express-async-handler");
const cookie = require("cookie");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const { generateToken, blacklistToken } = require("../config/generateToken.js");
const { User, NotificationMessages, AdminDashboard, WebNotification } = require("../models/userModel.js");
const Category = require("../models/categoryModel.js");
const Review = require("../models/reviewModel.js");
const BankDetails = require("../models/bankdetailsModel.js");
const Transaction = require("../models/transactionModel");
const { AdminNotificationMessages } = require("../models/adminnotificationsmodel.js");
const MyFriends = require("../models/myfrindsModel.js");
const { Hire, HireStatus } = require("../models/hireModel.js");
require("dotenv").config();
const baseURL = process.env.BASE_URL;
const { createNotification } = require("./notificationControllers.js");
const { PutObjectProfilePic, getSignedUrlS3, DeleteSignedUrlS3 } = require("../config/aws-s3.js");
const dayjs = require("dayjs");
const { createConnectyCubeUser } = require("../utils/connectyCubeUtils.js");
const ErrorHandler = require("../utils/errorHandler.js");
const http = require("https");
const jwt = require("jsonwebtoken");
const upload = require("../middleware/uploadMiddleware.js");
const Product = require("../models/productModel.js");
const Cart = require("../models/cartModel.js");
const Order = require("../models/orderModel.js");
const TeacherPayment = require("../models/TeacherPaymentModel.js");
const OrderNotification = require("../models/orderNotificationModel.js");
const Favorite = require("../models/favorite.js");
const Rating = require("../models/ratingModel.js");
const fs = require("fs");
const { addNotification } = require("./orderNotificationController");
const { sendFCMNotification } = require("./notificationControllers");

const getUsers = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(200).json({
        message: "User Not Found",
        status: false,
      });
    }

    // Convert dob to desired format using dayjs
    const formattedDOB = dayjs(user.dob).format("YYYY-MM-DD");

    const updatedUser = {
      ...user._doc,
      pic: user.pic,
      watch_time: convertSecondsToReadableTime(user.watch_time),
      dob: formattedDOB, // Update dob with formatted date
    };

    res.json({
      user: updatedUser,
      status: true,
    });
  } catch (error) {
    console.error("GetUsers API error:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

function sendOTP(name, mobile, otp) {
  console.log(name);
  console.log(mobile);

  const options = {
    method: "POST",
    hostname: "control.msg91.com",
    port: null,
    path: `/api/v5/otp?template_id=${process.env.TEMPLATE_ID}&mobile=91${mobile}&authkey=${process.env.MSG91_API_KEY}&realTimeResponse=1`,
    headers: {
      "Content-Type": "application/json",
    },
  };

  const req = http.request(options, function (res) {
    const chunks = [];

    res.on("data", function (chunk) {
      chunks.push(chunk);
    });

    res.on("end", function () {
      const body = Buffer.concat(chunks);
      console.log(body.toString());
    });
  });

  const payload = JSON.stringify({
    name: name,
    OTP: otp,
  });

  req.write(payload);
  req.end();
}

const registerUser = asyncHandler(async (req, res, next) => {
      req.uploadPath = "uploads/profiles";

      // Handle file upload
      upload.single("profile_pic")(req, res, async (err) => {
        if (err) {
          return next(new ErrorHandler(err.message, 400));
        }

        const {
          first_name,
          last_name,
          mobile,
          email, // Add email to the destructured fields
          password,
          confirm_password,
          role,
          firebase_token,
          Address
        } = req.body;

        // Validate required fields
        if (!first_name || !last_name || !mobile || !email || !password || !confirm_password || !role) {
          return next(new ErrorHandler("Please enter all the required fields.", 400));
        }

        // Check if passwords match
        if (password !== confirm_password) {
          return next(new ErrorHandler("Passwords do not match.", 400));
        }

        // Check if mobile already exists
        const mobileExists = await User.findOne({ mobile });
        if (mobileExists) {
          return next(new ErrorHandler("User with this mobile number already exists.", 400));
        }

        // Check if email already exists
        const emailExists = await User.findOne({ email });
        if (emailExists) {
          return next(new ErrorHandler("User with this email already exists.", 400));
        }

        // Generate a 4-digit random OTP
        const otp = generateOTP();

        // Get the profile picture path if uploaded
        const profile_pic = req.file ? `${req.uploadPath}/${req.file.filename}` : null;

        // Create the user
        const user = await User.create({
          first_name,
          last_name,
          mobile,
          email, // Add email field
          role,
          password,
          otp, // Add the OTP field
          firebase_token,
          Address,
          profile_pic, // Add profile_pic field
        });

        if (user) {
          // Optionally send OTP to user's mobile
          // sendOTP(first_name, mobile, otp);

          try {
            // Update Admin Dashboard user count
            const adminDashboard = await AdminDashboard.findOne();
            if (adminDashboard) {
              adminDashboard.user_count++;
              await adminDashboard.save();
            } else {
              console.error("AdminDashboard not found");
            }
          } catch (error) {
            console.error("Failed to update admin dashboard:", error);
          }

          // Respond with user details and token
          res.status(201).json({
            _id: user._id,
            first_name: user.first_name,
            last_name: user.last_name,
            mobile: user.mobile,
            email: user.email, // Include email in the response
            role: user.role,
            otp_verified: user.otp_verified,
            otp: user.otp, // Send OTP in response for testing
            firebase_token,
            Address: user.Address,
            profile_pic: user.profile_pic, // Include profile_pic in response
            token: generateToken(user._id), // JWT token generation
            status: true,
          });
        } else {
          return next(new ErrorHandler("User registration failed.", 400));
        }
      });
});

const authUser = asyncHandler(async (req, res) => {
  const { mobile, password, firebase_token } = req.body; // Include firebase_token from request body
  const userdata = await User.findOne({ mobile });

  if (!userdata) {
    throw new ErrorHandler("User Not Found.", 400);
  }

  const isPasswordMatch = await userdata.matchPassword(password);

  if (!isPasswordMatch) {
    throw new ErrorHandler("Invalid Password", 400);
  }

  if (userdata.otp_verified === 0) {
    const otp = generateOTP();
    // sendOTP(userdata.full_name, mobile, otp);
    await User.updateOne({ _id: userdata._id }, { $set: { otp } });
    // throw new ErrorHandler("OTP Not verified", 400);
    res.status(400).json({
      otp,
      message: "OTP Not verified",
      status: false,
    });
  }

  // Save firebase_token if provided
  if (firebase_token) {
    userdata.firebase_token = firebase_token;
    await userdata.save();
  }

  if (isPasswordMatch) {
    if (!process.env.JWT_SECRET) {
      throw new ErrorHandler("JWT_SECRET is not defined in environment variables", 500);
    }

    const token = jwt.sign({ _id: userdata._id, role: userdata.role }, process.env.JWT_SECRET);

    // Set the token in a cookie for 30 days
    res.setHeader(
      "Set-Cookie",
      cookie.serialize("Websitetoken", token, {
        httpOnly: true,
        expires: new Date(Date.now() + 60 * 60 * 24 * 30 * 1000), // 30 days
        path: "/",
      })
    );

    const user = {
      ...userdata.toObject(),
      profile_pic: userdata.profile_pic, // No base URL added here
    };

    res.json({
      user,
      token,
      status: true,
    });
  } else {
    throw new ErrorHandler("Invalid Password", 400);
  }
});

const logoutUser = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1]; // Extract token from "Bearer {token}"

    blacklistToken(token);

    // Expire the cookie immediately
    res.setHeader(
      "Set-Cookie",
      cookie.serialize("Websitetoken", "", {
        httpOnly: false,
        expires: new Date(0),
        path: "/",
      })
    );

    res.json({ message: "Logout successful", status: true });
  } else {
    res.status(200).json({ message: "Invalid token", status: false });
  }
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;

  try {
    const user = await User.findOne({ mobile });

    if (!user) {
      throw new ErrorHandler("User Not Found. ", 400);
    }

    if (user.otp_verified) {
      throw new ErrorHandler("User is already OTP verified.", 400);
    }

    // Check if the provided OTP matches the OTP in the user document
    if (user.otp !== otp) {
      throw new ErrorHandler("Invalid OTP.", 400);
    }

    // Update the user's otp_verified field to 1 (OTP verified)
    const result = await User.updateOne(
      { _id: user._id },
      {
        $set: {
          otp_verified: 1,
        },
      }
    );

    if (result.nModified > 0) {
      console.log("OTP verification status updated successfully.");
    } else {
      console.log("No matching user found or OTP verification status already set.");
    }

    // Retrieve the updated user document
    const updatedUser = await User.findById(user._id);

    const authToken = jwt.sign({ _id: updatedUser._id, role: updatedUser.role }, process.env.JWT_SECRET);

    res.json({
      user: updatedUser,
      token: authToken,
      status: true,
    });
  } catch (error) {
    throw new ErrorHandler(error.message, 500);
  }
});

const resendOTP = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  // Generate a new OTP
  const newOTP = generateOTP();

  // Find the user by mobile number
  const user = await User.findOne({ mobile });

  //   const type = "Resend";
  // sendOTP(user.first_name, mobile, newOTP);
  if (!user) {
    throw new ErrorHandler("User Not Found. ", 400);
  }

  // Update the user's otp field with the new OTP
  const result = await User.updateOne({ _id: user._id }, { $set: { otp: newOTP } });

  // Send the new OTP to the user (you can implement this logic)

  res.json({
    message: "New OTP sent successfully.",
    newOTP,
    status: true,
  });
});

const ForgetresendOTP = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  const userdata = await User.findOne({ mobile: mobile });

  if (!userdata) {
    throw new ErrorHandler("Mobile Number Not Found", 400);
  }
  // Generate a new OTP
  const newOTP = generateOTP();

  // Find the user by mobile number
  const user = await User.findOne({ mobile });

//   sendOTP(user.first_name, mobile, newOTP);
  if (!user) {
    res.status(200).json({
      message: "User Not Found.",
      status: false,
    });
    return;
  }

  const result = await User.updateOne({ _id: user._id }, { $set: { otp: newOTP } });

  // Send the new OTP to the user (you can implement this logic)

  res.status(200).json({
    message: "New OTP sent successfully.",
    otp: newOTP,
    status: true,
  });
});

const profilePicUpload = asyncHandler(async (req, res) => {
  upload.single("profilePic")(req, res, async (err) => {
    if (err) {
      // Handle file upload error
      throw new ErrorHandler("File upload error", 400);
    }
    const userId = req.user._id; // Assuming you have user authentication middleware
    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ErrorHandler("User not found", 400);
    }
    //     const pic_name_url = await getSignedUrlS3(user.pic);
    // Update the user's profile picture (if uploaded)
    if (req.file) {
      const uploadedFileName = req.file.filename;
      user.pic = "uploads/profiles/" + uploadedFileName;
      await user.save();
      return res.status(200).json({
        message: "Profile picture uploaded successfully",
        pic: user.pic,
        status: true,
      });
    }
    throw new ErrorHandler("No file uploaded", 400);
  });
});

const updateProfileData = asyncHandler(async (req, res) => {
      const { first_name, last_name, email, mobile, Address } = req.body;

      const user_id = req.headers.userID; // Assuming you have user authentication middleware

      try {
        // Update the user's profile fields if they are provided in the request
        const updatedUser = await User.findByIdAndUpdate(
            user_id,
          {
            $set: {
              last_name: last_name,
              first_name: first_name,
              Address: Address,
              email: email, // Add email field
              mobile: mobile, // Add mobile field
            },
          },
          { new: true }
        ); // Option to return the updated document

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({
          _id: updatedUser._id,
          last_name: updatedUser.last_name,
          first_name: updatedUser.first_name,
          Address: updatedUser.Address,
          email: updatedUser.email, // Return updated email
          mobile: updatedUser.mobile, // Return updated mobile
          status: true,
        });
      } catch (error) {
        console.error("Error updating user profile:", error.message);
        return res.status(500).json({ error: "Internal Server Error" });
      }
});

const getProfileData = asyncHandler(async (req, res) => {
      const user_id = req.headers.userID; // Assuming you have user authentication middleware

      try {
        // Find the user by ID
        const user = await User.findById(user_id);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Return the user's profile information
        return res.status(200).json({
          user: user,
          status: true,
        });
      } catch (error) {
        console.error("Error fetching user profile:", error.message);
        return res.status(500).json({ error: "Internal Server Error" });
      }
});

const forgetPassword = asyncHandler(async (req, res) => {
      const { newPassword, confirm_password, mobile, otp } = req.body;

      // Check if all fields are present
      if (!newPassword || !confirm_password || !mobile || !otp) {
        res.status(200).json({
          message: "Please enter all the required fields.",
          status: false,
        });
        return;
      }

      // Check if new password and confirm password match
      if (newPassword !== confirm_password) {
        res.status(200).json({
          message: "Password and Confirm Password do not match.",
          status: false,
        });
        return;
      }

      // Find the user by mobile
      const user = await User.findOne({ mobile });

      if (!user) {
        res.status(200).json({
          message: "User not found.",
          status: false,
        });
        return;
      }

      // Validate OTP
      if (user.otp !== otp) {
        res.status(200).json({
          message: "Invalid OTP.",
          status: false,
        });
        return;
      }

      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update the user's password
      const result = await User.updateOne(
        { _id: user._id },
        { $set: { password: hashedPassword } }
      );

      if (result.nModified === 1) {
        // Fetch the updated user
        const updatedUser = await User.findById(user._id);

        res.status(200).json({
          message: "Password reset successfully.",
          updatedUser,
          status: true,
        });
      } else {
        res.status(500).json({
          message: "Password reset failed.",
          status: false,
        });
      }
});

const ChangePassword = asyncHandler(async (req, res, next) => {
  const userId = req.headers.userID; // Assuming you have user authentication middleware
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword || !userId) {
    return next(new ErrorHandler("Please enter all the required fields.", 400));
  }

  if (newPassword !== confirmPassword) {
    return next(new ErrorHandler("New password and confirm password do not match.", 400));
  }

  // Find the user by _id
  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorHandler("User Not Found.", 404));
  }

  // Check if the old password is correct
  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    return next(new ErrorHandler("Old password is incorrect.", 400));
  }

  // Hash the new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Update the password in MongoDB
  try {
    const result = await User.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });

    // Fetch the updated user
    const updatedUser = await User.findById(user._id);

    res.status(200).json({
      message: "Password changed successfully.",
      updatedUser,
      status: true,
    });
  } catch (error) {
    return next(new ErrorHandler("Failed to update password in MongoDB.", 500));
  }
});

const getAllSupplier = asyncHandler(async (req, res) => {
  try {
    const supplier = await User.find({ role: "supplier" }).select("full_name _id");

    if (!supplier) {
      return res.status(200).json({
        message: "Supplier Not Found",
        status: false,
      });
    }

    res.json({
      Supplier: supplier,
      status: true,
    });
  } catch (error) {
    console.error("Get Supplier API error:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

// Controller function to search products
const searchProducts = asyncHandler(async (req, res) => {
  const { q } = req.body; // Query parameter for search terms
  const userID = req.headers.userID;

  try {
    // Validate search query
    if (!q) {
      return res.status(400).json({ message: "Search query is required", status: false });
    }

    if (!userID) {
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Create a regex pattern for case-insensitive search
    const regex = new RegExp(q, "i");

    // Fetch products matching the search query
    const products = await Product.find({
      $or: [{ english_name: regex }, { local_name: regex }, { other_name: regex }],
      active: true,
    }).populate("category_id", "_id category_name");

    // Check if products are found
    if (!products.length) {
      return res.status(404).json({ message: "No products found matching the search query", status: false });
    }

    // For each product, check if it is favorited by the user
    const productsWithFavoriteStatus = await Promise.all(
      products.map(async (product) => {
        const isFavorite = await Favorite.findOne({
          user_id: userID,
          product_id: product._id,
        });

        return {
          ...product.toObject(),
          isFavorite: !!isFavorite, // true if the product is favorited, false otherwise
        };
      })
    );

    // Return the products with favorite status
    res.status(200).json({
      status: true,
      products: productsWithFavoriteStatus,
    });
  } catch (error) {
    console.error("Error searching products:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getOrderNotifications = asyncHandler(async (req, res) => {
  const userID = req.headers.userID;

  try {
    // Validate userID
    if (!userID) {
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Fetch notifications for the user
    const notifications = await OrderNotification.find({ user_id: userID }).sort({ created_at: -1 });

    if (!notifications || notifications.length === 0) {
      return res.status(404).json({ message: "No notifications found", status: false });
    }

    // Mark all unread notifications as read for the supplier
    await OrderNotification.updateMany({ user_id: userID, userstatus: "unread" }, { $set: { userstatus: "read" } });

    res.status(200).json({
      status: true,
      message: "Notifications retrieved successfully",
      notifications,
    });
  } catch (error) {
    console.error("Error retrieving notifications:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});


const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(search, "i");

    const users = await User.find({
      role: "user",
      $or: [
        { name: searchRegex }, // Assuming you want to search by name
        { email: searchRegex }, // Assuming you want to search by email
        // Add other fields as needed
      ],
    })
      .skip(skip)
      .limit(Number(limit));
    const totalUsers = await User.countDocuments({ role: "user" });

    const transformedUsersPromises = users.map(async (user) => {
      let transformedUser = { ...user.toObject() };
      if (transformedUser.pic) {
        const getSignedUrl_pic = await getSignedUrlS3(transformedUser.pic);
        transformedUser.pic = getSignedUrl_pic;
      }
      if (transformedUser.watch_time) {
        transformedUser.watch_time = convertSecondsToReadableTimeAdmin(transformedUser.watch_time);
      }
      return { user: transformedUser };
    });

    const transformedUsers = await Promise.all(transformedUsersPromises);

    res.json({
      Users: transformedUsers,
      total_rows: totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const getAllSuppliersInAdmin = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get the search keyword from query params
    const searchKeyword = req.query.search || "";

    // Construct the query to search by full_name and filter by role 'supplier'
    const query = {
      role: "supplier",
      full_name: { $regex: searchKeyword, $options: "i" }, // Case-insensitive search
    };

    // Fetch suppliers based on the query, skip, and limit
    const suppliers = await User.find(query).skip(skip).limit(limit);

    // Get the total number of suppliers that match the query
    const totalSuppliers = await User.countDocuments(query);

    // Return the results along with pagination details
    res.json({
      Suppliers: suppliers,
      total_rows: totalSuppliers,
      current_page: page,
      total_pages: Math.ceil(totalSuppliers / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const searchUsers = asyncHandler(async (req, res) => {
  const { page = 1, name = "" } = req.body;
  const perPage = 100; // Adjust according to your requirements
  try {
    let query = {
      $or: [{ full_name: { $regex: name, $options: "i" } }, { username: { $regex: name, $options: "i" } }],
    };

    // If name contains a space, search for the last name as well

    // Exclude the current user if req.user._id is available
    if (req.user && req.user._id) {
      query._id = { $ne: req.user._id };
    }

    const users = await User.find(query)
      .select("_id first_name last_name username")
      .skip((page - 1) * perPage)
      .limit(perPage);

    let transformedUsers = users.map((user) => ({
      _id: user._id,
      title: `${user.first_name} ${user.last_name}`,
      label: "User List",
    }));

    const totalCount = await User.countDocuments(query);
    const totalPages = Math.ceil(totalCount / perPage);

    res.json({
      data: transformedUsers,
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

const getAllDashboardCount = asyncHandler(async (req, res) => {
  try {
    const teacherCount = await User.countDocuments({ role: "supplier" });
    const studentCount = await User.countDocuments({ role: "user" });
    const courseCount = await Product.countDocuments();
    const adminnotifications = await AdminNotificationMessages.countDocuments({
      readstatus: false,
    }); // Counting only documents with readstatus false
    const transactionAmountSum = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" }, // Summing the "amount" field
        },
      },
    ]);

    // Extracting the total sum of the "amount" field
    const transactionTotalAmount = transactionAmountSum.length > 0 ? transactionAmountSum[0].totalAmount : 0;

    res.status(200).json({
      teacherCount: teacherCount,
      studentCount: studentCount,
      courseCount: courseCount,
      adminnotifications: adminnotifications,
      transactionTotalAmount: transactionTotalAmount,
    });
  } catch (error) {
    console.error("Error getting dashboard counts:", error);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const UserAdminStatus = asyncHandler(async (req, res) => {
  const userId = req.body.userId;
  try {
    // Find the video by its _id
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Check if deleted_at field is null or has a value
    if (user.deleted_at === null) {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            deleted_at: new Date(),
          },
        },
        { new: true }
      );
    } else {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            deleted_at: null,
          },
        },
        { new: true }
      );
    }
    return res.status(200).json({
      message: "User soft delete status toggled successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

function convertSecondsToReadableTimeAdmin(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds * 1000) % 1000);

  // Format the time string
  const timeString = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(milliseconds).padStart(2, "3")}`;
  return timeString;
}

function convertSecondsToReadableTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours} hr`;
  } else if (hours > 0) {
    return `${hours} hr`;
  } else if (minutes > 0) {
    return `${minutes} min`;
  } else {
    return 0;
  }
}

function generateOTP() {
  const min = 1000; // Minimum 4-digit number
  const max = 9999; // Maximum 4-digit number

  // Generate a random number between min and max (inclusive)
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;

  return otp.toString(); // Convert the number to a string
}

const UpdateMobileAdmin = asyncHandler(async (req, res) => {
  const { UserId, mobile } = req.body;
  const _id = UserId;
  // Find the user by mobile number
  const user = await User.findOne({ _id });
  const usermobile = await User.findOne({ mobile });

  if (usermobile) {
    res.status(200).json({
      message: "Mobile number already exit.",
      status: true,
    });
    return;
  }
  // Update the user's otp field with the new OTP
  const result = await User.updateOne({ _id: user._id }, { $set: { mobile: mobile } });

  // Send the new OTP to the user (you can implement this logic)

  res.json({
    message: "Mobile number successfully.",
    status: true,
  });
});

const updateCostomerProfileData = asyncHandler(async (req, res) => {
  req.uploadPath = "uploads/profiles";
  upload.single("profile_pic")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { full_name, email, mobile, address } = req.body;
    const userId = req.headers.userID; // Assuming you have user authentication middleware

    // Get the profile picture path if uploaded
    const profile_pic = req.file ? `${req.uploadPath}/${req.file.filename}` : null;

    try {
      // Find the current user to get the old profile picture path
      const currentUser = await User.findById(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Build the update object
      let updateFields = {
        datetime: moment().tz("Asia/Kolkata").format("YYYY-MMM-DD hh:mm:ss A"),
      };

      // Update first_name and last_name if provided
      if (full_name) {
        updateFields.full_name = full_name;
      }

      if (email) {
        updateFields.email = email;
      }

      if (mobile) {
        updateFields.mobile = mobile;
      }

      if (address) {
        updateFields.address = address;
      }

      // Check if there is a new profile pic uploaded and delete the old one
      if (profile_pic && currentUser.profile_pic) {
        const oldProfilePicPath = currentUser.profile_pic;
        updateFields.profile_pic = profile_pic;

        // Delete the old profile picture
        deleteFile(oldProfilePicPath);
      } else if (profile_pic) {
        updateFields.profile_pic = profile_pic;
      }

      // Update the user's profile fields
      const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateFields }, { new: true });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json({
        _id: updatedUser._id,
        full_name: updatedUser.full_name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        address: updatedUser.address,
        profile_pic: updatedUser.profile_pic,
        status: true,
      });
    } catch (error) {
      console.error("Error updating user profile:", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
});

// Function to delete a file from the filesystem
function deleteFile(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error("Error deleting file:", err);
    } else {
      console.log(`Deleted file: ${filePath}`);
    }
  });
}

module.exports = {
  getUsers,
  registerUser,
  authUser,
  verifyOtp,
  resendOTP,
  updateProfileData,
  forgetPassword,
  ChangePassword,
  profilePicUpload,
  logoutUser,
  getAllUsers,
  getAllDashboardCount,
  ForgetresendOTP,
  searchUsers,
  UserAdminStatus,
  UpdateMobileAdmin,
  updateCostomerProfileData,
  getAllSuppliersInAdmin,
  searchProducts,
  getAllSupplier,
  getOrderNotifications,
  getProfileData
};
