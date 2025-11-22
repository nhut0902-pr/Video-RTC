const pool = require('../db/connection');
const bcrypt = require('bcryptjs');

class User {
    static async create({ username, email, password, displayName }) {
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, display_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, email, display_name, created_at`,
            [username, email, passwordHash, displayName || username]
        );

        return result.rows[0];
    }

    static async findByUsername(username) {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        return result.rows[0];
    }

    static async findByEmail(email) {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0];
    }

    static async findById(id) {
        const result = await pool.query(
            'SELECT id, username, email, display_name, created_at FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    static async verifyPassword(user, password) {
        return await bcrypt.compare(password, user.password_hash);
    }
}

module.exports = User;
