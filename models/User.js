const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  userType: {
    type: String,
    enum: ['user', 'admin', 'owner'],
    default: 'user',
  },
  profileImage: {
    type: String,
    default: '',
  },
  uniqueId: {
    type: String,
    unique: true,
  },
});

module.exports = mongoose.model('User', UserSchema);
