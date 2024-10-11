const asyncHandler = require("express-async-handler");
const Transaction = require("../models/transactionModel");
const Order = require("../models/orderModel"); // Ensure correct import path
const Product = require("../models/productModel");
const { User } = require("../models/userModel");
const { addNotification } = require("./orderNotificationController");
const { sendFCMNotification } = require("./notificationControllers");

const addTransaction = asyncHandler(async (req, res) => {
  const user_id = req.headers.userID;
  const { payment_id, payment_status, total_amount, service_id } = req.body;

  if (!total_amount) {
    return res.status(400).json({ message: "Invalid input", status: false });
  }

  try {
    // Create a single transaction document
    const newTransaction = new Transaction({
      user_id,
      payment_id: payment_id || null,
      service_id,
      payment_status: payment_status || "pending",
      total_amount,
    });

    const savedTransaction = await newTransaction.save();

    // Send notifications and add notifications for each supplier
    const user = await User.findById(user_id);
    if (user.firebase_token || user.firebase_token == "dummy_token") {
      const registrationToken = user.firebase_token;
      const title = "Service Booked";
      const body = `Your service has been successfully booked and a transaction of ${total_amount} has been completed. Thank you for choosing our service!`;
      const notificationResult = await sendFCMNotification(registrationToken, title, body);
      if (notificationResult.success) {
        console.log("Notification sent successfully:", notificationResult.response);
      } else {
        console.error("Failed to send notification:", notificationResult.error);
      }
      await addNotification(user_id, service_id, body, title, total_amount);
    }

    res.status(201).json({
      message: "Transactions added successfully",
      transaction: savedTransaction,
    });
  } catch (error) {
    console.error("Error adding transactions:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

// Get all transactions with optional filtering, sorting, and pagination
const getAllTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, sortBy = "createdAt", order = "desc" } = req.query;

  try {
    // Fetch transactions with pagination
    const transactions = await Transaction.find()
      .sort({ [sortBy]: order === "desc" ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    // .populate("user_id order_id items.product_id items.supplier_id");

    // Count total number of transactions
    const totalTransactions = await Transaction.countDocuments();

    res.status(200).json({
      message: "Transactions fetched successfully",
      transactions,
      totalPages: Math.ceil(totalTransactions / limit),
      currentPage: parseInt(page),
      totalTransactions,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

// const getAllTransactionsByUser = asyncHandler(async (req, res) => {
//   const user_id = req.headers.userID;
//   const { page = 1, search = "", Short = "" } = req.body;
//   const perPage = 10; // You can adjust this according to your requirements
//   // Build the query based on search (if any)
//   const query = {
//     $or: [
//       { "user_id.first_name": { $regex: search, $options: "i" } },
//       { "user_id.last_name": { $regex: search, $options: "i" } },
//       { "user_id.email": { $regex: search, $options: "i" } },
//       { "teacher_id.name": { $regex: search, $options: "i" } },
//       { "teacher_id.email": { $regex: search, $options: "i" } },
//       {
//         "teacher_id.first_name": {
//           $regex: search,
//           $options: "i",
//         },
//       },
//       { "teacher_id.last_name": { $regex: search, $options: "i" } },
//       { "course_id.title": { $regex: search, $options: "i" } },
//     ],
//   };

//   // Sorting based on Short field
//   let sortCriteria = {};
//   if (Short === "amount") {
//     sortCriteria = { amount: -1 }; // Sort by amount in descending order
//   } else {
//     sortCriteria = { _id: -1 }; // Default sorting
//   }

//   try {
//     const transactions = await Transaction.find({ user_id: user_id })
//       .populate({
//         path: "user_id",
//         select: "first_name last_name email", // Specify fields you want to populate
//       })
//       .populate({
//         path: "service_id",
//         select: "name email first_name last_name",
//       })
//       .sort(sortCriteria)
//       .skip((page - 1) * perPage)
//       .limit(perPage);

//     const totalCount = await Transaction.countDocuments(query);
//     const totalPages = Math.ceil(totalCount / perPage);

//     const paginationDetails = {
//       current_page: parseInt(page),
//       data: transactions,
//       first_page_url: `${baseURL}api/transactions?page=1`,
//       from: (page - 1) * perPage + 1,
//       last_page: totalPages,
//       last_page_url: `${baseURL}api/transactions?page=${totalPages}`,
//       links: [
//         {
//           url: page > 1 ? `${baseURL}api/transactions?page=${page - 1}` : null,
//           label: "&laquo; Previous",
//           active: false,
//         },
//         {
//           url: `${baseURL}api/transactions?page=${page}`,
//           label: page.toString(),
//           active: true,
//         },
//         {
//           url: page < totalPages ? `${baseURL}api/transactions?page=${page + 1}` : null,
//           label: "Next &raquo;",
//           active: false,
//         },
//       ],
//       next_page_url: page < totalPages ? `${baseURL}api/transactions?page=${page + 1}` : null,
//       path: `${baseURL}api/transactions`,
//       per_page: perPage,
//       prev_page_url: page > 1 ? `${baseURL}api/transactions?page=${page - 1}` : null,
//       to: (page - 1) * perPage + transactions.length,
//       total: totalCount,
//     };

//     res.json({
//       Transactions: paginationDetails,
//       page: page.toString(),
//       total_rows: totalCount,
//     });
//   } catch (error) {
//     console.error("Error fetching transactions:", error.message);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

const getAllTransactionsByUser = asyncHandler(async (req, res) => {
  const user_id = req.headers.userID;

  try {
    // Find transactions for the specific user and populate related fields
    const transactions = await Transaction.find({ user_id: user_id })
      .populate({
        path: "user_id",
        select: "first_name last_name email", // Specify fields to populate
      })
      .populate({
        path: "service_id",
        select: "service_name service_images", // Specify fields to populate
      })
      .sort({ createdAt: -1 });

    // Return all transactions without pagination, search, or sorting
    res.json({
      message: "Transactions fetched successfully",
      Transactions: transactions,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const getAllTransactionsByTeacher = asyncHandler(async (req, res) => {
  const { page = 1, search = "", Short = "", user_id } = req.body;
  const perPage = 10; // You can adjust this according to your requirements
  // Build the query based on search (if any)
  const query = {
    $or: [
      { "user_id.first_name": { $regex: search, $options: "i" } },
      { "user_id.last_name": { $regex: search, $options: "i" } },
      { "user_id.email": { $regex: search, $options: "i" } },
      { "teacher_id.name": { $regex: search, $options: "i" } },
      { "teacher_id.email": { $regex: search, $options: "i" } },
      {
        "teacher_id.first_name": {
          $regex: search,
          $options: "i",
        },
      },
      { "teacher_id.last_name": { $regex: search, $options: "i" } },
      { "course_id.title": { $regex: search, $options: "i" } },
    ],
  };

  // Sorting based on Short field
  let sortCriteria = {};
  if (Short === "amount") {
    sortCriteria = { amount: -1 }; // Sort by amount in descending order
  } else {
    sortCriteria = { _id: -1 }; // Default sorting
  }

  try {
    const transactions = await Transaction.find({ teacher_id: user_id })
      .populate({
        path: "user_id",
        select: "first_name last_name email", // Specify fields you want to populate
      })
      .populate({
        path: "teacher_id",
        select: "name email first_name last_name",
      })
      .populate({
        path: "course_id",
        select: "title category_id type",
        populate: {
          path: "category_id",
          select: "name",
        },
      })
      .sort(sortCriteria)
      .skip((page - 1) * perPage)
      .limit(perPage);

    const totalCount = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalCount / perPage);

    const paginationDetails = {
      current_page: parseInt(page),
      data: transactions,
      first_page_url: `${baseURL}api/transactions?page=1`,
      from: (page - 1) * perPage + 1,
      last_page: totalPages,
      last_page_url: `${baseURL}api/transactions?page=${totalPages}`,
      links: [
        {
          url: page > 1 ? `${baseURL}api/transactions?page=${page - 1}` : null,
          label: "&laquo; Previous",
          active: false,
        },
        {
          url: `${baseURL}api/transactions?page=${page}`,
          label: page.toString(),
          active: true,
        },
        {
          url: page < totalPages ? `${baseURL}api/transactions?page=${page + 1}` : null,
          label: "Next &raquo;",
          active: false,
        },
      ],
      next_page_url: page < totalPages ? `${baseURL}api/transactions?page=${page + 1}` : null,
      path: `${baseURL}api/transactions`,
      per_page: perPage,
      prev_page_url: page > 1 ? `${baseURL}api/transactions?page=${page - 1}` : null,
      to: (page - 1) * perPage + transactions.length,
      total: totalCount,
    };

    res.json({
      Transactions: paginationDetails,
      page: page.toString(),
      total_rows: totalCount,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const getAllTransactionsInAdmin = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
  const limit = parseInt(req.query.limit) || 10; // Number of products per page, default to 10
  const search = req.query.search || ""; // Search term
  const sortBy = req.query.sortBy || "createdAt"; // Field to sort by, default to 'createdAt'
  const order = req.query.order === "asc" ? 1 : -1; // Sorting order, default to descending

  try {
    const query = {
      $and: [
        {
          $or: [{ payment_status: { $regex: search, $options: "i" } }],
        },
      ],
    };

    const totalTransaction = await Transaction.countDocuments(query);
    const transaction = await Transaction.find(query)
      .populate({
        path: "user_id",
        select: "first_name last_name email", // Specify fields to populate
      })
      .populate({
        path: "service_id",
        select: "service_name service_images", // Specify fields to populate
      })
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      transaction,
      page,
      totalPages: Math.ceil(totalTransaction / limit),
      totalTransaction,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching transaction:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

const updateTransactionStatus = asyncHandler(async (req, res) => {
      const user_id = req.headers.userID;
      const { transaction_id, status } = req.body;

      // Validate input
      if (!transaction_id || !status) {
        return res.status(400).json({ message: "Invalid input", status: false });
      }

      try {
        // Find the transaction by its ID and user ID
        const transaction = await Transaction.findById({
          _id: transaction_id,
          user_id: user_id,
        });

        if (!transaction) {
          return res.status(404).json({ message: "Transaction not found", status: false });
        }

        // Update the status field in the transaction document
        transaction.status = status;

        // Save the updated transaction
        const updatedTransaction = await transaction.save();

        // Send notification if the status is updated to "Completed"
        if (updatedTransaction) {
          const user = await User.findById(user_id);
          const registrationToken = user.firebase_token;

          const title = "Service Completed";
          const body = `Your service with ID: ${transaction_id} has been marked as ${status}. Thank you for using our service!`;

          if (user.firebase_token || user.firebase_token === "dummy_token") {
            const notificationResult = await sendFCMNotification(registrationToken, title, body);
            if (notificationResult.success) {
              console.log("Notification sent successfully:", notificationResult.response);
            } else {
              console.error("Failed to send notification:", notificationResult.error);
            }
          }

          // Optionally, add a notification record
          await addNotification(user_id, transaction.service_id, body, title, transaction.total_amount);
        }

        res.status(200).json({
          message: "Transaction status updated successfully",
          transaction: updatedTransaction,
        });
      } catch (error) {
        console.error("Error updating transaction status:", error.message);
        res.status(500).json({ message: "Internal Server Error", status: false });
      }
});

module.exports = {
  addTransaction,
  getAllTransactions,
  getAllTransactionsByUser,
  getAllTransactionsByTeacher,
  getAllTransactionsInAdmin,
  updateTransactionStatus
};
