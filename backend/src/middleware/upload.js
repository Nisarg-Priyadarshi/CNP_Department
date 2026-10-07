import multer from 'multer';

// Use memory storage so we can convert buffers to base64 URIs for Cloudinary without writing to disk
const storage = multer.memoryStorage();

// Allowed MIME types
const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOCS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGES.includes(file.mimetype) || ALLOWED_DOCS.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types are JPG, PNG, WEBP, PDF, DOC, DOCX.`), false);
  }
};

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported image type: ${file.mimetype}. Allowed types are JPG, PNG, WEBP.`), false);
  }
};

const docFilter = (req, file, cb) => {
  if (ALLOWED_DOCS.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported document type: ${file.mimetype}. Allowed types are PDF, DOC, DOCX.`), false);
  }
};

// Error handling middleware to format Multer errors
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File is too large' });
    }
    return res.status(400).json({ success: false, message: err.message });
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

export const uploadImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: imageFilter,
});

export const uploadMixed = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit for documents/updates
  fileFilter: fileFilter,
});

/**
 * Converts a Multer file object (buffer) into a base64 data URI string
 * suitable for cloudinaryService.js
 */
export function getBase64DataURI(file) {
  const b64 = file.buffer.toString('base64');
  return `data:${file.mimetype};base64,${b64}`;
}
