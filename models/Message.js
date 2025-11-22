const pool = require('../db/connection');

class Message {
    static async create({ roomId, userId, message }) {
        const result = await pool.query(
            `INSERT INTO messages (room_id, user_id, message) 
       VALUES ($1, $2, $3) 
       RETURNING id, room_id, user_id, message, created_at`,
            [roomId, userId, message]
        );

        return result.rows[0];
    }

    static async getByRoom(roomId, limit = 50) {
        const result = await pool.query(
            `SELECT m.id, m.room_id, m.message, m.created_at,
              u.id as user_id, u.username, u.display_name
       FROM messages m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.room_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2`,
            [roomId, limit]
        );

        return result.rows.reverse(); // Return in chronological order
    }

    static async deleteByRoom(roomId) {
        await pool.query('DELETE FROM messages WHERE room_id = $1', [roomId]);
    }
}

module.exports = Message;
