import jwt from 'jsonwebtoken';

/** Sign a token exactly the way authRoutes.signToken does. */
export function tokenFor(user, options = {}) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h', ...options }
  );
}

/** Ready-to-use `.set()` argument for supertest. */
export function authHeader(user) {
  return { Authorization: `Bearer ${tokenFor(user)}` };
}

/** A syntactically valid but expired token for this user. */
export function expiredTokenFor(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: -60 }
  );
}

/** A token signed with the wrong secret. */
export function foreignTokenFor(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    'a-different-secret-entirely'
  );
}
