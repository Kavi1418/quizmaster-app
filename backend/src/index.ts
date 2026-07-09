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

import authRoutes from './routes/auth';
import quizRoutes from './routes/quiz';
import aiRoutes from './routes/ai';
import leaderboardRoutes from './routes/leaderboard';
import shopRoutes from './routes/shop';

app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/shop', shopRoutes);

redisClient.on('error', (err) => console.log('Redis Client Error', err));

async function startServer() {
  redisClient.connect()
    .then(() => {
      console.log('Connected to Redis');
    })
    .catch((error) => {
      console.error('Failed to connect to Redis', error);
    });

  app.get('/', (req, res) => {
    res.send('QuizMaster Backend is running');
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('create_room', async ({ hostName, questions, isAutoStart, quizId, theme, gameMode }, callback) => {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      socket.join(roomCode);
      
      // Save room info to Redis
      await redisClient.set(`room:${roomCode}:host`, socket.id);
      await redisClient.set(`room:${roomCode}:isAutoStart`, isAutoStart ? 'true' : 'false');
      await redisClient.set(`room:${roomCode}:questions`, JSON.stringify(questions));
      if (quizId) await redisClient.set(`room:${roomCode}:quizId`, quizId);
      if (theme) await redisClient.set(`room:${roomCode}:theme`, theme);
      if (gameMode) await redisClient.set(`room:${roomCode}:gameMode`, gameMode);
      
      console.log(`Room created: ${roomCode} by ${hostName} | AutoStart: ${isAutoStart} | Mode: ${gameMode}`);
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
      
      // Get room settings
      const isAutoStr = await redisClient.get(`room:${roomCode}:isAutoStart`);
      const isAutoStart = isAutoStr === 'true';
      const quizId = await redisClient.get(`room:${roomCode}:quizId`);
      const theme = await redisClient.get(`room:${roomCode}:theme`) || 'default';
      const gameMode = await redisClient.get(`room:${roomCode}:gameMode`) || 'classic';
      
      let questions = [];
      const questionsStr = await redisClient.get(`room:${roomCode}:questions`);
      if (questionsStr) questions = JSON.parse(questionsStr);
      
      // Broadcast to room
      io.to(roomCode).emit('player_joined', player);
      console.log(`${username} joined room ${roomCode}`);
      
      callback({ success: true, isAutoStart, questions, quizId, theme, gameMode });
    });

    socket.on('start_quiz', ({ roomCode }) => {
      io.to(roomCode).emit('quiz_started');
      console.log(`Quiz started in room ${roomCode}`);
    });

    socket.on('update_score', ({ roomCode, username, score }) => {
      // Broadcast the updated score to the host and everyone else in the room
      io.to(roomCode).emit('player_score_updated', { id: socket.id, username, score });
    });

    socket.on('player_answered', ({ roomCode, questionIndex, optionIndex }) => {
      // Broadcast to host for live analytics
      io.to(roomCode).emit('player_answered', { questionIndex, optionIndex });
    });

    socket.on('use_powerup', ({ roomCode, username, powerupType, targetUser }) => {
      // Broadcast the powerup to the room
      io.to(roomCode).emit('powerup_used', { username, powerupType, targetUser });
    });

    socket.on('boss_damaged', ({ roomCode, username, damage }) => {
      io.to(roomCode).emit('boss_damaged', { username, damage });
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
