import express from 'express';

const router = express.Router();

// GET /api/health
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Backend is running',
  });
});

export default router;
