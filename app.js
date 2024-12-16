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
const nodemailer = require('nodemailer');

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



// =================== Nodemailer and Cron Job Setup =================== //

// Configure Nodemailer transporter
let transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER,
  port: 587, 
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Error configuring Nodemailer transporter:', error);
  } else {
    console.log('Nodemailer transporter is configured correctly.');
  }
});

// Email sending function
const sendEmail = async () => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'aniketclass11b2@gmail.com',
    subject: 'You’re Invited To The Diddy Party!',
    html: `
    <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>You Are Invited to Diddy Party</title>
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');
              body {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                  font-family: 'Poppins', sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: linear-gradient(135deg, #ffe6e6, #ffd6ff), url('https://i.ibb.co/cyVGqJz/pngfind-com-png-wallpaper-2337329-1.png');
                  background-blend-mode: overlay;
                  background-size: contain;
                  background-position: center;
                  min-height: 100vh;
                  color: #333;
                  text-align: center;
              }

              .container {
                  max-width: 70%;
                  padding: 20px;
                  border: 3px solid #ffb3b3;
                  border-radius: 15px;
                  background: rgba(255, 255, 255, 0.9);
                  box-shadow: 0px 8px 20px rgba(255, 182, 193, 0.5);
              }

              h1 {
                  font-size: 2.8rem;
                  margin: 0;
                  color: #ff6f91;
                  text-shadow: 0px 4px 6px rgba(255, 105, 135, 0.5);
              }

              .subtext {
                  font-size: 1.5rem;
                  margin: 20px 0;
                  line-height: 1.8;
                  color: #555;
              }

              .image {
                  margin: 20px 0;
              }

              .image img {
                  max-width: 100%;
                  border-radius: 15px;
                  box-shadow: 0px 6px 15px rgba(255, 105, 135, 0.5);
              }

              .cta {
                  font-size: 2rem;
                  color: #ff6f91;
                  margin-top: 30px;
                  text-transform: uppercase;
                  letter-spacing: 2px;
                  text-shadow: 0px 2px 5px rgba(255, 105, 135, 0.5);
              }

              .contact-info {
                  font-size: 1rem;
                  color: #555;
                  margin-top: 20px;
              }

              .contact-info a {
                  color: #ff6f91;
                  text-decoration: none;
              }

              .contact-info a:hover {
                  text-decoration: underline;
              }
              .text-break{
                  display: none;
              }
              .contact-item.email-space {
                visibility: visible !important;
              }

              @media (max-width: 768px) {
                  h1 {
                      font-size: 2rem;
                  }

                  .subtext {
                      font-size: 1rem;
                  }

                  .cta {
                      font-size: 1rem;
                  }
                  .text-break{
                      display: block;
                  }
                  .contact-item.email-space {
                    visibility: hidden !important;
                  }
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>You have been invited to The Diddy Party!</h1>
              <p class="subtext">This is your chance to get <strong>diddled</strong>!🍆 Yours and yours only chance where a thousand other celebs will cum!💦 <strong><br>THE DIDDY PARTY: THE BEST PARTY!!!</strong></p>

              <div class="image">
                  <img src="https://i.ibb.co/WBN4DQv/518acd0a524d9c0723ecd4c5daede983.jpg" alt="Diddy Party Meme">
              </div>

              <p class="cta">Save the Date & Don't forget to bring baby oil and lube!🧴👶💧</p>

              <!-- Contact Info Section -->
              <div class="contact-info">
                  <p><strong>If you wanna get oiled up fast contact me at:</strong></p>
                  <p>
                      <span class="contact-item email" style="display: inline-block;">
                          <a href="mailto:pr@combsglobal.com">pr@combsglobal.com</a>
                      </span>
                      <!-- For Desktop: Add space only in PC mode -->
                      <span class="contact-item email-space" style="display: inline-block; visibility: hidden;">
                          <span style="visibility: visible;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                      </span>
                      <br class="text-break">
                      <span class="contact-item phone">
                          <a href="tel:+19177461444">+1 (917) 746-1444</a>
                      </span>
                  </p>
              </div>
          </div>
      </body>
      </html>
    `
};

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully at', new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// Schedule the task to run on the 17th of every month at 9:00 AM IST
cron.schedule('50 21 16 * *', () => {
  console.log('Running email sending task on the 17th of the month at 9:00 AM IST...');
  sendEmail();
}, {
  timezone: 'Asia/Kolkata', // Specify the timezone
});

// ======================================================================= //



module.exports = app;
