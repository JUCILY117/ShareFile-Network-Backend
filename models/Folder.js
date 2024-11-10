const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const folderSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  parentFolderId: {
    type: Schema.Types.ObjectId,
    ref: 'Folder',
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Folder', folderSchema);