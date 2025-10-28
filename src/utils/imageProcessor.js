const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Process uploaded image: optimize and create thumbnails
 * @param {string} originalPath - Path to original image
 * @param {string} originalFilename - Original filename
 * @returns {Promise<{webpPath: string, thumbPath: string, webpUrl: string, thumbUrl: string}>}
 */
async function processImage(originalPath, originalFilename) {
  try {
    const ext = path.extname(originalFilename);
    const name = path.basename(originalFilename, ext);
    
    // Paths for optimized versions
    const webpFilename = `${name}.webp`;
    const thumbFilename = `${name}_thumb.webp`;
    
    const imagesDir = path.dirname(originalPath); // Should be originals/
    const baseDir = path.dirname(imagesDir); // Should be images/
    
    const webpPath = path.join(baseDir, webpFilename);
    const thumbPath = path.join(baseDir, 'thumbs', thumbFilename);
    
    // Ensure thumbs directory exists
    const thumbsDir = path.dirname(thumbPath);
    if (!fs.existsSync(thumbsDir)) {
      fs.mkdirSync(thumbsDir, { recursive: true });
    }
    
    // Get image metadata
    const metadata = await sharp(originalPath).metadata();
    
    // Calculate thumbnail dimensions while maintaining aspect ratio
    const thumbSize = 300;
    let thumbWidth = thumbSize;
    let thumbHeight = thumbSize;
    
    if (metadata.width && metadata.height) {
      const aspectRatio = metadata.width / metadata.height;
      if (metadata.width > metadata.height) {
        thumbHeight = Math.round(thumbSize / aspectRatio);
      } else {
        thumbWidth = Math.round(thumbSize * aspectRatio);
      }
    }
    
    // Create WebP version (optimized, full size)
    await sharp(originalPath)
      .webp({ quality: 85, effort: 6 })
      .toFile(webpPath);
    
    // Create thumbnail (300px max dimension)
    await sharp(originalPath)
      .resize(thumbWidth, thumbHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80, effort: 6 })
      .toFile(thumbPath);
    
    // Generate URLs (these will be relative to /images)
    const webpUrl = `/images/${webpFilename}`;
    const thumbUrl = `/images/thumbs/${thumbFilename}`;
    
    // Optional: Delete original file to save space
    // Uncomment the next line if you want to keep only optimized versions
    // fs.unlinkSync(originalPath);
    
    return {
      webpPath,
      thumbPath,
      webpUrl,
      thumbUrl,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format
      }
    };
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error('Failed to process image');
  }
}

module.exports = { processImage };

