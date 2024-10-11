// routes/notificationRoutes.js
const express = require("express");
const { getUserNotifications } = require("../controllers/orderNotificationController.js");
const protect = require("../middleware/authMiddleware.js");

const orderNotificationsRoutes = express.Router();

// GET notifications for a user
orderNotificationsRoutes.route("/getUserNotifications").get(protect, getUserNotifications);

module.exports = { orderNotificationsRoutes };
