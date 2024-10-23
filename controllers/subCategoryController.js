const asyncHandler = require("express-async-handler");
const Category = require("../models/categoryModel.js");
const Subcategory = require("../models/subCategoryModel.js");
require("dotenv").config();
const upload = require("../middleware/uploadMiddleware.js");
const ErrorHandler = require("../utils/errorHandler.js");

const baseURL = process.env.BASE_URL;

const createSubcategory = asyncHandler(async (req, res, next) => {
  // Use the multer middleware to handle file upload
  req.uploadPath = "uploads/subcategory";
  upload.single("subcategory_image")(req, res, async (err) => {
    if (err) {
      return next(new ErrorHandler(err.message, 400));
    }

    const { categoryId, subcategory_name } = req.body;
    console.log(req.body);
    const subcategory_image = req.file ? req.file.path.replace(/\\/g, "/") : null;

    if (!categoryId || !subcategory_name || !subcategory_image) {
      return next(new ErrorHandler("Please enter all the required fields.", 400));
    }

    const category = await Category.findById(categoryId);

    if (!category) {
      return next(new ErrorHandler("Category not found.", 400));
    }

    const subcategory = {
      subcategory_name,
      subcategory_image,
    };

    category.subcategories.push(subcategory);

    await category.save();

    res.status(201).json({
      _id: category._id,
      category_name: category.category_name,
      subcategories: category.subcategories,
      status: true,
    });
  });
});

const updateSubCategory = asyncHandler(async (req, res, next) => {
  req.uploadPath = "uploads/subcategory";
  upload.single("subcategory_image")(req, res, async (err) => {
    if (err) {
      return next(new ErrorHandler(err.message, 400));
    }

    const { category_id, subcategory_id, new_subcategory_name } = req.body;
    const subcategory_image = req.file ? req.file.path.replace(/\\/g, "/") : null; // Normalize file path

    // Check if category_id, subcategory_id, and new_subcategory_name are provided
    if (!category_id || !subcategory_id || !new_subcategory_name) {
      return next(new ErrorHandler("Please provide category ID, subcategory ID, and new subcategory name.", 400));
    }

    try {
      // Find the category by ID
      const category = await Category.findById(category_id);

      if (!category) {
        return next(new ErrorHandler("Category not found.", 404));
      }

      // Find the subcategory by ID within the category
      const subcategory = category.subcategories.id(subcategory_id);

      if (!subcategory) {
        return next(new ErrorHandler("Subcategory not found.", 404));
      }

      // Update the subcategory's name and image if provided
      subcategory.subcategory_name = new_subcategory_name;
      if (subcategory_image) {
        subcategory.subcategory_image = subcategory_image;
      }

      // Save the updated category
      await category.save();

      // Return the updated category with subcategories
      res.status(200).json({
        category,
        message: "Subcategory updated successfully.",
        status: true,
      });
    } catch (error) {
      console.error("Error updating subcategory:", error);
      return next(new ErrorHandler("Internal Server Error", 500));
    }
  });
});

const getAllSubCategories = asyncHandler(async (req, res) => {
  try {
    // Fetch all categories from the database
    const categories = await Category.find().sort({ category_name: 1 });

    if (!categories || categories.length === 0) {
      return res.status(404).json({
        message: "No categories found.",
        status: false,
      });
    }

    // Extract all subcategories
    const subcategories = [];
    categories.forEach((category) => {
      category.subcategories.forEach((subcategory) => {
        subcategories.push({
          category_name: category.category_name,
          subcategory_name: subcategory.subcategory_name,
          subcategory_image: subcategory.subcategory_image,
          datetime: subcategory.datetime,
        });
      });
    });

    // Sort subcategories alphabetically
    const sortedSubcategories = subcategories.sort((a, b) => {
      return a.subcategory_name.localeCompare(b.subcategory_name);
    });

    res.status(200).json(sortedSubcategories);
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({
      message: "Internal Server Error.",
      status: false,
    });
  }
});

const DeleteCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.body;

  const category = await Category.findById(categoryId);

  if (category) {
    await category.remove();
    res.status(200).json({
      message: "Category deleted successfully.",
      status: true,
    });
  } else {
    res.status(404).json({
      message: "Category not found.",
      status: false,
    });
  }
});

