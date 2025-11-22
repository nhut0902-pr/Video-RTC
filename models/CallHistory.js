const pool = require('../db/connection');

class CallHistory {
    static async create({ roomId, userId }) {
        try {
            const result = await pool.query(
                'INSERT INTO call_history (room_id, user_id) VALUES ($1, $2) RETURNING *',
                [roomId, userId]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Error creating call history:', error);
            throw error;
        }
    }

    static async endCall(id) {
        try {
            const result = await pool.query(
                `UPDATE call_history 
         SET left_at = CURRENT_TIMESTAMP,
             duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - joined_at))::INTEGER
         WHERE id = $1 RETURNING *`,
                [id]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Error ending call:', error);
            throw error;
        }
    }

    static async getByUser(userId, limit = 20) {
        try {
            const result = await pool.query(
                `SELECT ch.*, u.username, u.display_name
         FROM call_history ch
         LEFT JOIN users u ON ch.user_id = u.id
         WHERE ch.user_id = $1
         ORDER BY ch.created_at DESC
         LIMIT $2`,
                [userId, limit]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting call history:', error);
            throw error;
        }
    }
}

module.exports = CallHistory;
