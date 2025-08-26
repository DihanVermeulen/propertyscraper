const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const AuthService = require('../services/AuthService');

// Rate limiting middleware
const createRateLimit = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({ error: message });
        }
    });
};

// Authentication rate limits
const authLimiter = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    20, // 20 attempts
    'Too many authentication attempts, please try again later'
);

const generalLimiter = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests
    'Too many requests, please try again later'
);

// Input validation middleware
const validateRegistration = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
    body('firstName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters')
];

const validateLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

const validatePasswordChange = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

// JWT authentication middleware
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        const decoded = AuthService.verifyAccessToken(token);
        
        // Get fresh user data
        const user = await AuthService.getUserById(decoded.userId);
        
        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Optional authentication (for endpoints that work with or without auth)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = AuthService.verifyAccessToken(token);
            const user = await AuthService.getUserById(decoded.userId);
            req.user = user;
            req.token = token;
        }
    } catch (error) {
        // Continue without authentication
        console.log('Optional auth failed:', error.message);
    }
    next();
};

// Role-based authorization middleware
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userRoles = Array.isArray(roles) ? roles : [roles];
        
        if (!userRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

// Admin only middleware
const requireAdmin = requireRole('admin');

// User or admin middleware
const requireUserOrAdmin = requireRole(['user', 'admin']);

// Admin panel access middleware
const requireAdminAccess = [
    authenticateToken,
    requireAdmin
];

// Protected route middleware (authenticated users only)
const requireAuth = [
    authenticateToken,
    requireUserOrAdmin
];

// Security headers middleware
const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
};

// CORS configuration for authentication endpoints
const corsConfig = {
    credentials: true,
    optionsSuccessStatus: 200
};

module.exports = {
    // Rate limiting
    authLimiter,
    generalLimiter,
    
    // Validation
    validateRegistration,
    validateLogin,
    validatePasswordChange,
    handleValidationErrors,
    
    // Authentication
    authenticateToken,
    optionalAuth,
    
    // Authorization
    requireRole,
    requireAdmin,
    requireUserOrAdmin,
    requireAdminAccess,
    requireAuth,
    
    // Security
    securityHeaders,
    corsConfig
};
