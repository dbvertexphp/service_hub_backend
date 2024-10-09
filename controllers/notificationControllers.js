const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");
const { NotificationMessages, WebNotification, User } = require("../models/userModel.js");
const { AdminNotificationMessages } = require("../models/adminnotificationsmodel.js");
const asyncHandler = require("express-async-handler");
const moment = require("moment-timezone");
const baseURL = process.env.BASE_URL;
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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

const createNotification = async (sender_id, receiver_id, message, type, data = null) => {
  try {
    // Find the receiver's FCM token from the websiteNotificationTokens table
    const websiteToken = await WebNotification.findOne({
      user_id: receiver_id,
    });

    if (!websiteToken) {
      console.error("Receiver's FCM token not found");
      return; // Exit if FCM token not found
    }

    // Get receiver's information from the user table
    const receiverUser = await User.findById(receiver_id);

    if (!receiverUser) {
      console.error("Receiver not found in the user table");
      return; // Exit if receiver not found
    }

    const receiverName = `${receiverUser.first_name} ${receiverUser.last_name}`;

    // Get sender's information from the user table
    const senderUser = await User.findById(sender_id);

    if (!senderUser) {
      console.error("Sender not found in the user table");
      return; // Exit if sender not found
    }

    const senderName = `${senderUser.first_name} ${senderUser.last_name}`;

    // Construct title, body, and imageUrl
    const title = receiverName;
    const body = `${senderName} ${message}`;
    const imageUrl = `${senderUser.pic || "default-image.jpg"}`;

    const currentTime = moment().tz("Asia/Kolkata");
    const datetime = currentTime.format("DD-MM-YYYY HH:mm:ss");
    let url;
    if (type == "Friend_Request" || type == "Request_Accept") {
      url = baseURL + "website-friend-list";
    } else if (type == "Payment" || type == "Completed" || type == "Review") {
      url = baseURL + "website-hire-list";
    } else if (type == "Applied_Job") {
      url = baseURL + "website-my-job-list";
    }

    await sendFCMNotification(websiteToken.token, title, body, imageUrl, url);

    // Optionally, save the notification to the database
    const newNotification = await NotificationMessages.create({
      sender_id,
      receiver_id,
      message,
      type,
      datetime,
      metadata: data,
    });

    //console.log("Notification sent and saved:", newNotification);
  } catch (error) {
    console.error("Error creating notification:", error.message);
  }
};

const createNotificationAdmin = async (sender_id, receiver_id, message, type, data = null) => {
  try {
    // Find the receiver's FCM token from the websiteNotificationTokens table
    const websiteToken = await WebNotification.findOne({
      user_id: receiver_id,
    });

    if (!websiteToken) {
      console.error("Receiver's FCM token not found");
      return; // Exit if FCM token not found
    }

    // Get receiver's information from the user table
    const receiverUser = await User.findById(receiver_id);

    if (!receiverUser) {
      console.error("Receiver not found in the user table");
      return; // Exit if receiver not found
    }

    const receiverName = `${receiverUser.first_name} ${receiverUser.last_name}`;

    // Get sender's information from the user table
    const senderUser = await User.findById(sender_id);

    if (!senderUser) {
      console.error("Sender not found in the user table");
      return; // Exit if sender not found
    }

    const senderName = `${senderUser.first_name} ${senderUser.last_name}`;

    // Construct title, body, and imageUrl
    const title = receiverName;
    const body = `${message}`;
    const imageUrl = `${senderUser.pic || "default-image.jpg"}`;

    const currentTime = moment().tz("Asia/Kolkata");
    const datetime = currentTime.format("DD-MM-YYYY HH:mm:ss");

    await sendFCMNotification(websiteToken.token, title, body, imageUrl);

    // Optionally, save the notification to the database
    const newNotification = await AdminNotificationMessages.create({
      sender_id,
      receiver_id,
      message,
      type,
      datetime,
      metadata: data,
    });

    //console.log("Notification sent and saved:", newNotification);
  } catch (error) {
    console.error("Error creating notification:", error.message);
  }
};

const chatNotification = async (sender_id, receiver_id, message, type, data = null) => {
  try {
    // Find the receiver's FCM token from the websiteNotificationTokens table
    const websiteToken = await WebNotification.findOne({
      user_id: receiver_id,
    });

    if (!websiteToken) {
      console.error("Receiver's FCM token not found");
      return; // Exit if FCM token not found
    }

    // Get receiver's information from the user table
    const receiverUser = await User.findById(receiver_id);

    if (!receiverUser) {
      console.error("Receiver not found in the user table");
      return; // Exit if receiver not found
    }

    const receiverName = `${receiverUser.first_name} ${receiverUser.last_name}`;

    // Get sender's information from the user table
    const senderUser = await User.findById(sender_id);

    if (!senderUser) {
      console.error("Sender not found in the user table");
      return; // Exit if sender not found
    }

    const senderName = `${senderUser.first_name} ${senderUser.last_name}`;

    // Construct title, body, and imageUrl
    const title = "chat";
    const body = `${senderName} ${message}`;
    const imageUrl = `${senderUser.pic || "default-image.jpg"}`;

    const currentTime = moment().tz("Asia/Kolkata");
    const datetime = currentTime.format("DD-MM-YYYY HH:mm:ss");
    let url;
    if (type == "Friend_Request" || type == "Request_Accept") {
      url = baseURL + "website-friend-list";
    } else if (type == "Payment" || type == "Completed" || type == "Review") {
      url = baseURL + "website-hire-list";
    } else if (type == "Applied_Job") {
      url = baseURL + "website-my-job-list";
    } else if (type == "chat") {
      url = baseURL + "website-chat";
    }

    await sendFCMNotification(websiteToken.token, title, body, imageUrl, url);
    // Optionally, save the notification to the database

    //console.log("Notification sent and saved:", newNotification);
  } catch (error) {
    console.error("Error creating notification:", error.message);
  }
};

module.exports = {
  createNotification,
  createNotificationAdmin,
  chatNotification,
  sendFCMNotification,
};
