const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const folderRoutes = require('./routes/folderRoutes');
const teamRoutes = require('./routes/teamRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
require('dotenv').config();
const path = require('path');
const authMiddleware = require('./middleware/authMiddleware');
const axios = require('axios');
const cron = require('node-cron');
const http = require('http');
const socketIo = require('socket.io');

const app = express();

const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
});

connectDB();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ extended: false }));

const allowedOrigins = [
  'http://localhost:5173',
  'https://sharefilenetwork.netlify.app',
  'https://teamsharenetwork.netlify.app',
  'https://sharefilenetwork.onrender.com',
  'http://localhost:5174',
  'http://localhost:5000',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));

app.get('/', (req, res) => {
  res.end('Server is Up and Running!');
});


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/trash', express.static(path.join(__dirname, 'trash')));

// All routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', authRoutes);
app.use('/api/files', fileRoutes, authMiddleware);
app.use('/api/folders', folderRoutes, authMiddleware);
app.use('/api/teams', teamRoutes, authMiddleware);
app.use('/api/chat', chatRoutes(io), authMiddleware);
app.use('/api/notifications', notificationRoutes, authMiddleware);

app.get('/api/files/:filename', authMiddleware, (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  res.sendFile(filePath);
});

app.get('/api/auth/verified', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'verified.html'));
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('newChatMessage', (message) => {
    io.emit('chatMessage', message);
  });

  socket.on('sendNotification', (notification) => {
    io.emit('notification', notification);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Self-ping to prevent Render from sleeping
const SELF_PING_URL = process.env.BASE_API || `http://localhost:${process.env.PORT || 5000}`;

cron.schedule('*/14 * * * *', async () => {
  try {
    const response = await axios.get(SELF_PING_URL);
    console.log('Server pinged successfully to prevent sleep.');
  } catch (error) {
    console.error('Error pinging the server:', error);
  }
});

module.exports = app;
