const mongoose = require('mongoose');

const PasswordResetSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  resetToken: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model('PasswordReset', PasswordResetSchema);
