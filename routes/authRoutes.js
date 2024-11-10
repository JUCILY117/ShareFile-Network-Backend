const express = require('express');
const { check, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const { register, login, refreshToken,  getUser, getUserById, getUserProfile, updateUserProfile, verifyEmail, forgotPassword, resetPassword, serveResetPasswordForm, getRegisteredUsers, promoteToAdmin } = require('../controllers/authController');
const router = express.Router();

router.post(
  '/register',
  [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    register(req, res);
  }
);

router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    login(req, res);
  }
);

router.post('/refresh-token', authMiddleware, refreshToken);


router.get('/verify/:userId/:uniqueString', verifyEmail);

router.get('/user', authMiddleware, getUser);

router.get('/user/:userId', authMiddleware, getUserById);

router.get('/profile', authMiddleware, getUserProfile);

router.put('/profile', authMiddleware, (req, res) => {
  updateUserProfile(req, res);
});

router.post('/forgot-password', forgotPassword);

router.post('/reset-password/:token', resetPassword);

router.get('/reset-password/:token', serveResetPasswordForm);

router.get('/users', authMiddleware, getRegisteredUsers);

router.post('/promote/:userId', authMiddleware, promoteToAdmin);



module.exports = router;
