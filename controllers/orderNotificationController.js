const OrderNotification = require("../models/orderNotificationModel.js");
const asyncHandler = require("express-async-handler");
const { User } = require("../models/userModel.js");
const admin = require("firebase-admin"); // Import firebase-admin
const sendFCMNotification = async (registrationToken, title, body) => {
  const message = {
    notification: {
      title,
      body,
    },
    token: registrationToken,
  };

  try {
    const response = await admin.messaging().send(message);
    return { success: true, response };
  } catch (error) {
    return { success: false, error };
  }
};

// Function to add a new notification
const addNotification = async (userId, service_id, message,title, totalamount) => {
      try {
        const newNotification = new OrderNotification({
          user_id: userId,
          service_id: service_id,
          title: title,
          message: message,
          totalamount: totalamount,
        });

        await newNotification.save();
      } catch (error) {
        console.error("Error saving notification:", error.message);
        throw error;
      }
};


const getUserNotifications = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
  const perPage = 10; // Number of notifications per page

  try {
    const count = await OrderNotification.countDocuments({ user_id: req.headers.userID });

    const notifications = await OrderNotification.find({ user_id: req.headers.userID })
      .sort({ created_at: -1 }) // Sort by descending order of creation date
      .populate("user_id", "first_name last_name profile_pic") // Populate user details from User collection
      .skip((page - 1) * perPage)
      .limit(perPage)
      .exec();

    const totalPages = Math.ceil(count / perPage);

    res.status(200).json({
      notifications,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



module.exports = {
  addNotification,
  getUserNotifications,

};
