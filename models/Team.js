const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const TeamSchema = new mongoose.Schema({
  uuid: { 
    type: String, 
    default: uuidv4,
    unique: true,
  },
  name: { 
    type: String, 
    required: true 
  },
  creator: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    index: true 
  },
  teamImage: {
    type: String,
    default: '',
  },
  members: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      role: {
        type: String,
        required: true,
        default: 'User',
      }
    },
  ],
  roles: [
    {
      type: String,
      default: 'User',
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Team', TeamSchema);
