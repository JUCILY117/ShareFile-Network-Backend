const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileSchema = new Schema({
  filename: { type: String, required: true },
  filepath: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now },
  trashed: { type: Boolean, default: false }
});

module.exports = mongoose.model('File', fileSchema);
