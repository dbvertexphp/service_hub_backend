const asyncHandler = require("express-async-handler");
const TeacherPaymentStatus = require("../models/teacherPaymentStatusModel");
const { User } = require("../models/userModel");
const Transaction = require("../models/transactionModel");
const { startOfMonth, endOfMonth, subMonths, parse, format, isWithinInterval } = require("date-fns");
const { sendFCMNotification } = require("./notificationControllers");

const addTeacherPaymentStatus = asyncHandler(async (req, res) => {
  const { teacher_id, amount, payment_datetime, remark } = req.body;

  // Validate input data
  if (!teacher_id || !amount || !payment_datetime) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Fetch total amount from Transaction collection for the given teacher_id
    const transactions = await Transaction.find({ teacher_id }).sort({ payment_datetime: -1 });
    const totalAmount = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

    // Fetch existing payment status for the teacher
    const latestPaymentStatus = await TeacherPaymentStatus.findOne({ teacher_id }).sort({ updatedAt: -1 });

    let remainingAmount = totalAmount;

    if (latestPaymentStatus) {
      // Calculate remaining amount based on latest existing payment status
      remainingAmount = latestPaymentStatus.remaining_amount;
    }

    // Check if the payment amount exceeds the remaining amount
    if (amount > remainingAmount) {
      return res.status(400).json({ error: "Payment amount exceeds remaining amount" });
    }

    // Calculate new remaining amount after deducting the payment amount
    remainingAmount -= amount;

    // Create a new TeacherPaymentStatus document
    const newPaymentStatus = new TeacherPaymentStatus({
      teacher_id,
      amount,
      total_amount: totalAmount,
      payment_amount: amount,
      remaining_amount: remainingAmount,
      remark,
      payment_datetime,
    });

    // Save the document to the database
    const savedPaymentStatus = await newPaymentStatus.save();

    // Fetch the teacher's firebase_token from the User model
    const teacher = await User.findById(teacher_id);
    const firebaseToken = teacher ? teacher.firebase_token : null;

    if (firebaseToken) {
      const registrationToken = teacher.firebase_token;
      const title = "Payment Received";
      const body = `A payment of amount ${amount} has been made. Remaining amount: ${remainingAmount}.`;
      console.log(registrationToken);
      const notificationResult = await sendFCMNotification(registrationToken, title, body);
      if (notificationResult.success) {
        console.log("Notification sent successfully:", notificationResult.response);
      } else {
        console.error("Failed to send notification:", notificationResult.error);
      }
    }

    // Respond with the saved document
    res.status(201).json({ savedPaymentStatus, status: true });
  } catch (error) {
    console.error("Error saving payment status:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getTeacherPaymentStatuses = asyncHandler(async (req, res) => {
  try {
    const query = { role: "teacher" }; // Condition added to fetch only teachers

    // Fetch users with minimal fields
    const users = await User.find(query, "full_name email mobile profile_pic missingDays");

    // Map each user to an array of promises
    const transformedUsersPromises = users.map(async (user) => {
      const teacher_id = user._id;

      // Fetch transactions for the current teacher
      const transactions = await Transaction.find({ teacher_id });

      // Calculate the total amount from transactions
      const totalAmount = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

      // Fetch the latest payment status for the current teacher
      const paymentStatus = await TeacherPaymentStatus.findOne({ teacher_id }).sort({ createdAt: -1 });

      // Fetch all payment statuses to calculate the total paid amount
      const allPaymentStatuses = await TeacherPaymentStatus.find({ teacher_id });

      // Calculate the total paid amount
      const totalPaidAmount = allPaymentStatuses.reduce((sum, status) => sum + status.amount, 0);

      let remaining_amount = totalAmount; // Default remaining amount is totalAmount
      let remark = null;
      let payment_datetime = null;
      let amount = null;

      if (paymentStatus) {
        remaining_amount = paymentStatus.remaining_amount;
        remark = paymentStatus.remark;
        payment_datetime = paymentStatus.payment_datetime;
        amount = paymentStatus.amount;
      }
      console.log(user);
      return {
        teacher_id: user._id,
        full_name: user.full_name,
        email: user.email,
        mobile: user.mobile,
        profile_pic: user.profile_pic,
        missingDays: user.missingDays,
        totalAmount,
        totalPaidAmount,
        amount,
        remaining_amount,
        remark,
        payment_datetime,
      };
    });

    // Execute all promises concurrently
    const transformedUsers = await Promise.all(transformedUsersPromises);

    res.json({
      Teachers: transformedUsers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const getTeacherPaymentStatusById = asyncHandler(async (req, res) => {
  const { teacher_id } = req.params; // teacher_id will come from the URL parameters

  try {
    // Fetch teacher details
    const user = await User.findById(teacher_id, "full_name email mobile profile_pic");

    if (!user) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Fetch transactions for the current teacher
    const transactions = await Transaction.find({ teacher_id });

    // Calculate the total amount from transactions
    const totalAmount = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

    // Fetch the latest payment status for the current teacher
    const paymentStatus = await TeacherPaymentStatus.findOne({ teacher_id }).sort({ createdAt: -1 });

    // Fetch all payment statuses to calculate the total paid amount
    const allPaymentStatuses = await TeacherPaymentStatus.find({ teacher_id });

    // Calculate the total paid amount
    const totalPaidAmount = allPaymentStatuses.reduce((sum, status) => sum + status.amount, 0);

    let remaining_amount = totalAmount;
    let remark = null;
    let payment_datetime = null;
    let amount = null;

    if (paymentStatus) {
      remaining_amount = paymentStatus.remaining_amount;
      remark = paymentStatus.remark;
      payment_datetime = paymentStatus.payment_datetime;
      amount = paymentStatus.amount;
    }

    const result = {
      teacher_id: user._id,
      full_name: user.full_name,
      email: user.email,
      mobile: user.mobile,
      profile_pic: user.profile_pic,
      totalAmount,
      totalPaidAmount,
      amount,
      remaining_amount,
      remark,
      payment_datetime,
    };

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

// const getTeacherPaymentStatuses = asyncHandler(async (req, res) => {
//   const { page = 1, limit = 10, search } = req.query; // Default values: page 1, limit 10
//   console.log(search);
//   try {
//     let query = {};

//     // If search parameter is provided, filter by teacher's full_name
//     if (search) {
//       query = {
//         // Assuming `teacher_id` is an ObjectId reference to another collection where `full_name` is stored
//         teacher_id: { $in: await User.find({ full_name: { $regex: new RegExp(search, "i") } }).select("_id") },
//       };
//     }

//     const paymentStatusesQuery = TeacherPaymentStatus.find(query)
//       .populate({
//         path: "teacher_id",
//         select: "full_name",
//       })
//       .sort({ created_at: -1 }) // Sort by descending order of creation date
//       .skip((page - 1) * limit)
//       .limit(parseInt(limit));

//     const paymentStatuses = await paymentStatusesQuery.exec();
//     const totalCount = await TeacherPaymentStatus.countDocuments(query);

//     // Calculate totalAmount for each teacher
//     const teacherIds = paymentStatuses.map((status) => status.teacher_id._id);
//     const transactions = await Transaction.aggregate([
//       { $match: { teacher_id: { $in: teacherIds } } },
//       {
//         $group: {
//           _id: "$teacher_id",
//           totalAmount: { $sum: "$amount" },
//         },
//       },
//     ]);

//     // Map totalAmount to paymentStatuses
//     const paymentStatusesWithTotalAmount = paymentStatuses.map((status) => {
//       const transaction = transactions.find((t) => t._id.toString() === status.teacher_id._id.toString());
//       return {
//         ...status._doc,
//         totalAmount: transaction ? transaction.totalAmount : 0,
//       };
//     });

//     // Save totalAmount in TeacherPaymentStatus collection (if needed)
//     for (const status of paymentStatusesWithTotalAmount) {
//       await TeacherPaymentStatus.updateOne({ _id: status._id }, { totalAmount: status.totalAmount });
//     }

//     res.status(200).json({
//       totalCount,
//       totalPages: Math.ceil(totalCount / limit),
//       currentPage: parseInt(page),
//       paymentStatuses: paymentStatusesWithTotalAmount,
//     });
//   } catch (error) {
//     console.error("Error fetching payment statuses:", error.message);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

const calculatePayment = asyncHandler(async (req, res) => {
  try {
    const teacherId = req.headers.userID; // Ensure correct case for headers field (all lowercase).
    if (!teacherId) {
      return res.status(400).json({ error: "UserID header is required" });
    }

    const currentDate = new Date();
    const currentMonthStart = startOfMonth(currentDate);
    const currentMonthEnd = endOfMonth(currentDate);

    // Fetch latest payment status for the teacher
    const latestPaymentStatus = await TeacherPaymentStatus.findOne({ teacher_id: teacherId }).sort({ createdAt: -1 });

    if (!latestPaymentStatus) {
      return res.status(404).json({ error: "No payment status found for the teacher" });
    }

    const teacherInfo = await User.findById(teacherId);
    const fullName = teacherInfo ? teacherInfo.full_name : "Unknown";
    const profile_pic = teacherInfo ? teacherInfo.profile_pic : "Unknown";
    const remainingAmount = latestPaymentStatus.remaining_amount;
    const totalAmount = latestPaymentStatus.total_amount; // Directly fetch total_amount from latest payment status

    // Calculate current month total
    const payments = await TeacherPaymentStatus.find({ teacher_id: teacherId });
    const totalPaidAmount = payments.reduce((sum, status) => sum + status.amount, 0);

    const currentMonthPayments = payments.filter((payment) => isWithinInterval(parse(payment.payment_datetime, "dd/MM/yyyy", new Date()), { start: currentMonthStart, end: currentMonthEnd }));
    const currentMonthTotal = currentMonthPayments.reduce((total, payment) => total + payment.amount, 0);

    // Calculate previous months totals
    const previousMonthTotals = [];
    const distinctMonths = new Set();

    // Collect all distinct months from payments
    payments.forEach((payment) => {
      const paymentDate = parse(payment.payment_datetime, "dd/MM/yyyy", new Date());
      const monthKey = format(paymentDate, "MMMM yyyy");
      distinctMonths.add(monthKey);
    });

    // Iterate through each distinct month and calculate totals
    distinctMonths.forEach((monthKey) => {
      const monthDate = parse(`01 ${monthKey}`, "dd MMMM yyyy", new Date());
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthPayments = payments.filter((payment) => isWithinInterval(parse(payment.payment_datetime, "dd/MM/yyyy", new Date()), { start: monthStart, end: monthEnd }));
      const monthTotal = monthPayments.reduce((total, payment) => total + payment.amount, 0);

      previousMonthTotals.push({ month: monthKey, totalAmount: monthTotal });
    });

    res.json({
      totalAmount,
      remainingAmount,
      totalPaidAmount,
      currentMonthTotals: [{ month: format(currentMonthStart, "MMMM yyyy"), totalAmount: currentMonthTotal }],
      previousMonthTotals,
      fullName,
      profile_pic,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { addTeacherPaymentStatus, getTeacherPaymentStatuses, calculatePayment, getTeacherPaymentStatusById };
