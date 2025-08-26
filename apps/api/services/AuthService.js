const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const database = require('../db/database');

class AuthService {
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
        this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
        this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
        this.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
        this.BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        this.MAX_FAILED_ATTEMPTS = 5;
        this.LOCK_TIME = 30 * 60 * 1000; // 30 minutes
    }

    // Password hashing
    async hashPassword(password) {
        return await bcrypt.hash(password, this.BCRYPT_ROUNDS);
    }

    async comparePassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    // JWT token generation
    generateAccessToken(payload) {
        return jwt.sign(payload, this.JWT_SECRET, { 
            expiresIn: this.JWT_EXPIRES_IN,
            issuer: 'propertyscraper-api',
            audience: 'propertyscraper-web'
        });
    }

    generateRefreshToken(payload) {
        return jwt.sign(payload, this.JWT_REFRESH_SECRET, { 
            expiresIn: this.JWT_REFRESH_EXPIRES_IN,
            issuer: 'propertyscraper-api',
            audience: 'propertyscraper-web'
        });
    }

    // Token verification
    verifyAccessToken(token) {
        try {
            return jwt.verify(token, this.JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid or expired access token');
        }
    }

    verifyRefreshToken(token) {
        try {
            return jwt.verify(token, this.JWT_REFRESH_SECRET);
        } catch (error) {
            throw new Error('Invalid or expired refresh token');
        }
    }

    // User registration
    async registerUser(userData) {
        const { email, password, firstName, lastName } = userData;

        // Check if user already exists
        const existingUser = await database.get(
            'SELECT id FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (existingUser) {
            throw new Error('User with this email already exists');
        }

        // Hash password
        const passwordHash = await this.hashPassword(password);

        // Create user
        const result = await database.run(
            `INSERT INTO users (email, password_hash, first_name, last_name) 
             VALUES (?, ?, ?, ?)`,
            [email.toLowerCase(), passwordHash, firstName, lastName]
        );

        return {
            id: result.id,
            email: email.toLowerCase(),
            firstName,
            lastName,
            role: 'user'
        };
    }

    // User login
    async loginUser(email, password, ipAddress, userAgent) {
        email = email.toLowerCase();

        // Get user with login attempt tracking
        const user = await database.get(
            'SELECT * FROM users WHERE email = ? AND is_active = 1',
            [email]
        );

        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const lockTimeRemaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
            throw new Error(`Account locked. Try again in ${lockTimeRemaining} minutes`);
        }

        // Verify password
        const isPasswordValid = await this.comparePassword(password, user.password_hash);

        if (!isPasswordValid) {
            // Increment failed attempts
            const failedAttempts = (user.failed_login_attempts || 0) + 1;
            const lockUntil = failedAttempts >= this.MAX_FAILED_ATTEMPTS 
                ? new Date(Date.now() + this.LOCK_TIME).toISOString()
                : null;

            await database.run(
                'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
                [failedAttempts, lockUntil, user.id]
            );

            if (lockUntil) {
                throw new Error('Account locked due to too many failed attempts');
            }

            throw new Error('Invalid credentials');
        }

        // Reset failed attempts and update last login
        await database.run(
            'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );

        // Generate tokens
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role
        };

        const accessToken = this.generateAccessToken(payload);
        const refreshToken = this.generateRefreshToken({ userId: user.id });

        // Store refresh token
        await this.storeRefreshToken(user.id, refreshToken);

        // Create session
        await this.createSession(user.id, accessToken, ipAddress, userAgent);

        return {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            },
            accessToken,
            refreshToken
        };
    }

    // Store refresh token
    async storeRefreshToken(userId, refreshToken) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Clean up old tokens
        await database.run(
            'DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < CURRENT_TIMESTAMP',
            [userId]
        );

        // Store new token
        await database.run(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [userId, tokenHash, expiresAt.toISOString()]
        );
    }

    // Create user session
    async createSession(userId, sessionToken, ipAddress, userAgent) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Clean up old sessions
        await database.run(
            'DELETE FROM user_sessions WHERE user_id = ? AND expires_at < CURRENT_TIMESTAMP',
            [userId]
        );

        // Create new session
        await database.run(
            `INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, expires_at) 
             VALUES (?, ?, ?, ?, ?)`,
            [userId, sessionToken, ipAddress, userAgent, expiresAt.toISOString()]
        );
    }

    // Refresh access token
    async refreshAccessToken(refreshToken) {
        // Verify refresh token
        let decoded;
        try {
            decoded = this.verifyRefreshToken(refreshToken);
        } catch (error) {
            throw new Error('Invalid refresh token');
        }

        // Check if refresh token exists in database
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const storedToken = await database.get(
            'SELECT * FROM refresh_tokens WHERE token_hash = ? AND is_revoked = 0 AND expires_at > CURRENT_TIMESTAMP',
            [tokenHash]
        );

        if (!storedToken) {
            throw new Error('Refresh token not found or expired');
        }

        // Get user
        const user = await database.get(
            'SELECT * FROM users WHERE id = ? AND is_active = 1',
            [decoded.userId]
        );

        if (!user) {
            throw new Error('User not found');
        }

        // Generate new access token
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role
        };

        const newAccessToken = this.generateAccessToken(payload);

        return {
            accessToken: newAccessToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            }
        };
    }

    // Logout user
    async logoutUser(refreshToken, accessToken) {
        if (refreshToken) {
            // Revoke refresh token
            const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
            await database.run(
                'UPDATE refresh_tokens SET is_revoked = 1 WHERE token_hash = ?',
                [tokenHash]
            );
        }

        if (accessToken) {
            // Remove session
            await database.run(
                'DELETE FROM user_sessions WHERE session_token = ?',
                [accessToken]
            );
        }
    }

    // Get user by ID
    async getUserById(userId) {
        const user = await database.get(
            'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (!user) {
            throw new Error('User not found');
        }

        return {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            isActive: user.is_active,
            createdAt: user.created_at
        };
    }

    // Update user password
    async updatePassword(userId, currentPassword, newPassword) {
        const user = await database.get(
            'SELECT password_hash FROM users WHERE id = ?',
            [userId]
        );

        if (!user) {
            throw new Error('User not found');
        }

        // Verify current password
        const isCurrentPasswordValid = await this.comparePassword(currentPassword, user.password_hash);
        if (!isCurrentPasswordValid) {
            throw new Error('Current password is incorrect');
        }

        // Hash new password
        const newPasswordHash = await this.hashPassword(newPassword);

        // Update password
        await database.run(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newPasswordHash, userId]
        );

        // Revoke all refresh tokens to force re-login
        await database.run(
            'UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ?',
            [userId]
        );
    }

    // Admin: Get all users
    async getAllUsers(limit = 50, offset = 0) {
        return await database.query(
            `SELECT id, email, first_name, last_name, role, is_active, last_login, created_at 
             FROM users 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
    }

    // Admin: Update user role
    async updateUserRole(userId, newRole) {
        const validRoles = ['admin', 'user', 'viewer'];
        if (!validRoles.includes(newRole)) {
            throw new Error('Invalid role');
        }

        await database.run(
            'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newRole, userId]
        );
    }

    // Admin: Deactivate user
    async deactivateUser(userId) {
        await database.run(
            'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [userId]
        );

        // Revoke all tokens
        await database.run(
            'UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ?',
            [userId]
        );

        // Remove sessions
        await database.run(
            'DELETE FROM user_sessions WHERE user_id = ?',
            [userId]
        );
    }
}

module.exports = new AuthService();
