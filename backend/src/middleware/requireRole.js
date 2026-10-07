/**
 * Role-Based Authorization Middleware
 *
 * Use AFTER requireAuth. These helpers check req.user.role (set by requireAuth)
 * against the permitted roles for a given route.
 *
 * Usage:
 *   import { requireRole, requireAnyRole } from '../middleware/requireRole.js';
 *
 *   // Only project_admin
 *   router.post('/', requireAuth, requireRole('project_admin'), handler);
 *
 *   // Faculty Coordinator OR Club Admin
 *   router.post('/:clubId/members', requireAuth, requireAnyRole('faculty_coordinator', 'club_admin'), handler);
 *
 * NOTE: Team Leader is NOT a role. It is a project-level position stored on
 * projects.teamLeaderId. Enforce Team Leader checks inside route handlers.
 *
 * Valid roles:
 *   student | faculty_coordinator | faculty_mentor | club_admin | project_admin
 */

/**
 * Require exactly one specific role.
 *
 * @param {string} role — The required role string
 * @returns Express middleware function
 */
export function requireRole(role) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
      });
    }
    next();
  };
}

/**
 * Require ANY of the listed roles (OR logic).
 *
 * @param {...string} roles — One or more acceptable role strings
 * @returns Express middleware function
 */
export function requireAnyRole(...roles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
      });
    }
    next();
  };
}
