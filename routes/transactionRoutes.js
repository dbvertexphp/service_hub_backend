const express = require("express");
const { addTransaction, getAllTransactions, getAllTransactionsByUser, getAllTransactionsByTeacher } = require("../controllers/transactionController.js");
const protect = require("../middleware/authMiddleware.js");

const transactionRoutes = express.Router();

transactionRoutes.route("/addTransaction").post(protect, addTransaction);
transactionRoutes.route("/getAllTransactions").get(protect, getAllTransactions);
transactionRoutes.route("/getAllTransactionsByUser").get(protect, getAllTransactionsByUser);
transactionRoutes.route("/getAllTransactionsByTeacher").post(protect, getAllTransactionsByTeacher);
module.exports = { transactionRoutes };
