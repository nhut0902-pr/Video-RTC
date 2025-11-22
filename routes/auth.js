const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Signup
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password, displayName } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email và password là bắt buộc' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        // Check if user exists
        const existingUser = await User.findByUsername(username);
        if (existingUser) {
            return res.status(400).json({ error: 'Username đã tồn tại' });
        }

        const existingEmail = await User.findByEmail(email);
        if (existingEmail) {
            return res.status(400).json({ error: 'Email đã được sử dụng' });
        }

        // Create user
        const user = await User.create({ username, email, password, displayName });

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Đăng ký thành công',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                displayName: user.display_name
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username và password là bắt buộc' });
        }

        // Find user
        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Username hoặc password không đúng' });
        }

        // Verify password
        const isValid = await User.verifyPassword(user, password);
        if (!isValid) {
            return res.status(401).json({ error: 'Username hoặc password không đúng' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Đăng nhập thành công',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                displayName: user.display_name
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User không tồn tại' });
        }

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.display_name
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

module.exports = router;
