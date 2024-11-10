const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  type: { 
    type: String, 
    enum: ['team_invite', 'message', 'reminder', 'other'],  // Added types for different notifications
    required: true 
  },
  teamId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Team',  // Link to the Team model (relevant for team invite notifications)
    required: function() { return this.type === 'team_invite'; }  // Only required if type is 'team_invite'
  },
});

module.exports = mongoose.model('Notification', NotificationSchema);
