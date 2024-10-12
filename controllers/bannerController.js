// controllers/bannerController.js
const Banner = require('../models/bannerModel');
const upload = require("../middleware/uploadMiddleware.js");
const ErrorHandler = require("../utils/errorHandler.js");



// Add a new banner with multiple images
exports.addBanner = async (req, res, next) => {
      try {
        // Set upload path for the image
        req.uploadPath = "uploads/banner";

        // Use multer's upload functionality to handle the image upload (single image)
        upload.single("image")(req, res, async (err) => {
          if (err) {
            return next(new ErrorHandler(err.message, 400)); // Handle multer error
          }

          try {
            // Check if an image was uploaded
            if (!req.file) {
              return res.status(400).json({ success: false, message: 'No image uploaded' });
            }

            // Extract title from the request body
            const { title } = req.body;

            // Check if title is provided
            if (!title) {
              return res.status(400).json({ success: false, message: 'Title is required' });
            }
            const image = req.file ? `${req.uploadPath}/${req.file.filename}` : null;

            // Create a new banner with the title and the image path
            const newBanner = new Banner({
              title, // The title of the banner
              image, // Store the image path
            });

            // Save the banner to the database
            const savedBanner = await newBanner.save();
            res.status(201).json({ success: true, banner: savedBanner });

          } catch (error) {
            return next(new ErrorHandler('Failed to add banner', 500)); // Handle other errors
          }
        });

      } catch (error) {
        return next(new ErrorHandler('Server error', 500)); // Handle unexpected server errors
      }
};




// Get all banners
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find();
    res.status(200).json({ success: true, banner: banners });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch banners', error: error.message });
  }
};

// Update a banner with new images
exports.updateBanner = async (req, res, next) => {
      try {
            req.uploadPath = "uploads/banner";
        const { id } = req.params; // Get the banner ID from the request parameters
        const { title } = req.body; // Extract title from the request body

        // Check if the banner exists
        const banner = await Banner.findById(id);
        if (!banner) {
          return res.status(404).json({ success: false, message: 'Banner not found' });
        }

        // Use multer's upload functionality to handle the image upload (single image)
        upload.single("image")(req, res, async (err) => {
          if (err) {
            return next(new ErrorHandler(err.message, 400)); // Handle multer error
          }

          try {
            // Update title if provided
            if (title) {
              banner.title = title;
            }

            // Update image if a new image is uploaded
            if (req.file) {
              banner.image = `${req.uploadPath}/${req.file.filename}`;
            }

            // Save the updated banner to the database
            const updatedBanner = await banner.save();
            res.status(200).json({ success: true, banner: updatedBanner });

          } catch (error) {
            return next(new ErrorHandler('Failed to update banner', 500)); // Handle other errors
          }
        });

      } catch (error) {
        return next(new ErrorHandler('Server error', 500)); // Handle unexpected server errors
      }
};

// Delete a banner
exports.deleteBanner = async (req, res) => {
  try {
    const bannerId = req.params.id;
    const deletedBanner = await Banner.findByIdAndDelete(bannerId);

    if (!deletedBanner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    res.status(200).json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete banner', error: error.message });
  }
};
