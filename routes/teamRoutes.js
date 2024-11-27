const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const User = require('../models/User');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');
const nodemailer = require('nodemailer');

// Nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER,
  port: 587, 
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

const sendInvitationEmail = (to, teamName, inviterName, recipientName) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `Hello ${recipientName}! You've been invited to join the team: ${teamName}`,
        html: `
            <html>
                <head>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');
                        body {
                            font-family: 'Poppins', sans-serif;
                            background-color: #000;
                            color: #fff;
                            margin: 0;
                            padding: 0;
                        }
                        .container {
                            background-color: #1F1F1F;
                            border-radius: 8px;
                            padding: 40px;
                            max-width: 700px;
                            margin: 30px auto;
                            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                        }
                        .header img {
                            width: 150px;
                            margin-bottom: 50px;
                        }
                        .header h1 {
                            font-size: 28px;
                            color: #fff;
                            margin: 0;
                        }
                        .content {
                            font-size: 16px;
                            line-height: 1.6;
                            color: #b9b9bd;
                        }
                        .content strong {
                            color: #fff;
                        }
                        .content p {
                            margin-bottom: 20px;
                        }
                        .button-container {
                            text-align: center;
                            margin-top: 30px;
                        }
                        .team {
                            color: #34499A;
                        }
                        .share {
                            color: #D77D31;
                        }
                        .sub {
                            color: #fff;
                            font-size: 2rem;
                        }
                        .btn {
                            background-color: none;
                            color: #fff;
                            padding: 12px 30px;
                            text-decoration: none;
                            font-weight: bold;
                            font-size: 1.2rem;
                            border-radius: 5px;
                            text-transform: uppercase;
                            transition: background-color 0.3s ease;
                        }
                        .btn:hover {
                            background-color: #fff;
                            color: #000;
                        }
                        .footer {
                            text-align: center;
                            font-size: 14px;
                            color: #888;
                            margin-top: 40px;
                        }
                        .footer p {
                            margin: 10px 0;
                        }

                        /* Mobile responsiveness */
                        @media screen and (max-width: 600px) {
                            .container {
                                padding: 20px;
                                max-width: 100%;
                            }
                            .header img {
                                width: 120px;
                                margin-bottom: 30px;
                            }
                            .header h1 {
                                font-size: 24px;
                            }
                            .content {
                                font-size: 14px;
                            }
                            .btn {
                                font-size: 1rem;
                                padding: 10px 25px;
                            }
                            .footer {
                                font-size: 12px;
                            }
                            .sub {
                                font-size: 1.5rem;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <!-- Add your logo here -->
                            <img src="https://teamsharenetwork.netlify.app/logo.png" alt="Team Logo" />
                            <h1>You're Invited to Join "${teamName}"</h1>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${recipientName}</strong>,</p>
                            <p><strong>${inviterName}</strong> has invited you to join the team <strong>"${teamName}"</strong>.</p>
                            <p>We're excited to have you on board! Click the button below to accept the invitation and become part of our awesome team.</p>
                            <p>If you have any questions or need assistance, feel free to reach out to us anytime. We’re here to help!</p>
                        </div>
                        <div class="button-container">
                            <a href="http://teamsharenetwork.netlify.app/home" class="btn">Accept Invitation</a>
                        </div>
                        <div class="footer">
                            <p>Best regards,</p>
                            <p class="sub"><strong><span class="team">Team</span><span class="share">Share</span> Network</strong></p>
                            <p><em>We're excited to have you with us!</em></p>
                        </div>
                    </div>
                </body>
            </html>
        `,
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
            pendingInvites: [],
        });

        newTeam.pendingInvites = newTeam.pendingInvites.filter(invite => invite.email != null && invite.email.trim() !== '');

        const savedTeam = await newTeam.save();
        res.status(201).json(savedTeam);
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(400).json({ error: 'Failed to create team' });
    }
});

// get all teams for the user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const teams = await Team.find({ 'members.user': req.user._id });
        res.status(200).json(teams);
    } catch (error) {
        console.error('Failed to retrieve teams:', error);
        res.status(500).json({ error: 'Failed to retrieve teams' });
    }
});

// get a team by uuid
router.get('/:id', authMiddleware, async (req, res) => {
    const teamId = req.params.id;

    try {
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

// Update the team name
router.patch('/:id/name', authMiddleware, async (req, res) => {
    const teamId = req.params.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ msg: 'Team name is required and cannot be empty.' });
    }

    try {
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ msg: 'Team not found' });
        }

        team.name = name;
        await team.save();

        res.status(200).json({
            msg: 'Team name updated successfully',
            team: {
                _id: team._id,
                name: team.name,
                creator: team.creator,
                members: team.members,
            },
        });
    } catch (error) {
        console.error('Error updating team name:', error);
        res.status(500).json({ error: 'Error updating team name' });
    }
});


