const express = require("express");
const protect = require("../middleware/authMiddleware.js");
const Authorization = require("../middleware/Authorization.middleware.js");
const { addTools, getProducts, editProduct, deleteTools, getProductById, getOrdersBySupplierId, updateOrderItemStatus, getAllTools, getProductsBySupplierId } = require("../controllers/toolsController.js");

const toolsRoutes = express.Router();

// Apply protect and Authorization middleware to updateTeacherProfile route

toolsRoutes.post("/addTools", protect, Authorization(["admin"]), addTools);

toolsRoutes.post("/editProduct", protect, Authorization(["supplier","both", "admin"]), editProduct);

toolsRoutes.post("/deleteTools", protect, Authorization(["supplier","both", "admin"]), deleteTools);

toolsRoutes.get("/getProducts", protect, Authorization(["supplier","both"]), getProducts);

toolsRoutes.get("/getAllTools", protect, getAllTools);

toolsRoutes.post("/getProductsBySupplierId", protect, getProductsBySupplierId);

toolsRoutes.get("/getProductById", protect, Authorization(["supplier","both", "admin"]), getProductById);

toolsRoutes.get("/getOrdersBySupplierId", protect, Authorization(["supplier","both", "admin"]), getOrdersBySupplierId);

toolsRoutes.put("/updateOrderItemStatus", protect, Authorization(["supplier","both"]), updateOrderItemStatus);

module.exports = { toolsRoutes };
