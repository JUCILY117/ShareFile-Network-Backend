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
     const fullName = ` ${user.firstName} ${user.lastName}`;

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();
    sendVerificationEmail(user, res, fullName);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).send('Server error');
  }
};

const sendVerificationEmail = ({ _id, email, fullName }, res) => {
  const currentUrl = `${apiBaseUrl}`;
  const uniqueString = uuidv4() + _id;
 

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Dear User! Please verify your email before the link expires.`,
    html: `    <html>
                  <head>
                      <style>
                          @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900&display=swap');
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
                              color: #D1D1D6;
                          }
                          .content strong {
                              color: #fff;
                          }
                          .content p {
                              margin-bottom: 20px;
                          }
                          .content p strong {
                              color: rgb(141, 40, 40);
                          }
                          .button-container {
                              text-align: center;
                              margin-top: 30px;
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
                          }
                      </style>
                  </head>
                  <body>
                      <div class="container">
                          <div class="header">
                              <!-- Add your logo here -->
                              <img src="https://teamsharenetwork.netlify.app/logo.png" alt="Team Logo" />
                              <h1>Verify Your Email Address</h1>
                          </div>
                          <div class="content">
                              <p>Hello,</p>
                              <p>Thank you for signing up! To complete your signup process, please verify your email address.</p>
                              <p>This link <strong>expires in 6 hours</strong>.</p>
                              <p>Click the button below to verify your email:</p>
                          </div>
                          <div class="button-container">
                              <a href="${currentUrl}/api/auth/verify/${_id}/${uniqueString}" class="btn">Verify Email</a>
                          </div>
                          <div class="footer">
                              <p>Best regards,</p>
                              <p class="sub"><strong><span class="team">Team</span><span class="share">Share</span> Network</strong></p>
                              <p><em>We're excited to have you with us!</em></p>
                          </div>
                      </div>
                  </body>
              </html>`
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
      subject: "Dear User, your email has been sucessfully verified!",
      html: `
      <html>
          <head>
              <style>
                  @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900&display=swap');
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
                      margin-bottom: 20px;
                  }
                  .header h1 {
                      font-size: 28px;
                      color: #fff;
                      margin: 0;
                  }
                  .content {
                      font-size: 16px;
                      line-height: 1.6;
                      color: #D1D1D6;
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
                          margin-bottom: 20px;
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
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="header">
                      <img src="https://teamsharenetwork.netlify.app/logo.png" alt="Team Logo" />
                      <h1>Email Verified Successfully!</h1>
                  </div>
                  <div class="content">
                      <p>Hello,</p>
                      <p>Congratulations! Your email address has been successfully verified.</p>
                      <p>You can now log in to your account and enjoy all the features of our platform.</p>
                      <p>Thank you for being a part of the <strong>TeamShare Network</strong>.</p>
                  </div>
                  <div class="button-container">
                      <a href="http://teamsharenetwork.netlify.app/login" class="btn">Log In Now</a>
                  </div>
                  <div class="footer">
                      <p>Best regards,</p>
                      <p class="sub"><strong><span class="team">Team</span><span class="share">Share</span> Network</strong></p>
                      <p><em>Your journey starts here!</em></p>
                  </div>
              </div>
          </body>
      </html>
      `
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
      subject: "Here is your Password Reset Request",
      html: `
      <html>
          <head>
              <style>
                  @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900&display=swap');
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
                      margin-bottom: 20px;
                  }
                  .header h1 {
                      font-size: 28px;
                      color: #fff;
                      margin: 0;
                  }
                  .content {
                      font-size: 16px;
                      line-height: 1.6;
                      color: #D1D1D6;
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
                          margin-bottom: 20px;
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
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="header">
                      <img src="https://teamsharenetwork.netlify.app/logo.png" alt="Team Logo" />
                      <h1>Password Reset Request</h1>
                  </div>
                  <div class="content">
                      <p>Hello,</p>
                      <p>We received a request to reset your password. If you made this request, please click the button below to proceed. If you did not request a password reset, you can safely ignore this email.</p>
                      <p style="color:rgb(194, 22, 22)"><b>This link expires in 1 hour.</b></p>
                  </div>
                  <div class="button-container">
                      <a href="${resetUrl}" class="btn">Reset Password</a>
                  </div>
                  <div class="footer">
                      <p>Best regards,</p>
                      <p class="sub"><strong><span class="team">Team</span><span class="share">Share</span> Network</strong></p>
                      <p><em>Your security is our priority.</em></p>
                  </div>
              </div>
          </body>
      </html>
      `
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
      subject: "Dear User! Your Password has been Reset Successfully",
      html: `
      <html>
          <head>
              <style>
                  @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900&display=swap');
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
                      margin-bottom: 20px;
                  }
                  .header h1 {
                      font-size: 28px;
                      color: #fff;
                      margin: 0;
                  }
                  .content {
                      font-size: 16px;
                      line-height: 1.6;
                      color: #D1D1D6;
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
                          margin-bottom: 20px;
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
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="header">
                      <img src="https://teamsharenetwork.netlify.app/logo.png" alt="Team Logo" />
                      <h1>Password Reset Successful</h1>
                  </div>
                  <div class="content">
                      <p>Hello,</p>
                      <p>Your password has been successfully reset. You can now log in to your account using your new password.</p>
                      <p>If you didn’t make this change or you notice any suspicious activity in your account, please contact us immediately.</p>
                  </div>
                  <div class="button-container">
                      <a href="http://teamsharenetwork.netlify.app/login" class="btn">Log In Now</a>
                  </div>
                  <div class="footer">
                      <p>Best regards,</p>
                      <p class="sub"><strong><span class="team">Team</span><span class="share">Share</span> Network</strong></p>
                      <p><em>Your security is our priority.</em></p>
                  </div>
              </div>
          </body>
      </html>
      `
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
      html: `
      <html>
          <head>
              <style>
                  @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900&display=swap');
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
                      margin-bottom: 20px;
                  }
                  .header h1 {
                      font-size: 28px;
                      color: #fff;
                      margin: 0;
                  }
                  .content {
                      font-size: 16px;
                      line-height: 1.6;
                      color: #D1D1D6;
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
                          margin-bottom: 20px;
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
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="header">
                      <img src="https://teamsharenetwork.netlify.app/logo.png" alt="ShareFile Network Logo" />
                      <h1>Congratulations, Admin!</h1>
                  </div>
                  <div class="content">
                      <p>Hello,</p>
                      <p>We are excited to inform you that you have been promoted to <strong>Admin</strong> in <strong>ShareFile Network</strong>.</p>
                      <p>As an Admin, you can now manage teams, handle permissions, and ensure smooth operations within the platform.</p>
                      <p>Thank you for your dedication and efforts. We are confident you will excel in your new role!</p>
                  </div>
                  <div class="button-container">
                      <a href="http://sharefilenetwork.netlify.app/admin" class="btn">Go to Admin Dashboard</a>
                  </div>
                  <div class="footer">
                      <p>Best regards,</p>
                      <p class="sub"><strong><span class="team">Share</span><span class="file">File</span> Network</strong></p>
                      <p><em>Empowering Collaboration.</em></p>
                  </div>
              </div>
          </body>
      </html>
      `
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
