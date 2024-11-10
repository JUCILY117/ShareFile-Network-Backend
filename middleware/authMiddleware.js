const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.user.id).select('-password');
    
    if (!req.user) {
      return res.status(401).json({ msg: 'User not found' });
    }

    req.email = req.user.email;

    if (req.originalUrl.startsWith(`${process.env.BASE_API}/api/admin`) && req.user.userType !== 'admin') {
      return res.status(403).json({ msg: 'Access denied, admin rights required' });
    }

    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

module.exports = authMiddleware;
