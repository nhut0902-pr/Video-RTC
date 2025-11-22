const express = require('express');
const Message = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get messages for a room
router.get('/:roomId', authenticateToken, async (req, res) => {
    try {
        const { roomId } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        const messages = await Message.getByRoom(roomId, limit);
        res.json(messages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

module.exports = router;
