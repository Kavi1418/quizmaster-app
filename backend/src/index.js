import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
app.use(cors());
app.use(express.json());
const prisma = new PrismaClient();
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.on('error', (err) => console.log('Redis Client Error', err));
async function startServer() {
    try {
        await redisClient.connect();
        console.log('Connected to Redis');
    }
    catch (error) {
        console.error('Failed to connect to Redis', error);
    }
    app.get('/', (req, res) => {
        res.send('QuizMaster Backend is running');
    });
    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);
        socket.on('create_room', async ({ hostName }, callback) => {
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            socket.join(roomCode);
            await redisClient.set(`room:${roomCode}:host`, socket.id);
            console.log(`Room created: ${roomCode} by ${hostName}`);
            callback({ roomCode });
        });
        socket.on('join_room', async ({ roomCode, username }, callback) => {
            // Check if room exists (if host key exists)
            const hostExists = await redisClient.exists(`room:${roomCode}:host`);
            if (!hostExists) {
                return callback({ success: false, error: 'Room not found' });
            }
            socket.join(roomCode);
            const player = { id: socket.id, username, score: 0 };
            await redisClient.sAdd(`room:${roomCode}:players`, JSON.stringify(player));
            // Broadcast to room
            io.to(roomCode).emit('player_joined', player);
            console.log(`${username} joined room ${roomCode}`);
            callback({ success: true });
        });
        socket.on('start_quiz', ({ roomCode }) => {
            io.to(roomCode).emit('quiz_started');
            console.log(`Quiz started in room ${roomCode}`);
        });
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            // Clean up player from room logic here
        });
    });
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
startServer();
