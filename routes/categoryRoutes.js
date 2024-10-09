const express = require("express");
const { Createcategory, GetAllCategories, DeleteCategory, GetSingleCategoryByName, GetAllCategoriesAdmin, UpdateCategory, GetAllCategoriesAdminpage } = require("../controllers/categoryControllers.js");
const protect = require("../middleware/authMiddleware.js");
const Authorization = require("../middleware/Authorization.middleware.js");

const categoryRoutes = express.Router();

categoryRoutes.route("/createCategory").post(protect, Authorization(["admin"]), Createcategory);
categoryRoutes.route("/UpdateCategory").post(protect, Authorization(["admin"]), UpdateCategory);
categoryRoutes.route("/GetAllCategories").get(protect, GetAllCategories);
categoryRoutes.route("/GetAllCategoriesAdmin").get(protect, Authorization(["admin"]), GetAllCategoriesAdmin);
categoryRoutes.route("/GetAllCategoriesAdminpage").post(protect, Authorization(["admin"]), GetAllCategoriesAdminpage);
categoryRoutes.route("/GetCategoryByName").post(protect, Authorization(["admin"]), GetSingleCategoryByName);
categoryRoutes.route("/DeleteCategory").post(protect, Authorization(["admin"]), protect, DeleteCategory);

module.exports = { categoryRoutes };
