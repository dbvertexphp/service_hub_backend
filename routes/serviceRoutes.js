// routes/serviceRoutes.js
const express = require('express');
const {
  createService,
  getAllServices,
  updateService,
  deleteService,
} = require('../controllers/serviceControllers');

const serviceRoutes = express.Router();

serviceRoutes.route('/createService')
  .post(createService)  // Create a new service

  serviceRoutes.route('/createService')
  .post(createService)  // Create a new service
  .get(getAllServices); // Get all services

  serviceRoutes.route('/updateService:id')
  .put(updateService)   // Update a service
  .delete(deleteService); // Delete a service

module.exports = serviceRoutes;
