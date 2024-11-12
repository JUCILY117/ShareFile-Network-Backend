const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const Team = require('../models/Team');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

// create a new notification
router.post('/', authMiddleware, async (req, res) => {
  const { message, recipient } = req.body;

  try {
    const newNotification = new Notification({
      message,
      recipient,
    });

    await newNotification.save();
    res.status(201).json({ msg: 'Notification created' });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// retrieve all notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Delete a notification
router.delete('/:id', authMiddleware, async (req, res) => {
  const notificationId = req.params.id;

  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    await notification.deleteOne();
    res.status(200).json({ msg: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Mark as read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  const notificationId = req.params.id;

  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    notification.read = true;
    await notification.save();
    res.status(200).json({ msg: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Accept a team invite
router.post('/accept-invite', authMiddleware, async (req, res) => {
  const { teamId } = req.body;
  const userId = req.user._id;

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ msg: 'Team not found' });
    }

    const isAlreadyMember = team.members.some(member => member.user.toString() === userId.toString());
    if (isAlreadyMember) {
      return res.status(400).json({ msg: 'You are already a member of this team' });
    }

    team.members.push({
      user: userId,
      role: 'User',
    });

    await team.save();

    await Notification.deleteMany({ recipient: userId, teamId, type: 'team_invite' });

    res.status(200).json({ msg: 'Invite accepted and user added to the team' });
  } catch (error) {
    console.error('Error accepting invite:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});


// Reject a team invite
router.post('/reject-invite', authMiddleware, async (req, res) => {
  const { notificationId } = req.body;
  const userId = req.user._id;

  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    if (notification.type !== 'team_invite') {
      return res.status(400).json({ msg: 'Not a team invite' });
    }

    await notification.deleteOne();

    res.status(200).json({ msg: 'Invite rejected and notification deleted' });
  } catch (error) {
    console.error('Error rejecting invite:', error);
    res.status(500).json({ error: 'Failed to reject invite' });
  }
});

module.exports = router;
