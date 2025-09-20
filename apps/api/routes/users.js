const express = require('express');
const router = express.Router();
const AuthService = require('../services/AuthService');
const {
    authLimiter,
    generalLimiter,
    validateRegistration,
    validateLogin,
    validatePasswordChange,
    handleValidationErrors,
    authenticateToken,
    optionalAuth,
    requireAuth,
    requireAdminAccess,
    securityHeaders
} = require('../middleware/auth');

// Apply security headers to all routes
router.use(securityHeaders);

// Public routes with rate limiting
router.use('/auth', authLimiter);
router.use(generalLimiter);

// User Registration
router.post('/auth/register', validateRegistration, handleValidationErrors, async (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body;
        
        const user = await AuthService.registerUser({
            email,
            password,
            firstName,
            lastName
        });

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message });
    }
});

// User Login
router.post('/auth/login', validateLogin, handleValidationErrors, async (req, res) => {
    try {
        console.log("🚀 ~ router.post ~ req.body:", req.body)
        const { email, password } = req.body;
        console.log("🚀 ~ router.post ~ req.body:", req.body)
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        const result = await AuthService.loginUser(email, password, ipAddress, userAgent);

        // Set refresh token as httpOnly cookie
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-site cookies in production
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            message: 'Login successful',
            user: result.user,
            accessToken: result.accessToken
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: error.message });
    }
});

// Refresh Access Token
router.post('/auth/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
        
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }

        const result = await AuthService.refreshAccessToken(refreshToken);

        res.json({
            accessToken: result.accessToken,
            user: result.user
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({ error: error.message });
    }
});

// User Logout
router.post('/auth/logout', authenticateToken, async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        const accessToken = req.token;

        await AuthService.logoutUser(refreshToken, accessToken);

        // Clear refresh token cookie
        res.clearCookie('refreshToken');

        res.json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Get Current User Profile
router.get('/profile', ...requireAuth, async (req, res) => {
    try {
        res.json({ user: req.user });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update User Password
router.put('/profile/password', ...requireAuth, validatePasswordChange, handleValidationErrors, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        await AuthService.updatePassword(req.user.id, currentPassword, newPassword);

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password update error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Admin Routes
// Get All Users (Admin only)
router.get('/admin/users', ...requireAdminAccess, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;

        const rawUsers = await AuthService.getAllUsers(limit, offset);
        
        // Transform user data to match frontend interface
        const users = rawUsers.map(user => ({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            isActive: Boolean(user.is_active),
            lastLogin: user.last_login,
            createdAt: user.created_at
        }));

        res.json({
            users,
            pagination: {
                page,
                limit,
                hasMore: users.length === limit
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Update User Role (Admin only)
router.put('/admin/users/:id/role', ...requireAdminAccess, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({ error: 'Role is required' });
        }

        await AuthService.updateUserRole(userId, role);

        res.json({ message: 'User role updated successfully' });
    } catch (error) {
        console.error('Role update error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Deactivate User (Admin only)
router.put('/admin/users/:id/deactivate', ...requireAdminAccess, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot deactivate your own account' });
        }

        await AuthService.deactivateUser(userId);

        res.json({ message: 'User deactivated successfully' });
    } catch (error) {
        console.error('User deactivation error:', error);
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
});

module.exports = router;
