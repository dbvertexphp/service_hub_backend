const express = require("express");
const protect = require("../middleware/authMiddleware.js");
const Authorization = require("../middleware/Authorization.middleware.js");
const { addFertilizer, getProducts, editProduct, deleteFertilizer, getFertilizerById, getOrdersBySupplierId, updateOrderItemStatus, getAllFertilizer, getProductsBySupplierId } = require("../controllers/fertilizerController.js");

const fertilizerRoutes = express.Router();

// Apply protect and Authorization middleware to updateTeacherProfile route
fertilizerRoutes.post("/addFertilizer", protect, Authorization(["admin"]), addFertilizer);

fertilizerRoutes.post("/editProduct", protect, Authorization(["supplier","both", "admin"]), editProduct);

fertilizerRoutes.post("/deleteFertilizer", protect, Authorization(["supplier","both", "admin"]), deleteFertilizer);

fertilizerRoutes.get("/getProducts", protect, Authorization(["supplier","both"]), getProducts);

fertilizerRoutes.get("/getAllFertilizer", protect, getAllFertilizer);

fertilizerRoutes.post("/getProductsBySupplierId", protect, getProductsBySupplierId);

fertilizerRoutes.get("/getFertilizerById", protect, Authorization(["supplier","both", "admin"]), getFertilizerById);

fertilizerRoutes.get("/getOrdersBySupplierId", protect, Authorization(["supplier","both", "admin"]), getOrdersBySupplierId);

fertilizerRoutes.put("/updateOrderItemStatus", protect, Authorization(["supplier","both"]), updateOrderItemStatus);

module.exports = { fertilizerRoutes };
