const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  team: { 
    type: String, 
    ref: 'Team',
    required: true 
  },
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Chat', ChatSchema);
