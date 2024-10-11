const express = require("express");
const protect = require("../middleware/authMiddleware.js");
const Authorization = require("../middleware/Authorization.middleware.js");
const { createService, getAllServices, getServiceById } = require("../controllers/serviceControllers.js");

const serviceRoutes = express.Router();

// Apply protect and Authorization middleware to updateTeacherProfile route
serviceRoutes.post("/createService", protect, Authorization(["admin"]), createService);

serviceRoutes.get("/getAllServices", protect, Authorization(["user"]), getAllServices);

serviceRoutes.get("/getServiceById/:id", protect, Authorization(["user"]), getServiceById);

// Correctly export the serviceRoutes router
module.exports = serviceRoutes;
