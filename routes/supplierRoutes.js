const express = require("express");
const protect = require("../middleware/authMiddleware.js");
const Authorization = require("../middleware/Authorization.middleware.js");
const {
  updateSupplierProfileData,
  addProduct,
  getSupplierProfileData,
  getProducts,
  getPincode,
  editProduct,
  deleteProduct,
  getProductById,
  getOrdersBySupplierId,
  updateOrderItemStatus,
  getAllProducts,
  getProductsBySupplierId,
  getAllProductsInAdmin,
  updateProductStatus,
  getSupplierOrderNotification,
  getFertilizerBySupplierId,
  getToolsBySupplierId,
  getAllFertilizerProducts,
  getAllToolsProducts,
  getSimilarProducts,
  updateProductDefaultStatus,
  addProductType,
  getProductTypes

} = require("../controllers/supplierController.js");

const supplierRoutes = express.Router();

// Apply protect and Authorization middleware to updateTeacherProfile route
supplierRoutes.post("/addProduct", protect, Authorization(["supplier", "admin","both"]), addProduct);

supplierRoutes.post("/updateProductStatus", protect, Authorization(["admin"]), updateProductStatus);

supplierRoutes.post("/updateProductDefaultStatus", protect, Authorization(["admin"]), updateProductDefaultStatus);

supplierRoutes.post("/editProduct", protect, Authorization(["supplier", "admin","both"]), editProduct);

supplierRoutes.post("/deleteProduct", protect, Authorization(["supplier", "admin","both"]), deleteProduct);

supplierRoutes.get("/getProducts", protect, Authorization(["supplier","both"]), getProducts);

supplierRoutes.get("/getAllProducts", protect, getAllProducts);

supplierRoutes.get("/getAllProductsInAdmin", protect, getAllProductsInAdmin);

supplierRoutes.post("/getProductsBySupplierId", protect, getProductsBySupplierId);

supplierRoutes.get("/getPincode", protect, Authorization(["supplier","both"]), getPincode);

supplierRoutes.get("/getProductById", protect, Authorization(["supplier", "admin","both"]), getProductById);

supplierRoutes.get("/getOrdersBySupplierId", protect, Authorization(["supplier", "admin","both"]), getOrdersBySupplierId);

supplierRoutes.put("/updateOrderItemStatus", protect, Authorization(["supplier","both"]), updateOrderItemStatus);

supplierRoutes.put("/updateSupplierProfileData", protect, Authorization(["supplier","both"]), updateSupplierProfileData);

supplierRoutes.get("/getSupplierProfileData", protect, Authorization(["supplier","both"]), getSupplierProfileData);

supplierRoutes.get("/getSupplierOrderNotification", protect, Authorization(["supplier","both"]), getSupplierOrderNotification);

supplierRoutes.post("/getFertilizerBySupplierId", protect, getFertilizerBySupplierId);

supplierRoutes.post("/getToolsBySupplierId", protect, getToolsBySupplierId);

supplierRoutes.get("/getAllFertilizerProducts", protect, Authorization(["user", "admin","both"]), getAllFertilizerProducts);

supplierRoutes.get("/getAllToolsProducts", protect, Authorization(["user", "admin","both"]), getAllToolsProducts);

supplierRoutes.post("/getSimilarProducts", protect, Authorization(["user", "admin","both"]), getSimilarProducts);

supplierRoutes.post("/addProductType", protect, Authorization(["admin"]), addProductType);

supplierRoutes.get("/getProductTypes", protect, Authorization(["supplier","both"]), getProductTypes);




module.exports = { supplierRoutes };
