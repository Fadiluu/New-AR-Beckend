const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directories exist
const publicDir = path.join(__dirname, '../../public');
const imagesDir = path.join(publicDir, 'images');
const originalsDir = path.join(imagesDir, 'originals');
const thumbsDir = path.join(imagesDir, 'thumbs');

[publicDir, imagesDir, originalsDir, thumbsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, originalsDir); // Store original files in originals folder
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp_random_originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
  }
});

// File filter for accepted image types
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|svg)$/i;
  const extname = allowedExtensions.test(file.originalname);
  
  // Check if mimetype is an image type
  const isImageType = file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype === 'application/octet-stream');

  // Log for debugging
  console.log('=== FILE UPLOAD DEBUG ===');
  console.log('Original name:', file.originalname);
  console.log('Mimetype:', file.mimetype);
  console.log('Extension valid:', extname);
  console.log('Is image type:', isImageType);
  console.log('All fields:', JSON.stringify(file, null, 2));

  // Accept if has valid extension OR is an image mimetype (including octet-stream with valid extension)
  if (extname || isImageType) {
    console.log('File accepted');
    return cb(null, true);
  } else {
    console.log('File rejected - neither valid extension nor image mimetype');
    cb(new Error('Only PNG, JPG, JPEG, GIF, WEBP, and SVG images are allowed!'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

module.exports = upload;

