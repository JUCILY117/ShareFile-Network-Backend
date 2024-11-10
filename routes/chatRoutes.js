const express = require('express');
const Chat = require('../models/Chat');
const authMiddleware = require('../middleware/authMiddleware');

const chatRoutes = (io) => {
  const router = express.Router();

  // Send a chat message
router.post('/', authMiddleware, async (req, res) => {
  const { teamId, message } = req.body;
  const senderId = req.user._id;

  try {
    const chatMessage = new Chat({
      team: teamId,
      sender: senderId,
      message,
    });
    await chatMessage.save();

    // Populate sender details for the real-time message
    const populatedMessage = await chatMessage.populate('sender', 'firstName lastName profileImage');

    // Emit the new message to all clients
    io.emit('chatMessage', populatedMessage);

    res.status(201).json(chatMessage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


  // Get chat messages for a team
  router.get('/:teamId', authMiddleware, async (req, res) => {
    try {
      const messages = await Chat.find({ team: req.params.teamId })
        .populate('sender', 'firstName lastName profileImage')
        .sort({ createdAt: 1 });
      res.status(200).json(messages);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
};

module.exports = chatRoutes;
