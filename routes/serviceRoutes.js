const express = require("express");
const protect = require("../middleware/authMiddleware.js");
const Authorization = require("../middleware/Authorization.middleware.js");
const { createService, getAllServices, getServiceById, getAllServicesInAdmin, updateServiceStatus, deleteService, updateService } = require("../controllers/serviceControllers.js");

const serviceRoutes = express.Router();

// Apply protect and Authorization middleware to updateTeacherProfile route
serviceRoutes.post("/createService", protect, Authorization(["admin"]), createService);

serviceRoutes.get("/getAllServices", protect, Authorization(["user"]), getAllServices);

serviceRoutes.post("/updateService", updateService);

serviceRoutes.get("/getServiceById/:id", protect, Authorization(["user"]), getServiceById);

serviceRoutes.get("/getAllServicesInAdmin", protect, Authorization(["admin"]), getAllServicesInAdmin);

serviceRoutes.post("/updateServiceStatus", protect, Authorization(["admin"]), updateServiceStatus);

serviceRoutes.delete("/deleteService/:id", protect, Authorization(["admin"]), deleteService);

// Correctly export the serviceRoutes router
module.exports = serviceRoutes;
