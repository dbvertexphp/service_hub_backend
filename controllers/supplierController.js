const asyncHandler = require("express-async-handler");
// const moment = require("moment-timezone");
const { User } = require("../models/userModel.js");
const dotenv = require("dotenv");
const ErrorHandler = require("../utils/errorHandler.js");
const Product = require("../models/productModel.js");
const upload = require("../middleware/uploadMiddleware.js");
const { addDays, isWeekend } = require("date-fns");
const moment = require("moment-business-days");
const TeacherPayment = require("../models/TeacherPaymentModel.js");
const fs = require("fs");
const path = require("path");
const Order = require("../models/orderModel.js");
const { addNotification } = require("./orderNotificationController");
const { sendFCMNotification } = require("./notificationControllers");
const OrderNotification = require("../models/orderNotificationModel.js");
const Favorite = require("../models/favorite.js");
const Cart = require("../models/cartModel.js");
const ProductType = require("../models/product_type_Model.js");

dotenv.config();

const updateSupplierProfileData = asyncHandler(async (req, res) => {
  req.uploadPath = "uploads/profiles";
  upload.fields([{ name: "profile_pic", maxCount: 1 }])(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { full_name, mobile, email, address, pin_code } = req.body;
    const supplier_id = req.headers.userID; // Assuming you have user authentication middleware

    // Get the profile picture path if uploaded
    const profile_pic = req.files.profile_pic ? `${req.uploadPath}/${req.files.profile_pic[0].filename}` : null;

    try {
      // Find the current user to get the old image paths and pin codes
      const currentUser = await User.findById(supplier_id);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Build the update object with optional fields
      let updateFields = {
        datetime: moment().tz("Asia/Kolkata").format("YYYY-MMM-DD hh:mm:ss A"),
      };

      // Update optional fields if provided
      if (full_name) {
        updateFields.full_name = full_name;
      }
      if (mobile) {
        updateFields.mobile = mobile;
      }
      if (email) {
        updateFields.email = email;
      }
      if (address) {
        updateFields.address = address;
      }

      // Check if there is a new profile pic uploaded and delete the old one
      if (profile_pic && currentUser.profile_pic) {
        const oldProfilePicPath = currentUser.profile_pic;
        updateFields.profile_pic = profile_pic;

        // Delete the old profile picture
        deleteFile(oldProfilePicPath);
      } else if (profile_pic) {
        updateFields.profile_pic = profile_pic;
      }

      // Handle pin_code as an array and update it
      let pinCodesArray = [];
      if (pin_code) {
        pinCodesArray = Array.isArray(pin_code) ? pin_code : [parseInt(pin_code, 10)];
        pinCodesArray = [...new Set(pinCodesArray)]; // Remove duplicates
      }

      // Update the user's profile fields
      const updatedUser = await User.findByIdAndUpdate(
        supplier_id,
        {
          $set: {
            full_name: updateFields.full_name,
            mobile: updateFields.mobile,
            email: updateFields.email,
            address: updateFields.address,
            profile_pic: updateFields.profile_pic,
            datetime: updateFields.datetime,
            pin_code: pinCodesArray, // Directly set the new pin codes array
          },
        },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return the updated user data
      return res.status(200).json({
        _id: updatedUser._id,
        full_name: updatedUser.full_name,
        mobile: updatedUser.mobile,
        email: updatedUser.email,
        address: updatedUser.address,
        pin_code: updatedUser.pin_code,
        profile_pic: updatedUser.profile_pic,
        status: true,
      });
    } catch (error) {
      console.error("Error updating user profile:", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
});

const getSupplierProfileData = asyncHandler(async (req, res) => {
  const supplier_id = req.headers.userID; // Assuming you have user authentication middleware

  try {
    // Find the user by ID
    const user = await User.findById(supplier_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return the user's profile information
    return res.status(200).json({
      user: user,

      status: true,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Function to delete a file from the filesystem
function deleteFile(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error("Error deleting file:", err);
    } else {
      console.log(`Deleted file: ${filePath}`);
    }
  });
}

const addProduct = asyncHandler(async (req, res, next) => {
  req.uploadPath = "uploads/product";
  upload.array("product_images")(req, res, async (err) => {
    console.log(req.files);
    if (err) {
      return next(new ErrorHandler(err.message, 400));
    }

    const { english_name, local_name, other_name, category_id, price, quantity, product_type, product_role, product_size, description } = req.body;
    const supplier_id = req.headers.userID; // Assuming user authentication middleware sets this header

    try {
      // Fetch user data to validate pin codes
      const user = await User.findById(supplier_id);
      if (!user) {
        return res.status(404).json({ message: "User not found", status: false });
      }
      // Get the profile picture paths if uploaded
      const product_images = req.files ? req.files.map((file) => `${req.uploadPath}/${file.filename}`) : [];

      // Create new Product with parsed dates
      const newProduct = new Product({
        product_images,
        english_name,
        local_name,
        other_name,
        category_id,
        price,
        quantity,
        product_type,
        product_role,
        product_size,
        description,
        supplier_id,
      });

      const savedProduct = await newProduct.save();

      res.status(201).json({
        _id: savedProduct._id,
        product_images: savedProduct.product_images,
        english_name: savedProduct.english_name,
        local_name: savedProduct.local_name,
        other_name: savedProduct.other_name,
        category_id: savedProduct.category_id,
        price: savedProduct.price,
        quantity: savedProduct.quantity,
        product_type: savedProduct.product_type,
        product_role: savedProduct.product_role,
        product_size: savedProduct.product_size,
        description: savedProduct.description,
        supplier_id: savedProduct.supplier_id,
        status: true,
      });
    } catch (error) {
      console.error("Error adding product:", error.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
});

const updateProductDefaultStatus = asyncHandler(async (req, res) => {
  const { productId, default_product } = req.body;

  if (typeof default_product !== "boolean") {
    return res.status(400).json({ message: "Invalid status value. It should be true or false.", status: false });
  }

  try {
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found", status: false });
    }

    // Check if the request is trying to set default_product to true
    if (default_product) {
      // Count how many products already have default_product set to true
      const defaultProductsCount = await Product.countDocuments({ default_product: true });

      if (defaultProductsCount >= 4) {
        return res.status(400).json({
          message: "Cannot set default_product to true for more than 4 products.",
          status: false,
        });
      }
    }

    product.default_product = default_product;
    const updatedProduct = await product.save();

    res.status(200).json({
      _id: updatedProduct._id,
      default_product: updatedProduct.default_product,
      status: true,
    });
  } catch (error) {
    console.error("Error updating product status:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const updateProductStatus = asyncHandler(async (req, res) => {
  const { productId, active } = req.body; // Get the product ID from the URL parameters

  if (typeof active !== "boolean") {
    return res.status(400).json({ message: "Invalid status value. It should be true or false.", status: false });
  }

  try {
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found", status: false });
    }

    product.active = active;
    const updatedProduct = await product.save();

    res.status(200).json({
      _id: updatedProduct._id,
      active: updatedProduct.active,
      status: true,
    });
  } catch (error) {
    console.error("Error updating product status:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const editProduct = asyncHandler(async (req, res, next) => {
  req.uploadPath = "uploads/product";
  upload.array("product_images")(req, res, async (err) => {
    if (err) {
      return next(new ErrorHandler(err.message, 400));
    }

    const { product_id, english_name, local_name, other_name, category_id, price, quantity, product_type, product_size, description } = req.body;
    const supplier_id = req.headers.userID; // Assuming user authentication middleware sets this header

    try {
      // Validate required fields
      if (!product_id || !english_name || !price || !quantity || !product_type || !product_size || !description || !category_id || !supplier_id) {
        return res.status(400).json({
          message: "All fields (product_id, english_name, price, quantity, product_type, product_size, description, category_id, supplier_id, pin_code) are required.",
          status: false,
        });
      }

      // Fetch the product to be updated
      const product = await Product.findById(product_id);
      if (!product) {
        return res.status(404).json({ message: "Product not found", status: false });
      }

      // Check if the supplier_id matches
      if (product.supplier_id.toString() !== supplier_id) {
        return res.status(403).json({ message: "You do not have permission to edit this product", status: false });
      }

      // Fetch user data to validate pin codes
      const user = await User.findById(supplier_id);
      if (!user) {
        return res.status(404).json({ message: "User not found", status: false });
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
        status: true,
      });
    } catch (error) {
      console.error("Error editing product:", error.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const { product_id } = req.body; // Product ID is provided in the body
  const supplier_id = req.headers.userID; // Assuming user authentication middleware sets this header

  try {
    // Validate the product_id and supplier_id
    if (!product_id || !supplier_id) {
      return res.status(400).json({
        message: "Product ID and Supplier ID are required.",
        status: false,
      });
    }

    // Find the product to be deactivated
    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({ message: "Product not found", status: false });
    }

    // Check if the supplier_id matches
    if (product.supplier_id.toString() !== supplier_id) {
      return res.status(403).json({ message: "You do not have permission to deactivate this product", status: false });
    }

    // Update the product to set active to false
    await Product.findByIdAndUpdate(
      product_id,
      { $set: { active: false } },
      { new: true } // Return the updated document
    );

    // Send notification to the supplier
    const supplier = await User.findById(supplier_id);
    if (supplier.firebase_token || supplier.firebase_token == "dummy_token") {
      const registrationToken = supplier.firebase_token;
      const title = "Product Deactivated";
      const body = `Your product "${product.english_name}" has been deactivated.`;

      const notificationResult = await sendFCMNotification(registrationToken, title, body);
      if (notificationResult.success) {
        console.log("Notification sent successfully:", notificationResult.response);
      } else {
        console.error("Failed to send notification:", notificationResult.error);
      }
      // Optionally, log or handle notification results
    }

    res.status(200).json({
      message: "Product deactivated successfully.",
      status: true,
    });
  } catch (error) {
    console.error("Error deactivating product:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getProducts = asyncHandler(async (req, res) => {
  const supplier_id = req.headers.userID; // Extracting supplier_id from headers
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
    const totalProducts = await Product.countDocuments({
      supplier_id,
      product_role: "supplier",
    });

    const products = await Product.find({
      supplier_id,
      product_role: "supplier",
    })
      .sort({ createdAt: -1 }) // Sort by createdAt in descending order
      .skip(skip)
      .limit(limit);

    // Fetch count of unread notifications for the supplier
    const unreadNotificationsCount = await OrderNotification.countDocuments({
      supplier_ids: { $in: [supplier_id] },
      supplierstatus: "unread",
    });

    // Check if there are any unread notifications
    const notificationStatus = unreadNotificationsCount > 0 ? "unread" : "read";

    res.status(200).json({
      products,
      page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      unreadNotificationsCount,
      notificationStatus,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getAllProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
  const limit = parseInt(req.query.limit) || 10; // Number of products per page, default to 10
  const search = req.query.search || ""; // Search term
  const sortBy = req.query.sortBy || "createdAt"; // Field to sort by, default to 'createdAt'
  const order = req.query.order === "asc" ? 1 : -1; // Sorting order, default to descending

  try {
    const query = {
      $and: [
        { product_role: "supplier" },
        { active: true },
        {
          $or: [{ english_name: { $regex: search, $options: "i" } }],
        },
      ],
    };

    const totalProducts = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      products,
      page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

const getAllProductsInAdmin = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
  const limit = parseInt(req.query.limit) || 10; // Number of products per page, default to 10
  const search = req.query.search || ""; // Search term
  const sortBy = req.query.sortBy || "createdAt"; // Field to sort by, default to 'createdAt'
  const order = req.query.order === "asc" ? 1 : -1; // Sorting order, default to descending

  try {
    const query = {
      $and: [
        { product_role: "supplier" },
        {
          $or: [{ english_name: { $regex: search, $options: "i" } }],
        },
      ],
    };

    const totalProducts = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      products,
      page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

const getProductsBySupplierId = asyncHandler(async (req, res) => {
  const { supplier_id } = req.body; // Assuming user authentication middleware sets this header
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
    const products = await Product.find({ supplier_id, active: true }).skip(skip).limit(limit);

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

const getProductById = asyncHandler(async (req, res) => {
  const { product_id } = req.body; // Assuming user authentication middleware sets this header

  try {
    if (!product_id) {
      return res.status(400).json({
        message: "PRoduct ID is required.",
        status: false,
      });
    }
    const product = await Product.findById(product_id);

    res.status(200).json({
      product,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching product:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getPincode = asyncHandler(async (req, res) => {
  const supplier_id = req.headers.userID; // Assuming user authentication middleware sets this header
  try {
    if (!supplier_id) {
      return res.status(400).json({
        message: "Supplier ID is required.",
        status: false,
      });
    }
    const Pincodes = await User.findById({ _id: supplier_id });

    res.status(200).json({
      Pincodes: Pincodes.pin_code,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching pincode:", error.message);
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
    const orders = await Order.find({ "items.supplier_id": supplier_id })
      .sort({ created_at: -1 })
      .populate({
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
          if (item.product_id && item.supplier_id.toString() === supplier_id) {
            if (!supplierDetails[supplier_id]) {
              supplierDetails[supplier_id] = {
                total_amount: 0,
                full_name: item.product_id.supplier_id?.full_name || "Unknown Supplier",
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
  const { order_id, new_status } = req.body;
  const supplier_id = req.headers.userID;
  try {
    // Validate input
    if (!order_id || !new_status) {
      return res.status(400).json({ message: "order_id, and new_status are required", status: false });
    }

    // Validate new_status
    const validStatuses = ["order", "shipped", "ontheway", "delivered", "cancelled"];
    if (!validStatuses.includes(new_status)) {
      return res.status(400).json({ message: "Invalid status", status: false });
    }

    // Find and update the order item
    const savedOrder = await Order.findOneAndUpdate(
      { _id: order_id, "items.supplier_id": supplier_id },
      {
        $set: {
          "items.$.status": new_status,
          updated_at: Date.now(),
        },
      },
      { new: true }
    );

    if (!savedOrder) {
      return res.status(404).json({ message: "Order or item not found", status: false });
    } else {
      const order = await Order.findById(order_id);
      const user = await User.findById(order.user_id);
      console.log(order.user_id);

      if (user.firebase_token || user.firebase_token == "dummy_token") {
        const registrationToken = user.firebase_token;

        let title;
        let body;
        if (new_status == "Order") {
          title = "Order Placed";
          body = `Your order has been successfully placed!`;
        } else if (new_status == "shipped") {
          title = "Order Shipped";
          body = `Your order has been shipped.`;
        } else if (new_status == "ontheway") {
          title = "Order on the Way";
          body = `Your order is on the way and will reach you soon.`;
        } else if (new_status == "delivered") {
          title = "Order Delivered";
          body = `Your order has been delivered. Enjoy your purchase!`;
        } else if (new_status == "cancelled") {
          title = "Order Cancelled";
          body = `Your order has been cancelled. If you have any questions, please contact us.`;
        }
        console.log(registrationToken);
        const notificationResult = await sendFCMNotification(registrationToken, title, body);
        if (notificationResult.success) {
          console.log("Notification sent successfully:", notificationResult.response);
        } else {
          console.error("Failed to send notification:", notificationResult.error);
        }

        await addNotification(savedOrder.user_id, savedOrder._id, body, savedOrder.total_amount, [supplier_id], title, new_status);
      }
    }

    // Filter items to include only those with the same supplier_id as the updated item
    const updatedItem = savedOrder.items.find((item) => item.supplier_id.toString() === supplier_id);
    const supplierId = updatedItem ? updatedItem.supplier_id : null;

    const filteredItems = savedOrder.items.filter((item) => item.supplier_id.toString() === supplierId.toString());

    res.status(200).json({
      status: true,
      message: "Order item status updated successfully",
      order: {
        ...savedOrder.toObject(),
        items: filteredItems, // Include only the filtered items in the response
      },
    });
  } catch (error) {
    console.error("Error updating order item status:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getPopularProduct = asyncHandler(async (req, res) => {
  const userID = req.headers.userID;

  try {
    // Fetch the user data to get their pin code
    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ message: "User not found", status: false });
    }

    const userPinCode = user.pin_code; // Assuming pin_code is an array

    // Find all suppliers whose pin codes match the user's pin code
    const matchingSuppliers = await User.find({
      role: "supplier",
      pin_code: { $in: userPinCode },
    }).select("_id");

    const supplierIds = matchingSuppliers.map((supplier) => supplier._id);

    // Fetch products from suppliers with matching pin codes
    const popularProducts = await Product.find({
      active: true,
      supplier_id: { $in: supplierIds }, // Filter products by matching supplier IDs
    })
      .sort({ averageRating: -1, ratingCount: -1 }) // Sort by highest rating and rating count
      .limit(10) // Limit to top 10 popular products
      .populate("category_id", "_id category_name"); // Populate category data with _id and category_name

    // Fetch count of unread notifications for the supplier
    const unreadNotificationsCount = await OrderNotification.countDocuments({
      user_id: userID,
      userstatus: "unread",
    });

    // Check if there are any unread notifications
    const notificationStatus = unreadNotificationsCount > 0 ? "unread" : "read";

    // Fetch cart items to get the count of products in the cart
    const cartItems = await Cart.find({ user_id: userID });
    const cartProductCount = cartItems.length;

    if (popularProducts.length === 0) {
      return res.status(404).json({ message: "No popular products found", status: false });
    }

    // For each product, check if it is favorited by the user
    const productsWithFavoriteStatus = await Promise.all(
      popularProducts.map(async (product) => {
        const isFavorite = await Favorite.findOne({
          user_id: userID,
          product_id: product._id,
        });

        return {
          ...product.toObject(),
          isFavorite: !!isFavorite, // true if the product is favorited, false otherwise
        };
      })
    );

    res.status(200).json({
      status: true,
      message: "Popular products retrieved successfully",
      products: productsWithFavoriteStatus,
      unreadNotificationsCount,
      notificationStatus,
      cartProductCount,
    });
  } catch (error) {
    console.error("Error fetching popular products:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getSimilarProducts = asyncHandler(async (req, res) => {
  const { productId } = req.body; // Assuming product ID is passed as a route parameter

  try {
    // Fetch the product details based on the provided productId
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found", status: false });
    }

    // Find similar products based on category, product type, and size
    const similarProducts = await Product.find({
      _id: { $ne: productId }, // Exclude the original product
      category_id: product.category_id,
      product_type: product.product_type,
      product_size: product.product_size,
      product_role: product.product_role,
      active: true,
    })
      .sort({ averageRating: -1, ratingCount: -1 }) // Sort by highest rating and rating count
      .limit(10) // Limit to top 10 similar products
      .populate("category_id", "_id category_name"); // Populate category data

    if (similarProducts.length === 0) {
      return res.status(404).json({ message: "No similar products found", status: false });
    }

    res.status(200).json({
      status: true,
      message: "Similar products retrieved successfully",
      similarProducts,
    });
  } catch (error) {
    console.error("Error fetching similar products:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getSupplierOrderNotification = asyncHandler(async (req, res) => {
  const supplierId = req.headers.userID; // Assuming supplier_id is passed via headers

  try {
    if (!supplierId) {
      return res.status(400).json({ message: "Supplier ID is required", status: false });
    }

    const notifications = await OrderNotification.find({ supplier_ids: { $in: [supplierId] } }).sort({ created_at: -1 });

    if (!notifications || notifications.length === 0) {
      return res.status(404).json({ message: "No notifications found", status: false });
    }

    // Mark all unread notifications as read for the supplier
    await OrderNotification.updateMany({ supplier_ids: { $in: [supplierId] }, supplierstatus: "unread" }, { $set: { supplierstatus: "read" } });

    res.status(200).json({
      status: true,
      notifications: notifications,
    });
  } catch (error) {
    console.error("Error fetching supplier order notifications:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getFertilizerBySupplierId = asyncHandler(async (req, res) => {
  const { supplier_id } = req.body; // Extracting supplier_id from headers

  try {
    if (!supplier_id) {
      return res.status(400).json({
        message: "Supplier ID is required.",
        status: false,
      });
    }

    const products = await Product.find({ supplier_id, product_role: "fertilizer" });

    res.status(200).json({
      products,
      totalProducts: products.length,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getToolsBySupplierId = asyncHandler(async (req, res) => {
  const { supplier_id } = req.body; // Extracting supplier_id from headers

  try {
    if (!supplier_id) {
      return res.status(400).json({
        message: "Supplier ID is required.",
        status: false,
      });
    }

    const products = await Product.find({ supplier_id, product_role: "tools" });

    res.status(200).json({
      products,
      totalProducts: products.length,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getAllFertilizerProducts = asyncHandler(async (req, res) => {
  try {
    const query = {
      $and: [
        { product_role: "fertilizer" }, // Add the condition for product_role
      ],
    };

    const fertilizer = await Product.find(query);

    res.status(200).json({
      fertilizer,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching fertilizer:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

const getAllToolsProducts = asyncHandler(async (req, res) => {
  try {
    const query = {
      $and: [
        { product_role: "tools" }, // Add the condition for product_role
      ],
    };

    const tools = await Product.find(query);

    res.status(200).json({
      tools,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching fertilizer:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

const addProductType = asyncHandler(async (req, res) => {
  try {
    const { type_name } = req.body;

    // Validate input
    if (!type_name) {
      return res.status(400).json({ message: "Product type name is required." });
    }

    // Check if the product type already exists
    const existingType = await ProductType.findOne({ type_name });
    if (existingType) {
      return res.status(400).json({ message: "Product type already exists." });
    }

    // Create a new product type
    const newProductType = new ProductType({
      type_name,
    });

    // Save to the database
    await newProductType.save();

    res.status(201).json({
      message: "Product type added successfully.",
      productType: newProductType,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

const getProductTypes = asyncHandler(async (req, res) => {
  try {
    // Fetch all product types from the database
    const productTypes = await ProductType.find();

    // Return the result as a response
    res.status(200).json({
      message: "Product types retrieved successfully.",
      productTypes,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = {
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
  getPopularProduct,
  getSupplierOrderNotification,
  getFertilizerBySupplierId,
  getToolsBySupplierId,
  getAllFertilizerProducts,
  getAllToolsProducts,
  getSimilarProducts,
  updateProductDefaultStatus,
  addProductType,
  getProductTypes,
};
