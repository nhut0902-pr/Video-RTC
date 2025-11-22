const express = require('express');
const CallHistory = require('../models/CallHistory');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get call history for current user
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const history = await CallHistory.getByUser(req.user.id);
        res.json(history);
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Start a call (create call history entry)
router.post('/start', authenticateToken, async (req, res) => {
    try {
        const { roomId } = req.body;

        if (!roomId) {
            return res.status(400).json({ error: 'Room ID là bắt buộc' });
        }

        const call = await CallHistory.create({ roomId, userId: req.user.id });
        res.json(call);
    } catch (error) {
        console.error('Start call error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// End a call (update call history entry)
router.post('/end/:id', authenticateToken, async (req, res) => {
    try {
        const call = await CallHistory.endCall(req.params.id);
        res.json(call);
    } catch (error) {
        console.error('End call error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

module.exports = router;
