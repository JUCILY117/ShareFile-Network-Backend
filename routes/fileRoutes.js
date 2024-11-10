const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const File = require('../models/file');
const User = require('../models/User');
const Team = require("../models/Team");
const authMiddleware = require('../middleware/authMiddleware');

const apiBaseUrl = process.env.BASE_API;

const directories = ['uploads', 'trash', 'folders'];

function folderMaker() {
  directories.forEach(dir => {
    const dirPath = path.join(__dirname, '../', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Directory created: ${dirPath}`);
    }
  });
}

folderMaker();

// multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }
 });

// Handle file upload
router.post('/upload', authMiddleware, upload.array('files'), async (req, res) => {
  try {
    if (!req.files) {
      return res.status(400).json({ error: 'No files were uploaded.' });
    }

    const files = req.files.map(file => ({
      filename: file.filename,
      filepath: file.path,
      mimetype: file.mimetype,
      size: file.size,
      owner: req.user._id
    }));

    const savedFiles = await File.insertMany(files);
    res.status(200).json(savedFiles);
  } catch (error) {
    console.error('File upload failed:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File size exceeds the limit.' });
    }
    res.status(500).json({ error: 'File upload failed' });
  }
});


// retrieve files
router.get('/', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const skip = (page - 1) * limit;

    const totalFiles = await File.countDocuments({ owner: req.user._id, trashed: { $ne: true } });
    const files = await File.find({ owner: req.user._id, trashed: { $ne: true } })
      .skip(skip)
      .limit(limit);

    const filesWithUrls = files.map(file => ({
      ...file.toObject(),
      fileUrl: `${apiBaseUrl}/uploads/${file.filename}`
    }));

    res.status(200).json({
      totalFiles,
      currentPage: page,
      totalPages: Math.ceil(totalFiles / limit),
      files: filesWithUrls
    });
  } catch (error) {
    console.error('Failed to retrieve files:', error);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});


// delete or trash a file
router.delete('/:id', authMiddleware, async (req, res) => {
  const fileId = req.params.id;

  try {
    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ msg: 'File not found' });
    }

    if (file.trashed) {
      return res.status(400).json({ msg: 'File is already in trash' });
    }

    file.trashed = true;
    await file.save();

    const oldFilePath = path.join(__dirname, '../uploads', file.filename);
    const newFilePath = path.join(__dirname, '../trash', file.filename);
    
    fs.rename(oldFilePath, newFilePath, (err) => {
      if (err) {
        console.error('Failed to move file to trash:', err);
        return res.status(500).json({ error: 'Failed to move file to trash' });
      }
      
      res.status(200).json({ msg: 'File moved to trash successfully' });
    });
  } catch (error) {
    console.error('Error moving file to trash:', error);
    res.status(500).json({ error: 'Error moving file to trash' });
  }
});

// List trashed files
router.get('/trash', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const skip = (page - 1) * limit;

    const totalFiles = await File.countDocuments({ owner: req.user._id, trashed: true });
    const trashedFiles = await File.find({ owner: req.user._id, trashed: true })
      .skip(skip)
      .limit(limit);

    const filesWithUrls = trashedFiles.map(file => ({
      ...file.toObject(),
      fileUrl: `${apiBaseUrl}/trash/${file.filename}`
    }));

    res.status(200).json({
      totalFiles,
      currentPage: page,
      totalPages: Math.ceil(totalFiles / limit),
      files: filesWithUrls
    });
  } catch (error) {
    console.error('Failed to retrieve trashed files:', error);
    res.status(500).json({ error: 'Failed to retrieve trashed files' });
  }
});


// Permanently delete a trashed file
router.delete('/trash/:id', authMiddleware, async (req, res) => {
  const fileId = req.params.id;

  try {
    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ msg: 'File not found' });
    }

    if (!file.trashed) {
      return res.status(400).json({ msg: 'File is not in trash' });
    }

    const filePath = path.join(__dirname, '../trash', file.filename);
    
    fs.unlink(filePath, async (err) => {
      if (err) {
        console.error('Failed to delete file from trash:', err);
        return res.status(500).json({ error: 'Failed to delete file from trash' });
      }

      await File.findByIdAndDelete(fileId);
      res.status(200).json({ msg: 'File permanently deleted successfully' });
    });
  } catch (error) {
    console.error('Error permanently deleting file:', error);
    res.status(500).json({ error: 'Error permanently deleting file' });
  }
});

// Restore a trashed file
router.post('/restore/:id',authMiddleware, async (req, res) => {
  const fileId = req.params.id;

  try {
    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ msg: 'File not found' });
    }

    if (!file.trashed) {
      return res.status(400).json({ msg: 'File is not in trash' });
    }

    // Move file back to the uploads folder
    const oldFilePath = path.join(__dirname, '../trash', file.filename);
    const newFilePath = path.join(__dirname, '../uploads', file.filename);
    
    fs.rename(oldFilePath, newFilePath, async (err) => {
      if (err) {
        console.error('Failed to restore file from trash:', err);
        return res.status(500).json({ error: 'Failed to restore file from trash' });
      }

      file.trashed = false;
      await file.save();
      res.status(200).json({ msg: 'File restored successfully' });
    });
  } catch (error) {
    console.error('Error restoring file:', error);
    res.status(500).json({ error: 'Error restoring file' });
  }
});

// Empty the trash
router.delete('/trash', authMiddleware, async (req, res) => {
  try {
    const deletedFiles = await File.deleteMany({ trashed: true });

    res.status(200).json({ message: 'Bin emptied successfully!', deletedFiles });
  } catch (error) {
    console.error('Failed to empty bin:', error);
    res.status(500).json({ error: 'Failed to empty bin' });
  }
});

// Handle profile image upload
router.post('/upload-profile-image', authMiddleware, upload.single('profileImage'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ msg: 'No file uploaded' });

    const fileUrl = `${apiBaseUrl}/uploads/${file.filename}`;
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (user.profileImage) {
      const oldFileName = path.basename(user.profileImage);
      const oldFilePath = path.join(__dirname, '../uploads', oldFileName);
      
      fs.unlink(oldFilePath, (err) => {
        if (err) {
          console.error('Failed to delete old profile image:', err);
          return res.status(500).json({ error: 'Failed to delete old profile image' });
        }
      });
    }

    user.profileImage = fileUrl;
    await user.save();

    res.json({ imageUrl: user.profileImage });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({ error: 'Error uploading profile image' });
  }
});

// Handle profile image deletion
router.delete('/delete-file/:filename', authMiddleware, async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename) return res.status(400).json({ msg: 'Filename not provided' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (user.profileImage === " " || !user.profileImage || path.basename(user.profileImage) !== filename) {
      return res.status(404).json({ msg: 'Profile image not found' });
    }

    const filePath = path.join(__dirname, '../uploads', filename);

    fs.unlink(filePath, async (err) => {
      if (err) {
        console.error('Failed to delete profile image:', err);
        return res.status(500).json({ error: 'Failed to delete profile image' });
      }

      user.profileImage = '';
      await user.save();

      res.json({ msg: 'Profile image deleted successfully' });
    });
  } catch (error) {
    console.error('Error deleting profile image:', error);
    res.status(500).json({ error: 'Error deleting profile image' });
  }
});


// Handle team image upload
router.post('/upload-team-image/:teamId', authMiddleware, upload.single('teamImage'), async (req, res) => {
  try {
    const file = req.file;
    const { teamId } = req.params;

    if (!file) return res.status(400).json({ msg: 'No file uploaded' });

    const fileUrl = `${apiBaseUrl}/uploads/${file.filename}`;
    
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ msg: 'Team not found' });

    // If team already has an image, delete the old one
    if (team.teamImage) {
      const oldFileName = path.basename(team.teamImage);
      const oldFilePath = path.join(__dirname, '../uploads', oldFileName);

      fs.unlink(oldFilePath, (err) => {
        if (err) {
          console.error('Failed to delete old team image:', err);
          return res.status(500).json({ error: 'Failed to delete old team image' });
        }
      });
    }

    // Update team image URL
    team.teamImage = fileUrl;
    await team.save();

    res.json({ imageUrl: team.teamImage });
  } catch (error) {
    console.error('Error uploading team image:', error);
    res.status(500).json({ error: 'Error uploading team image' });
  }
});

// error handling for file size limit
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File size exceeds the limit of 500 MB.' });
    }
  }
  res.status(500).json({ error: 'Something went wrong.' });
});


module.exports = router;
