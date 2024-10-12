const express = require("express");
const {
  registerUser,
  authUser,
  getUsers,
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
  getAllSupplier,
  getOrderNotifications,
  getProfileData
} = require("../controllers/userControllers.js");

const protect = require("../middleware/authMiddleware.js");
const commonProtect = require("../middleware/comman_authMiddleware.js");
const Authorization = require("../middleware/Authorization.middleware.js");
const userRoutes = express.Router();

/*------------- Student/Teacher Both apis --------------------- */
userRoutes.route("/register").post(registerUser);
userRoutes.route("/login").post(authUser);
userRoutes.route("/verifyOtp").post(verifyOtp);
userRoutes.route("/resendOTP").post(resendOTP);
userRoutes.route("/ForgetresendOTP").post(ForgetresendOTP);
userRoutes.route("/forgetPassword").put(forgetPassword);
userRoutes.route("/ChangePassword").put(protect, ChangePassword);
userRoutes.route("/logoutUser").get(protect, logoutUser);
userRoutes.route("/getAllSupplier").get(protect, getAllSupplier);

/*------------- User/Admin Both apis --------------------- */

userRoutes.route("/updateCostomerProfileData").post(protect, Authorization(["user","both"]), updateCostomerProfileData);
userRoutes.route("/getOrderNotifications").get(protect, getOrderNotifications);
userRoutes.route("/getAllUsers").get(protect, Authorization(["student", "admin"]), getAllUsers);
userRoutes.route("/getAllDashboardCount").get(protect, Authorization(["admin"]), getAllDashboardCount);

/*------------- Auth Routes --------------------- */

userRoutes.route("/").get(protect, getUsers);
userRoutes.route("/getProfileData").get(protect, getProfileData);
userRoutes.route("/updateUserProfile").put(protect, updateProfileData);
userRoutes.route("/searchUsers").post(protect, searchUsers);
userRoutes.route("/UpdateMobileAdmin").post(protect, UpdateMobileAdmin);
userRoutes.route("/profilePicUpload").put(protect, profilePicUpload);
userRoutes.route("/UserAdminStatus").post(protect, UserAdminStatus);
module.exports = { userRoutes };
