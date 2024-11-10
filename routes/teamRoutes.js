const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const User = require('../models/User');  // Correct path to your User model
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');
const nodemailer = require('nodemailer');

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    host: 'sandbox.smtp.mailtrap.io', 
  port: 587, 
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

// Function to send invitation email
const sendInvitationEmail = (to, teamName, inviterName) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `You've been invited to join the team: ${teamName}`,
        text: `Hello,\n\n${inviterName} has invited you to join the team "${teamName}".\n\nBest,\nTeam Management`,
    };

    return transporter.sendMail(mailOptions);
};

// Create a new team
router.post('/', authMiddleware, async (req, res) => {
    const { name } = req.body;
    const userId = req.user._id;

    try {
        if (!name) {
            return res.status(400).json({ error: 'Team name is required.' });
        }

        const newTeam = new Team({
            name,
            members: [{user: userId, role: 'User'}],
            creator: userId,
        });

        const savedTeam = await newTeam.save();
        res.status(201).json(savedTeam);
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(400).json({ error: 'Failed to create team' });
    }
});

// Retrieve all teams the authenticated user is a member of
router.get('/', authMiddleware, async (req, res) => {
    try {
        // Find teams where the current user is part of the members array
        const teams = await Team.find({ 'members.user': req.user._id });
        res.status(200).json(teams);
    } catch (error) {
        console.error('Failed to retrieve teams:', error);
        res.status(500).json({ error: 'Failed to retrieve teams' });
    }
});

// Retrieve a specific team by UUID (not ObjectId)
router.get('/:id', authMiddleware, async (req, res) => {
    const teamId = req.params.id;

    try {
        // Use the UUID field to query
        const team = await Team.findOne({ uuid: teamId });
        if (!team) {
            return res.status(404).json({ msg: 'Team not found' });
        }
        res.status(200).json(team);
    } catch (error) {
        console.error('Error retrieving team:', error);
        res.status(500).json({ error: 'Error retrieving team' });
    }
});

// Invite a member by email and create a notification
router.post('/:id/members', authMiddleware, async (req, res) => {
    const { email } = req.body;
    const teamId = req.params.id;

    // Check if the email is provided and valid
    if (!email || !email.trim()) {
        return res.status(400).json({ msg: 'Email is required and cannot be empty.' });
    }

    try {
        // Use the uuid field to find the team
        const team = await Team.findOne({ uuid: teamId });
        if (!team) {
            return res.status(404).json({ msg: 'Team not found' });
        }

        // Check if email already exists in the pendingInvites array
        const existingInvite = team.pendingInvites.find(invite => invite.email === email);
        if (existingInvite) {
            return res.status(400).json({ msg: 'This email has already been invited.' });
        }

        const inviterName = req.user.name || "Team Owner"; // Assuming the user object has a name

        // Send invitation email
        await sendInvitationEmail(email, team.name, inviterName);

        // Add the email to pending invites
        team.pendingInvites.push({ email });
        await team.save();

        // Find the user by email to get the user's ObjectId
        const recipientUser = await User.findOne({ email });
        if (!recipientUser) {
            return res.status(404).json({ msg: 'User with the given email not found' });
        }

        // Create a notification for the invited user
        const notification = new Notification({
            message: `${inviterName} has invited you to join the team "${team.name}".`,
            recipient: recipientUser._id,  // Use the ObjectId of the recipient
            read: false,
            type: 'team_invite',
            teamId: team._id,
        });

        await notification.save(); // Save the notification to the database

        res.status(200).json({ msg: 'Invitation sent and notification created successfully' });
    } catch (error) {
        console.error('Error sending invitation and creating notification:', error);
        res.status(500).json({ error: 'Error sending invitation and creating notification' });
    }
});

// Retrieve members of a specific team by ID
router.get('/:id/members', authMiddleware, async (req, res) => {
    const teamId = req.params.id;

    try {
        const team = await Team.findById(teamId).populate('members.user'); // Populate user details

        if (!team) {
            return res.status(404).json({ msg: 'Team not found' });
        }

        // Map through members to create an array of objects with user details
        const membersWithRoles = team.members.map(member => ({
            _id: member.user ? member.user._id : null,
            name: member.user ? member.user.firstName : 'Unknown Member',
            role: member.role || 'No Role',
        }));

        res.status(200).json(membersWithRoles);
    } catch (error) {
        console.error('Error retrieving members:', error);
        res.status(500).json({ error: 'Error retrieving members' });
    }
});

// Add a role to a team
router.patch('/:id/roles', authMiddleware, async (req, res) => {
    const { role } = req.body;
    const teamId = req.params.id;

    try {
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ msg: 'Team not found' });
        }

        if (!team.roles.includes(role)) {
            team.roles.push(role);
            await team.save();
        }

        res.status(200).json(team);
    } catch (error) {
        console.error('Error adding role:', error);
        res.status(500).json({ error: 'Error adding role' });
    }
});

// Delete a team
router.delete('/:id', authMiddleware, async (req, res) => {
    const teamId = req.params.id;

    try {
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ msg: 'Team not found' });
        }

        await Team.findByIdAndDelete(teamId);
        res.status(200).json({ msg: 'Team deleted successfully' });
    } catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({ error: 'Error deleting team' });
    }
});

// Error handling middleware
router.use((err, req, res, next) => {
    console.error('An error occurred:', err);
    res.status(500).json({ error: 'Something went wrong' });
});

module.exports = router;
