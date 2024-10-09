const asyncHandler = require("express-async-handler");
// const moment = require("moment-timezone");
const { User } = require("../models/userModel.js");
const dotenv = require("dotenv");
const ErrorHandler = require("../utils/errorHandler.js");
const Fertilizer = require("../models/fertilizerModel.js");
// const upload = require("../middleware/uploadMiddleware.js");
const { addDays, isWeekend } = require("date-fns");
const moment = require("moment-business-days");
const TeacherPayment = require("../models/TeacherPaymentModel.js");
const fs = require("fs");
const path = require("path");
const Order = require("../models/orderModel.js");
const Product = require("../models/productModel.js");
const multer = require("multer");

dotenv.config();

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = req.uploadPath || "uploads/";
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 },
});

const addFertilizer = asyncHandler(async (req, res, next) => {
  req.uploadPath = "uploads/fertilizer";
  upload.array("product_images")(req, res, async (err) => {
    if (err) {
      return next(new ErrorHandler(err.message, 400));
    }
    console.log(req.files);

    const { english_name, product_weight, price, quantity, product_role, supplier_id } = req.body;

    try {
      // Fetch user data to validate pin codes
      const user = await User.findById(supplier_id);
      if (!user) {
        return res.status(404).json({ message: "User not found", status: false });
      }

      const userPinCodes = user.pin_code || [];

      // Get the profile picture paths if uploaded
      const product_images = req.files ? req.files.map((file) => `${req.uploadPath}/${file.filename}`) : [];

      // Create new Product with parsed dates
      const newProduct = new Product({
        product_images,
        english_name,
        product_weight,
        price,
        quantity,
        product_role,
        supplier_id,
        pin_code: userPinCodes,
      });

      const savedProduct = await newProduct.save();

      res.status(201).json({
        _id: savedProduct._id,
        product_images: savedProduct.product_images,
        english_name: savedProduct.english_name,
        product_weight: savedProduct.product_weight,
        price: savedProduct.price,
        quantity: savedProduct.quantity,
        product_role: savedProduct.product_role,
        supplier_id: savedProduct.supplier_id,
        pin_code: savedProduct.pin_code,
        status: true,
      });
    } catch (error) {
      console.error("Error adding product:", error.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
});

const editProduct = asyncHandler(async (req, res, next) => {
  req.uploadPath = "uploads/product";
  upload.array("product_images")(req, res, async (err) => {
    if (err) {
      return next(new ErrorHandler(err.message, 400));
    }

    const { product_id, english_name, local_name, other_name, category_id, price, quantity, product_type, product_size, description, pin_code } = req.body;
    const supplier_id = req.headers.userID; // Assuming user authentication middleware sets this header

    try {
      // Validate required fields
      if (!product_id || !english_name || !price || !quantity || !product_type || !product_size || !description || !category_id || !supplier_id || !pin_code) {
        return res.status(400).json({
          message: "All fields (product_id, english_name, price, quantity, product_type, product_size, description, category_id, supplier_id, pin_code) are required.",
          status: false,
        });
      }

      // Fetch the product to be updated
      const product = await Fertilizer.findById(product_id);
      if (!product) {
        return res.status(404).json({ message: "Product not found", status: false });
      }

      // Check if the supplier_id matches
      if (product.supplier_id.toString() !== supplier_id) {
        return res.status(403).json({ message: "You do not have permission to edit this product", status: false });
      }

      // Handle pin_code as an array
      const pinCodesArray = Array.isArray(pin_code) ? pin_code : [pin_code];

      // Fetch user data to validate pin codes
      const user = await User.findById(supplier_id);
      if (!user) {
        return res.status(404).json({ message: "User not found", status: false });
      }

      const userPinCodes = user.pin_code || [];

      // Check if provided pin codes exist in the user's pin_code array
      const invalidPinCodes = pinCodesArray.filter((pin) => !userPinCodes.includes(pin));
      if (invalidPinCodes.length > 0) {
        return res.status(400).json({ message: `Invalid pin codes: ${invalidPinCodes.join(", ")}`, status: false });
      }

      // Update product fields
      product.english_name = english_name;
      product.local_name = local_name || product.local_name;
      product.other_name = other_name || product.other_name;
      product.category_id = category_id;
      product.price = price;
      product.quantity = quantity;
      product.product_type = product_type;
      product.product_size = product_size;
      product.description = description;
      product.pin_code = pinCodesArray;

      // Remove old product images from the server
      if (req.files && req.files.length > 0) {
        const oldImages = product.product_images;
        oldImages.forEach((image) => {
          const imagePath = path.join(__dirname, "..", image);
          fs.unlink(imagePath, (err) => {
            if (err) {
              console.error(`Failed to delete old image: ${image}`, err);
            }
          });
        });

        // Add new product images
        const newImages = req.files.map((file) => `${req.uploadPath}/${file.filename}`);
        product.product_images = newImages;
      }

      const updatedProduct = await product.save();

      res.status(200).json({
        _id: updatedProduct._id,
        product_images: updatedProduct.product_images,
        english_name: updatedProduct.english_name,
        local_name: updatedProduct.local_name,
        other_name: updatedProduct.other_name,
        category_id: updatedProduct.category_id,
        price: updatedProduct.price,
        quantity: updatedProduct.quantity,
        product_type: updatedProduct.product_type,
        product_size: updatedProduct.product_size,
        description: updatedProduct.description,
        supplier_id: updatedProduct.supplier_id,
        pin_code: updatedProduct.pin_code,
        status: true,
      });
    } catch (error) {
      console.error("Error editing product:", error.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
});

const deleteFertilizer = asyncHandler(async (req, res) => {
  const { product_id } = req.body; // Product ID is provided in the URL

  try {
    // Validate the product_id and supplier_id
    if (!product_id) {
      return res.status(400).json({
        message: "Product ID and Supplier ID are required.",
        status: false,
      });
    }

    // Find the product to be deleted
    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({ message: "Product not found", status: false });
    }

    // Delete the product
    await Product.findByIdAndDelete(product_id);

    res.status(200).json({
      message: "Fertilizer deleted successfully.",
      status: true,
    });
  } catch (error) {
    console.error("Error deleting product:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getProducts = asyncHandler(async (req, res) => {
  const supplier_id = req.headers.userID; // Assuming user authentication middleware sets this header
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
  const limit = 10; // Number of products per page

  try {
    if (!supplier_id) {
      return res.status(400).json({
        message: "Supplier ID is required.",
        status: false,
      });
    }

    const skip = (page - 1) * limit;
    const totalProducts = await Product.countDocuments({ supplier_id });
    const products = await Fertilizer.find({ supplier_id }).skip(skip).limit(limit);

    res.status(200).json({
      products,
      page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get all products with pagination, search, and sorting
const getAllFertilizer = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
  const limit = parseInt(req.query.limit) || 10; // Number of products per page, default to 10
  const search = req.query.search || ""; // Search term
  const sortBy = req.query.sortBy || "createdAt"; // Field to sort by, default to 'createdAt'
  const order = req.query.order === "asc" ? 1 : -1; // Sorting order, default to descending

  try {
    const query = {
      $and: [
        { product_role: "fertilizer" }, // Add the condition for product_role
        {
          $or: [{ english_name: { $regex: search, $options: "i" } }],
        },
      ],
    };

    const totalFertilizer = await Product.countDocuments(query);
    const fertilizer = await Product.find(query)
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      fertilizer,
      page,
      totalPages: Math.ceil(totalFertilizer / limit),
      totalFertilizer,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching fertilizer:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

const getProductsBySupplierId = asyncHandler(async (req, res) => {
  const { supplier_id } = req.body; // Assuming user authentication middleware sets this header

  try {
    if (!supplier_id) {
      return res.status(400).json({
        message: "Supplier ID is required.",
        status: false,
      });
    }

    const totalProducts = await Product.countDocuments({ supplier_id });
    const products = await Product.find({ supplier_id });
    console.log(products);

    res.status(200).json({
      products,
      totalProducts,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getFertilizerById = asyncHandler(async (req, res) => {
  const { fertilizer_id } = req.body; // Assuming user authentication middleware sets this header

  try {
    if (!fertilizer_id) {
      return res.status(400).json({
        message: "Fertilizer ID is required.",
        status: false,
      });
    }
    const fertilizer = await Fertilizer.findById(fertilizer_id);

    res.status(200).json({
      fertilizer,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching Fertilizer:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getOrdersBySupplierId = asyncHandler(async (req, res) => {
  const supplier_id = req.headers.userID;

  try {
    // Validate supplier_id
    if (!supplier_id) {
      return res.status(400).json({ message: "supplier_id is required", status: false });
    }

    // Find all orders for the supplier
    const orders = await Order.find({ "items.supplier_id": supplier_id }).populate({
      path: "items.product_id",
      populate: {
        path: "supplier_id",
        select: "full_name", // Assuming supplier schema has a field 'full_name'
      },
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No orders found for this supplier", status: false });
    }

    // Organize order details
    const response = orders
      .map((order) => {
        const supplierDetails = {};
        order.items.forEach((item) => {
          if (item.supplier_id.toString() === supplier_id) {
            if (!supplierDetails[supplier_id]) {
              supplierDetails[supplier_id] = {
                total_amount: 0,
                full_name: item.product_id.supplier_id.full_name,
                verification_code: item.verification_code,
                products: [],
              };
            }

            supplierDetails[supplier_id].total_amount += item.product_id.price * item.quantity;
            supplierDetails[supplier_id].products.push({
              status: item.status,
              product_id: item.product_id._id,
              quantity: item.quantity,
              price: item.product_id.price,
              product_images: item.product_id.product_images,
              product_name: item.product_id.english_name,
            });
          }
        });

        return {
          _id: order._id,
          order_id: order.order_id,
          order_status: order.status,
          payment_method: order.payment_method,
          created_at: order.created_at,
          updated_at: order.updated_at,
          details: supplierDetails[supplier_id]
            ? [
                {
                  supplier_id: supplier_id,
                  full_name: supplierDetails[supplier_id].full_name,
                  verification_code: supplierDetails[supplier_id].verification_code,
                  total_amount: supplierDetails[supplier_id].total_amount,
                  products: supplierDetails[supplier_id].products,
                },
              ]
            : [],
        };
      })
      .filter((order) => order.details.length > 0); // Filter out orders with no matching details

    res.status(200).json({
      status: true,
      message: "Supplier order details fetched successfully",
      orders: response,
    });
  } catch (error) {
    console.error("Error fetching supplier order details:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const updateOrderItemStatus = asyncHandler(async (req, res) => {
  const { order_id, product_id, new_status } = req.body;

  try {
    // Validate input
    if (!order_id || !product_id || !new_status) {
      return res.status(400).json({ message: "order_id, product_id, and new_status are required", status: false });
    }

    // Validate new_status
    const validStatuses = ["pending", "confirmed", "shipped", "ontheway", "delivered", "cancelled"];
    if (!validStatuses.includes(new_status)) {
      return res.status(400).json({ message: "Invalid status", status: false });
    }

    // Find and update the order item
    const order = await Order.findOneAndUpdate(
      { _id: order_id, "items.product_id": product_id },
      {
        $set: {
          "items.$.status": new_status,
          updated_at: Date.now(),
        },
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order or item not found", status: false });
    }

    // Filter items to include only those with the same supplier_id as the updated item
    const updatedItem = order.items.find((item) => item.product_id.toString() === product_id);
    const supplierId = updatedItem ? updatedItem.supplier_id : null;

    const filteredItems = order.items.filter((item) => item.supplier_id.toString() === supplierId.toString());

    res.status(200).json({
      status: true,
      message: "Order item status updated successfully",
      order: {
        ...order.toObject(),
        items: filteredItems, // Include only the filtered items in the response
      },
    });
  } catch (error) {
    console.error("Error updating order item status:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = { addFertilizer, getProducts, editProduct, deleteFertilizer, getFertilizerById, getOrdersBySupplierId, updateOrderItemStatus, getAllFertilizer, getProductsBySupplierId };
