const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserVerification = require('../models/userVerification');
const PasswordReset = require('../models/passwordReset');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const apiBaseUrl = process.env.BASE_API;

const router = express.Router();

// nodemailer transporter
let transporter = nodemailer.createTransport({
  host: 'sandbox.smtp.mailtrap.io',
  port: 587, 
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

// testing nodemailer connection
transporter.verify((error, success) => {
  if (error) {
    console.log(error);
  } else {
    console.log("Ready for messages!");
    console.log(success);
  }
});

const register = async (req, res) => {
  const { firstName, lastName, email, password, userType } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      firstName,
      lastName,
      email,
      password,
      isVerified: false,
      userType: userType || 'user',
      uniqueId: uuidv4()
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();
    sendVerificationEmail(user, res);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).send('Server error');
  }
};

const sendVerificationEmail = ({ _id, email }, res) => {
  const currentUrl = `${apiBaseUrl}`;
  const uniqueString = uuidv4() + _id;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Verify Your Email.",
    html: `<p>Verify your email address to complete the signup and log into your account.</p><p>This link <b>expires in 6 hours.</b></p><p>Press <a href=${currentUrl + "/api/auth/verify/" + _id + "/" + uniqueString}>here</a> to proceed.</p>`
  };

  const saltRounds = 10;
  bcrypt
    .hash(uniqueString, saltRounds)
    .then((hashedUniqueString) => {
      const newVerification = new UserVerification({
        userId: _id,
        uniqueString: hashedUniqueString,
        createdAt: Date.now(),
        expiresAt: Date.now() + 21600000,
      });

      newVerification
        .save()
        .then(() => {
          transporter
            .sendMail(mailOptions)
            .then(() => {
              res.json({
                status: "PENDING",
                message: "Verification email sent!",
              });
            })
            .catch((error) => {
              res.json({
                status: "FAILED",
                message: "Verification email failed!",
              });
            });
        })
        .catch((error) => {
          res.json({
            status: "FAILED",
            message: "Couldn't save verification email data!",
          });
        });
    })
    .catch(() => {
      res.json({
        status: "FAILED",
        message: "An error occurred while hashing email data!",
      });
    });
};

const verifyEmail = async (req, res) => {
  const { userId, uniqueString } = req.params;

  try {
    const verificationRecord = await UserVerification.findOne({ userId });
    if (!verificationRecord) {
      return res.status(404).send('Verification record not found. Email not registered or is verified already.');
    }

    const { expiresAt, uniqueString: hashedUniqueString } = verificationRecord;

    if (expiresAt < Date.now()) {
      await UserVerification.deleteOne({ userId });
      await User.deleteOne({ _id: userId });
      return res.redirect(`/api/auth/verified?error=true&message=Link has expired. Please sign up again!`);
    }

    const isMatch = await bcrypt.compare(uniqueString, hashedUniqueString);
    if (!isMatch) {
      return res.redirect(`/api/auth/verified?error=true&message=Invalid verification details. Please check your inbox.`);
    }

    await User.updateOne({ _id: userId }, { isVerified: true });
    await UserVerification.deleteOne({ userId });

    const user = await User.findById(userId);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Email Successfully Verified",
      html: `<p>Your email address has been successfully verified. You can now log in to your account.</p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending confirmation email:", error);
        res.sendFile(path.join(__dirname, '../views/verified.html'));
      } else {
        console.log("Confirmation email sent:", info.response);
        res.sendFile(path.join(__dirname, '../views/verified.html'));
      }
    });
  } catch (err) {
    console.error(err);
    res.redirect(`/api/auth/verified?error=true&message=An error occurred during verification.`);
  }
};

//forgot password and reset
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    const hashedResetToken = await bcrypt.hash(resetToken, 10);
    const resetTokenExpire = Date.now() + 3600000;

    const newPasswordReset = new PasswordReset({
      userId: user._id,
      resetToken: hashedResetToken,
      createdAt: Date.now(),
      expiresAt: resetTokenExpire,
    });

    await newPasswordReset.save();

    const resetUrl = `${apiBaseUrl}/api/auth/reset-password/${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Request",
      html: `<p>You have requested a password reset. Please click this <a href="${resetUrl}">link</a> below to reset your password.</p><p><b>This link</b> expires in 1 hour.</p>`
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Error sending email:', err);
        return res.status(500).json({ msg: 'Error sending email' });
      }
      res.json({ msg: 'Password reset link sent to your email' });
    });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).send('Server error');
  }
};

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const passwordResetRecord = await PasswordReset.findOne({
      expiresAt: { $gt: Date.now() }
    });

    if (!passwordResetRecord) {
      return res.status(400).json({ msg: 'Invalid or expired token' });
    }

    const isMatch = await bcrypt.compare(token, passwordResetRecord.resetToken);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid or expired token' });
    }

    const user = await User.findById(passwordResetRecord.userId);
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    await PasswordReset.deleteOne({ _id: passwordResetRecord._id });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Password Reset Successfully",
      html: `<p>Your password has been reset successfully. You can now log in with your new password.</p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending confirmation email:", error);
      } else {
        console.log("Confirmation email sent:", info.response);
      }
    });

    res.json({ msg: 'Password has been reset' });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).send('Server error');
  }
};

const serveResetPasswordForm = (req, res) => {
  res.sendFile(path.join(__dirname, '../views/resetPassword.html'));
};

const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

const getUserById = async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ msg: 'Invalid Credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ msg: 'Please verify your email before logging in' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: 'Invalid Credentials' });
    }

    const payload = {
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '12h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, userType: user.userType });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return res.status(401).json({ msg: 'No refresh token provided' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    const user = await User.findById(decoded.user.id).select('-password');
    
    if (!user) return res.status(401).json({ msg: 'User not found' });

    const newAccessToken = jwt.sign(
      { user: { id: user.id, userType: user.userType } },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error('Refresh token verification failed:', err);
    res.status(403).json({ msg: 'Refresh token is not valid' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

const updateUserProfile = async (req, res) => {
  const { firstName, lastName, email } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;

    await user.save();
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

const getRegisteredUsers = async (req, res) => {
  try {
    if (!req.user.userType || !['admin', 'owner'].includes(req.user.userType)) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

const promoteToAdmin = async (req, res) => {
  const { userId } = req.params;

  try {
    if (!req.user.userType || req.user.userType !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.userType = 'admin';
    user.adminRequest = false;
    await user.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Congratulations, You are now an Admin!",
      html: `<p>You have been promoted to an admin. Welcome to the team!</p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending confirmation email:", error);
      } else {
        console.log("Confirmation email sent:", info.response);
      }
    });

    res.json({ msg: 'User promoted to admin' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

module.exports = { register, login, refreshToken, getUser, getUserById, getUserProfile, updateUserProfile, verifyEmail, forgotPassword, resetPassword, serveResetPasswordForm, promoteToAdmin, getRegisteredUsers };
