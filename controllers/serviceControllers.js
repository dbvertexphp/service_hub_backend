// controllers/serviceController.js
const asyncHandler = require("express-async-handler");
const Service = require("../models/serviceModel.js");
const upload = require("../middleware/uploadMiddleware.js");
// Create a new service
const createService = asyncHandler(async (req, res) => {
  req.uploadPath = "uploads/services";

  // Using upload.array to handle multiple files and form data
  upload.array("service_image", 5)(req, res, async (err) => {
    // Max 5 images
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    // Ensure body fields are being received
    const { service_name, service_description, service_amount } = req.body;

    if (!service_name || !service_description || !service_amount) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Get the paths for all uploaded images
    const service_images = req.files ? req.files.map((file) => `${req.uploadPath}/${file.filename}`) : [];

    // Create the service entry in the database
    const newService = await Service.create({
      service_name,
      service_images, // Store multiple image paths
      service_description,
      service_amount,
    });

    res.status(201).json({
      message: "Service created successfully",
      service: newService,
    });
  });
});

// Get all services
const getAllServices = asyncHandler(async (req, res) => {
  try {
    // Get the search query from the request
    const { search } = req.query;

    // Create a filter object for MongoDB
    const filter = {
      active: true, // Include only active services
      ...(search
        ? {
            $or: [
              { service_name: { $regex: search, $options: "i" } }, // Match service names (case insensitive)
              { service_description: { $regex: search, $options: "i" } }, // Match descriptions (case insensitive)
            ],
          }
        : {}),
    };

    const services = await Service.find(filter); // Fetch all services matching the filter

    if (!services || services.length === 0) {
      return res.status(404).json({
        message: "No services found",
      });
    }

    res.status(200).json({
      message: "Services fetched successfully",
      services,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching services",
      error: error.message,
    });
  }
});

const getServiceById = asyncHandler(async (req, res) => {
  try {
    const serviceId = req.params.id; // Get service ID from the request parameters
    const service = await Service.findById(serviceId); // Find the service by ID

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.status(200).json({
      message: "Service fetched successfully",
      service,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching service",
      error: error.message,
    });
  }
});

// Update a service
const updateService = asyncHandler(async (req, res) => {
  // Use multer to handle multiple image uploads (up to 5 images)
  req.uploadPath = "uploads/services";
  upload.array("service_images", 5)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    // Extract form data after multer processes the files
    const { service_name, service_description, service_amount, service_id } = req.body;

    // Get the paths of the uploaded images
    const service_images = req.files ? req.files.map((file) => `${req.uploadPath}/${file.filename}`) : [];

    try {
      // Update the service with the new data and images
      const updatedService = await Service.findByIdAndUpdate(
        service_id,
        {
          service_name,
          service_images, // Save the array of image paths
          service_description,
          service_amount,
        },
        { new: true } // Return the updated document
      );

      if (!updatedService) {
        return res.status(404).json({ message: "Service not found" });
      }

      res.status(200).json({
        message: "Service updated successfully",
        service: updatedService,
      });
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
});

// Delete a service
const deleteService = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deletedService = await Service.findByIdAndDelete(id);

  if (!deletedService) {
    return res.status(404).json({ message: "Service not found" });
  }

  res.status(200).json({ message: "Service deleted successfully" });
});

const getAllServicesInAdmin = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
  const limit = parseInt(req.query.limit) || 10; // Number of products per page, default to 10
  const search = req.query.search || ""; // Search term
  const sortBy = req.query.sortBy || "createdAt"; // Field to sort by, default to 'createdAt'
  const order = req.query.order === "asc" ? 1 : -1; // Sorting order, default to descending

  try {
    const query = {
      $and: [
        {
          $or: [{ service_name: { $regex: search, $options: "i" } }],
        },
      ],
    };

    const totalServices = await Service.countDocuments(query);
    const services = await Service.find(query)
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      services,
      page,
      totalPages: Math.ceil(totalServices / limit),
      totalServices,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching services:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

const updateServiceStatus = asyncHandler(async (req, res) => {
  const { serviceId, active } = req.body; // Get the product ID from the URL parameters

  if (typeof active !== "boolean") {
    return res.status(400).json({ message: "Invalid status value. It should be true or false.", status: false });
  }

  try {
    const service = await Service.findById(serviceId);

    if (!service) {
      return res.status(404).json({ message: "service not found", status: false });
    }

    service.active = active;
    const updatedService = await service.save();

    res.status(200).json({
      _id: updatedService._id,
      active: updatedService.active,
      status: true,
    });
  } catch (error) {
    console.error("Error updating product status:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = {
  createService,
  getAllServices,
  updateService,
  deleteService,
  getServiceById,
  getAllServicesInAdmin,
  updateServiceStatus,
};
