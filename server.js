const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const User = require('./models/User');
const Message = require('./models/Message');
const authRoutes = require('./routes/auth');
const messagesRoutes = require('./routes/messages');
const callHistoryRoutes = require('./routes/callHistory');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());

// CORS for production
const cors = require('cors');
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// API Routes - MUST be before static files
app.use('/api/auth', authRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/calls', callHistoryRoutes);

// Static files - MUST be after API routes
app.use(express.static(path.join(__dirname)));

// Initialize database tables
const pool = require('./db/connection');
const fs = require('fs');

async function initDatabase() {
    try {
        const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
        await pool.query(schema);
        console.log('✅ Database tables initialized');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
    }
}

initDatabase();

// Socket.IO
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join-room', (roomId, userId) => {
        console.log(`User ${userId} joined room ${roomId}`);
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userId);

        socket.on('disconnect', () => {
            console.log(`User ${userId} disconnected`);
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });

    // Relay signaling messages
    socket.on('offer', (payload) => {
        io.to(payload.target).emit('offer', payload);
    });

    socket.on('answer', (payload) => {
        io.to(payload.target).emit('answer', payload);
    });

    socket.on('ice-candidate', (payload) => {
        io.to(payload.target).emit('ice-candidate', payload);
    });

    // Chat messages - save to database
    socket.on('chat-message', async (payload) => {
        try {
            // Save to database if user is authenticated
            if (payload.userId) {
                await Message.create({
                    roomId: payload.roomId,
                    userId: payload.userId,
                    message: payload.message
                });
            }

            // Broadcast to room
            io.to(payload.roomId).emit('chat-message', payload);
        } catch (error) {
            console.error('Error saving message:', error);
            // Still broadcast even if save fails
            io.to(payload.roomId).emit('chat-message', payload);
        }
    });

    // Emoji reactions
    socket.on('emoji-reaction', (payload) => {
        io.to(payload.roomId).emit('emoji-reaction', payload);
    });

    // Typing indicators
    socket.on('typing-start', ({ roomId, userId, username }) => {
        socket.to(roomId).emit('user-typing', { userId, username });
    });

    socket.on('typing-stop', ({ roomId, userId }) => {
        socket.to(roomId).emit('user-stopped-typing', { userId });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