const GetAllCategoriesAdmin = asyncHandler(async (req, res) => {
  try {
    // Fetch all categories from the database
    const categories = await Category.aggregate([
      {
        $project: {
          category_name: 1,
          createdAt: 1,
          updatedAt: 1,
          datetime: 1,
          isOther: {
            $cond: [{ $eq: ["$category_name", "Other"] }, 1, 0],
          },
        },
      },
      { $sort: { isOther: 1, category_name: 1 } },
    ]);
    if (!categories || categories.length === 0) {
      return res.status(404).json({
        message: "No categories found.",
        status: false,
      });
    }

    // Map categories to remove the 'isOther' property
    const sanitizedCategories = categories.map((category) => {
      const { isOther, ...rest } = category;
      return rest;
    });

    // Filter out the "All" category from the categories array
    const filteredCategories = sanitizedCategories.filter(
      (category) => category.category_name !== "All" // Replace this ID with the actual ID of "All" category
    );

    res.status(200).json(filteredCategories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      message: "Internal Server Error.",
      status: false,
    });
  }
});

const GetSingleCategoryByName = asyncHandler(async (req, res) => {
  const { category_name } = req.body;

  const category = await Category.findOne({ category_name });

  if (category) {
    res.status(200).json({
      category: category,
      status: true,
    });
  } else {
    res.status(404).json({
      message: `Category with name '${category_name}' not found.`,
      status: false,
    });
  }
});

const getAllSubCategoriesAdminpage = asyncHandler(async (req, res) => {
  const { page = 1 } = req.body;
  const perPage = 10; // Number of documents to display per page

  // Calculate the number of documents to skip
  const skip = (page - 1) * perPage;

  try {
    // Fetch all categories and their subcategories from the database
    const categories = await Category.aggregate([
      {
        $unwind: "$subcategories",
      },
      {
        $project: {
          category_name: 1,
          "subcategories.subcategory_name": 1,
          "subcategories.subcategory_image": 1,
          "subcategories.datetime": 1,
        },
      },
      {
        $sort: {
          "subcategories.subcategory_name": 1,
        },
      },
      {
        $skip: skip, // Skip documents based on pagination
      },
      {
        $limit: perPage, // Limit the number of documents per page
      },
    ]);

    if (!categories || categories.length === 0) {
      return res.status(404).json({
        message: "No subcategories found.",
        status: false,
      });
    }

    // Map categories to extract subcategories
    const subcategories = categories.map((category) => {
      return {
        category_name: category.category_name,
        subcategory_name: category.subcategories.subcategory_name,
        subcategory_image: category.subcategories.subcategory_image,
        datetime: category.subcategories.datetime,
      };
    });

    const totalCount = await Category.aggregate([{ $unwind: "$subcategories" }, { $count: "total" }]);

    const totalPages = Math.ceil(totalCount[0]?.total / perPage);

    const paginationDetails = {
      current_page: page,
      data: subcategories,
      total_pages: totalPages,
      total_count: totalCount[0]?.total,
    };

    res.status(200).json(paginationDetails);
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({
      message: "Internal Server Error.",
      status: false,
    });
  }
});

const getSubCategoryByCategoryId = asyncHandler(async (req, res) => {
  const { category_id } = req.body;
  try {
    // Check if category_id is provided
    if (!category_id) {
      return res.status(400).json({
        message: "Please provide category ID.",
        status: false,
      });
    }

    // Find the category by ID
    const category = await Category.findById(category_id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found.",
        status: false,
      });
    }

    // Extract subcategories
    const subcategories = category.subcategories.map((subcategory) => ({
      subcategory_name: subcategory.subcategory_name,
      subcategory_image: subcategory.subcategory_image,
      datetime: subcategory.datetime,
    }));

    // Return the subcategories
    res.status(200).json({
      category_name: category.category_name,
      subcategories,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({
      message: "Internal Server Error.",
      status: false,
    });
  }
});

const getSubCategoryByCategoryIdInAdmin = asyncHandler(async (req, res) => {
  const { category_id } = req.params;
  console.log(req.params);
  try {
    // Check if category_id is provided
    if (!category_id) {
      return res.status(400).json({
        message: "Please provide category ID.",
        status: false,
      });
    }

    // Find the category by ID
    const category = await Category.findById(category_id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found.",
        status: false,
      });
    }

    // Extract subcategories
    const subcategories = category.subcategories.map((subcategory) => ({
      subcategory_id: subcategory._id,
      subcategory_name: subcategory.subcategory_name,
      subcategory_image: subcategory.subcategory_image,
      datetime: subcategory.datetime,
    }));

    // Return the subcategories
    res.status(200).json({
      category_name: category.category_name,
      subcategories,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({
      message: "Internal Server Error.",
      status: false,
    });
  }
});

module.exports = {
  createSubcategory,
  getAllSubCategories,
  DeleteCategory,
  GetSingleCategoryByName,
  GetAllCategoriesAdmin,
  updateSubCategory,
  getAllSubCategoriesAdminpage,
  getSubCategoryByCategoryId,
  getSubCategoryByCategoryIdInAdmin,
};
