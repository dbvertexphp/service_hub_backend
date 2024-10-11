// controllers/serviceController.js
const asyncHandler = require('express-async-handler');
const Service = require('../models/serviceModel.js');
const upload = require("../middleware/uploadMiddleware.js");
// Create a new service
const createService = asyncHandler(async (req, res) => {
      req.uploadPath = "uploads/services";

      // Using upload.array to handle multiple files and form data
      upload.array("service_image", 5)(req, res, async (err) => { // Max 5 images
        if (err) {
          return res.status(400).json({ error: err.message });
        }

        // Ensure body fields are being received
        const { service_name, service_description, service_amount } = req.body;

        if (!service_name || !service_description || !service_amount) {
          return res.status(400).json({ error: "All fields are required" });
        }

        // Get the paths for all uploaded images
        const service_images = req.files ? req.files.map(file => `${req.uploadPath}/${file.filename}`) : [];

        // Create the service entry in the database
        const newService = await Service.create({
          service_name,
          service_images, // Store multiple image paths
          service_description,
          service_amount,
        });

        res.status(201).json({
          message: 'Service created successfully',
          service: newService,
        });
      });
});

// Get all services
const getAllServices = asyncHandler(async (req, res) => {
      try {
        const services = await Service.find(); // Fetch all services

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
          return res.status(404).json({ message: 'Service not found' });
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
  const { id } = req.params;
  const { service_name, service_description, service_amount } = req.body;

  // Handle file upload
  upload.single("service_image")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    // Get the service image path if uploaded
    const service_image = req.file ? `${req.uploadPath}/${req.file.filename}` : null;

    const updatedService = await Service.findByIdAndUpdate(id, {
      service_name,
      service_image,
      service_description,
      service_amount,
    }, { new: true });

    if (!updatedService) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.status(200).json({
      message: 'Service updated successfully',
      service: updatedService,
    });
  });
});

// Delete a service
const deleteService = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deletedService = await Service.findByIdAndDelete(id);

  if (!deletedService) {
    return res.status(404).json({ message: 'Service not found' });
  }

  res.status(200).json({ message: 'Service deleted successfully' });
});

module.exports = {
  createService,
  getAllServices,
  updateService,
  deleteService,
  getServiceById
};
