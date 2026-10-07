/**
 * requireAuth — JWT Authentication Middleware
 *
 * Usage: router.get('/protected', requireAuth, handler)
 *
 * Reads the Authorization header, verifies the JWT, fetches the user
 * from the database, and attaches `req.user` for downstream handlers.
 *
 * Returns 401 if the token is missing, malformed, expired, or the
 * corresponding user no longer exists in the database.
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // 1. Ensure the Authorization header exists and is in Bearer format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const token = authHeader.slice(7); // Strip "Bearer "

    // 2. Verify the JWT (throws on expiry / invalid signature / malformed)
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // 3. Fetch the user — ensures the account still exists
    const user = await User.findById(payload.userId).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // 4. Attach authenticated identity to the request
    req.user = {
      userId: user._id.toString(),
      role: user.role,
      name: user.name,
      email: user.email,
    };

    next();
  } catch (err) {
    // Unexpected server error — do not leak details
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }
}
