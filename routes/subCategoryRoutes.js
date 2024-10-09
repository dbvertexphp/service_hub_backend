const express = require("express");
const { DeleteCategory, GetSingleCategoryByName, GetAllCategoriesAdmin } = require("../controllers/categoryControllers.js");
const protect = require("../middleware/authMiddleware.js");
const { createSubcategory, updateSubCategory, getAllSubCategoriesAdminpage, getSubCategoryByCategoryId, getAllSubCategories, getSubCategoryByCategoryIdInAdmin } = require("../controllers/subCategoryController.js");

const subCategoryRoutes = express.Router();

subCategoryRoutes.route("/createSubCategory").post(createSubcategory);
subCategoryRoutes.route("/UpdateSubCategory").post(protect, updateSubCategory);
subCategoryRoutes.route("/getAllSubCategories").get(getAllSubCategories);
subCategoryRoutes.route("/GetAllCategoriesAdmin").get(GetAllCategoriesAdmin);
subCategoryRoutes.route("/GetAllSubCategoriesAdminpage").post(getAllSubCategoriesAdminpage);
subCategoryRoutes.route("/GetCategoryByName").post(GetSingleCategoryByName);
subCategoryRoutes.route("/GetSubCategoryByCategoryId").post(getSubCategoryByCategoryId);
subCategoryRoutes.route("/getSubCategoryByCategoryIdInAdmin/:category_id").get(getSubCategoryByCategoryIdInAdmin);
subCategoryRoutes.route("/DeleteCategory").post(protect, DeleteCategory);

module.exports = { subCategoryRoutes };
