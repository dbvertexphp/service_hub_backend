// controllers/serviceController.js
const asyncHandler = require('express-async-handler');
const Service = require('../models/serviceModel.js');
const multer = require('multer'); // Make sure to import multer
const upload = multer({ dest: 'uploads/services' }); // Configure multer

// Create a new service
const createService = asyncHandler(async (req, res) => {
      const { service_name, service_description, service_amount } = req.body;
      console.log(req.body);


      // Handle file upload
      upload.single("service_image")(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }

        // Get the service image path if uploaded
        const service_image = req.file ? `${req.uploadPath}/${req.file.filename}` : null;

        const newService = await Service.create({
          service_name,
          service_image,
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
  const services = await Service.find();
  res.status(200).json(services);
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
};
