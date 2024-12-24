const mongoose = require('mongoose');

const UserVerificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  uniqueString: {
    type: String,
    required: true,
  },
  createdAt: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: String,
    required: true,
  },
});

PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UserVerification', UserVerificationSchema);
