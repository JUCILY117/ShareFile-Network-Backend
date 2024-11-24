const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const MeetingSchema = new mongoose.Schema(
  {
    meetingId: { 
      type: String, 
      default: uuidv4, 
      unique: true, 
    },
    teamId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Team', 
      required: true,
    },
    title: { 
      type: String, 
      required: true, 
    },
    creator: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
    },
    status: { 
      type: String, 
      enum: ['active', 'ended'], 
      default: 'active', 
    },
    participants: [
      {
        userId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'User', 
          required: true, 
        },
        joinedAt: { 
          type: Date, 
          default: Date.now, 
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Meeting', MeetingSchema);
