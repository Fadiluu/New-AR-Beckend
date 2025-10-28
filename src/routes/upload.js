const router = require('express').Router();
const upload = require('../middleware/upload');
const { processImage } = require('../utils/imageProcessor');
const path = require('path');

/**
 * POST /api/upload
 * Upload and optimize image
 * 
 * Body: multipart/form-data with field 'image'
 * Response: { success: true, data: { url: string, thumbUrl: string, ... } }
 */
router.post('/', (req, res) => {
  upload.single('image')(req, res, async (err) => {
    // Handle Multer errors
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error',
        error: err.message
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No image file provided. Please upload an image.'
        });
      }

      // Process the image (optimize and create thumbnail)
      const originalPath = req.file.path;
      const originalFilename = req.file.filename;
      
      const processed = await processImage(originalPath, originalFilename);
      
      // Return the optimized image URL and thumbnail URL
      res.json({
        success: true,
        message: 'Image uploaded and optimized successfully',
        data: {
          url: processed.webpUrl,
          thumbUrl: processed.thumbUrl,
          filename: path.basename(processed.webpPath),
          metadata: processed.metadata
        }
      });
      
    } catch (error) {
      console.error('Upload error:', error);
      
      // Clean up uploaded file if processing failed
      if (req.file) {
        const fs = require('fs');
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error('Failed to delete uploaded file:', err);
        }
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to upload and process image',
        error: error.message
      });
    }
  });
});

module.exports = router;

