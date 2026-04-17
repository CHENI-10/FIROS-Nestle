/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Usage: requireRole('admin', 'manager')
 * Must be chained AFTER verifyToken middleware so req.user is populated.
 * Returns 403 Forbidden if the authenticated user's role is not in the allowed list.
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ error: 'Forbidden. No role found in token.' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            console.log(`[RBAC] BLOCKED: User ${req.user.email} (role: ${req.user.role}) attempted to access route requiring [${allowedRoles.join(', ')}]`);
            return res.status(403).json({ 
                error: `Forbidden. This action requires role: ${allowedRoles.join(' or ')}.` 
            });
        }

        next();
    };
};

module.exports = { requireRole };