// invite a person to team by mail and send notification
router.post('/:id/members', authMiddleware, async (req, res) => {
    const { email } = req.body;
    const teamId = req.params.id;

    if (!email || !email.trim()) {
        return res.status(400).json({ msg: 'Email is required and cannot be empty.' });
    }

    const validEmailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!validEmailRegex.test(email)) {
        return res.status(400).json({ msg: 'Invalid email address.' });
    }

    try {
        const team = await Team.findOne({ uuid: teamId });
        if (!team) {
            return res.status(404).json({ msg: 'Team not found' });
        }
        const existingInvite = team.pendingInvites.find(invite => invite.email === email);
        if (existingInvite) {
            return res.status(400).json({ msg: 'This email has already been invited.' });
        }

        const recipientUser = await User.findOne({ email });
        if (!recipientUser) {
            return res.status(404).json({ msg: 'User with the given email not found' });
        }
        
        const inviterName = `${req.user.firstName} ${req.user.lastName}` || "Team Owner";
        const recipientName = `${recipientUser.firstName} ${recipientUser.lastName}`;

        await sendInvitationEmail(email, team.name, inviterName, recipientName);

        team.pendingInvites.push({ email: email.trim() });

        await team.save();

        // Create notification
        const notification = new Notification({
            message: `${inviterName} has invited you to join the team "${team.name}".`,
            recipient: recipientUser._id,
            read: false,
            type: 'team_invite',
            teamId: team._id,
        });

        await notification.save();

        res.status(200).json({ msg: 'Invitation sent and notification created successfully' });
    } catch (error) {
        console.error('Error sending invitation and creating notification:', error);
        res.status(500).json({ error: 'Error sending invitation and creating notification' });
    }
});



// Remove a member from the team
router.delete('/:id/members/:userId', authMiddleware, async (req, res) => {
    const { id: teamId, userId } = req.params;

    try {
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ msg: 'Team not found' });
        }

        const memberIndex = team.members.findIndex((member) => member.user.toString() === userId);
        if (memberIndex === -1) {
            return res.status(404).json({ msg: 'User not found in the team' });
        }

        team.members.splice(memberIndex, 1);

        await team.save();

        res.status(200).json({ msg: 'Member removed successfully' });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: 'Error removing member from the team' });
    }
});


// get all team members by id
router.get('/:id/members', authMiddleware, async (req, res) => {
    const teamId = req.params.id;

    try {
        const team = await Team.findById(teamId)
            .populate({
                path: 'members.user',
                select: 'firstName lastName profileImage email'
            });

        if (!team) {
            return res.status(404).json({ msg: 'Team not found' });
        }

        const membersWithRoles = team.members.map(member => ({
            _id: member.user ? member.user._id : null,
            name: member.user ? `${member.user.firstName} ${member.user.lastName}` : 'Unknown Member',
            profileImage: member.user.profileImage,
            email: member.user.email,
            role: member.role || 'No Role',
        }));

        res.status(200).json(membersWithRoles);
    } catch (error) {
        console.error('Error retrieving members:', error);
        res.status(500).json({ error: 'Error retrieving members' });
    }
});

// Create a new role
router.patch('/:id/roles', authMiddleware, async (req, res) => {
    const { role } = req.body;
    const teamId = req.params.id;

    if (!role) {
        return res.status(400).json({ msg: 'Role is required' });
    }

    try {
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ msg: 'Team not found' });
        }
        const formattedRole = role
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

        if (!team.roles.includes(formattedRole)) {
            team.roles.push(formattedRole);
            await team.save();
        }

        res.status(200).json({ msg: 'Role added successfully', team });
    } catch (error) {
        console.error('Error adding role:', error);
        res.status(500).json({ error: 'Error adding role' });
    }
});

// Get all roles of a team
router.get('/:id/roles', authMiddleware, async (req, res) => {
    const teamId = req.params.id;

    try {
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ msg: 'Team not found' });
        }

        res.status(200).json({
            roles: team.roles || []
        });
    } catch (error) {
        console.error('Error retrieving roles:', error);
        res.status(500).json({ error: 'Error retrieving roles' });
    }
});


// Assign a role to a user in a team
router.patch('/:teamId/members/:userId/role', authMiddleware, async (req, res) => {
    const { teamId, userId } = req.params;
    const { role } = req.body;

    try {
        // Find the team
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ msg: 'Team not found' });
        }

        if (!team.roles.includes(role)) {
            return res.status(400).json({ msg: `Invalid role. Available roles are: ${team.roles.join(', ')}` });
        }

        const member = team.members.find(m => m.user.toString() === userId);
        if (!member) {
            return res.status(404).json({ msg: 'User not found in the team' });
        }

        member.role = role;

        await team.save();

        res.status(200).json({
            msg: 'Role updated successfully',
            updatedMember: member,
        });
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ error: 'Error updating role' });
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
