const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const File = require('../models/file');
const User = require('../models/User');
const Team = require("../models/Team");
const TeamFile = require("../models/TeamFile");
const authMiddleware = require('../middleware/authMiddleware');
const apiBaseUrl = process.env.BASE_API;
const path = require('path');

// cloudinary multer storage setup
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => ({
    folder: 'uploads',
    public_id: `${Date.now()}-${file.originalname}`,
  }),
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  },
});

router.post('/upload', authMiddleware, upload.array('files'), async (req, res) => {
  try {
    if (!req.files) {
      return res.status(400).json({ error: 'No files were uploaded.' });
    }

    const files = req.files.map(file => {
      console.log(file);
      return {
        filename: file.filename,
        filepath: file.path,
        mimetype: file.mimetype,
        size: file.size,
        owner: req.user._id,
        cloudinaryUrl: file.url || 'No URL found'
      };
    });

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


// get files
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
      fileUrl: file.cloudinaryUrl
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

// Delete or trash a file
router.delete('/:id', authMiddleware, async (req, res) => {
  const fileId = req.params.id;

  try {
    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ msg: 'File not found' });

    if (file.trashed) return res.status(400).json({ msg: 'File is already in trash' });

    file.trashed = true;
    await file.save();

    res.status(200).json({ msg: 'File moved to trash successfully' });
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
      fileUrl: file.cloudinaryUrl
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
    if (!file) return res.status(404).json({ msg: 'File not found' });

    if (!file.trashed) return res.status(400).json({ msg: 'File is not in trash' });
    await cloudinary.uploader.destroy(file.filename);
    await File.findByIdAndDelete(fileId);

    res.status(200).json({ msg: 'File permanently deleted successfully' });
  } catch (error) {
    console.error('Error permanently deleting file:', error);
    res.status(500).json({ error: 'Error permanently deleting file' });
  }
});

// Restore a trashed file
router.post('/restore/:id', authMiddleware, async (req, res) => {
  const fileId = req.params.id;

  try {
    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ msg: 'File not found' });

    if (!file.trashed) return res.status(400).json({ msg: 'File is not in trash' });
    file.trashed = false;
    await file.save();

    res.status(200).json({ msg: 'File restored successfully' });
  } catch (error) {
    console.error('Error restoring file:', error);
    res.status(500).json({ error: 'Error restoring file' });
  }
});


// Empty the trash
router.delete('/trash', authMiddleware, async (req, res) => {
  try {
    const deletedFiles = await File.find({ trashed: true });
    for (const file of deletedFiles) {
      await cloudinary.uploader.destroy(file.filename);
      await file.remove();
    }

    res.status(200).json({ message: 'Trash emptied successfully' });
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
    const fileUrl = file.path; 

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (user.profileImage) {
      const oldPublicId = user.profileImage
        .split('/')
        .slice(-2)
        .join('/')
        .split('.')[0];
      await cloudinary.uploader.destroy(oldPublicId);
    }

    user.profileImage = fileUrl;
    await user.save();

    res.status(200).json({ imageUrl: user.profileImage });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({ error: 'Error uploading profile image' });
  }
});


// team image upload
router.post('/upload-team-image/:teamUuid', authMiddleware, upload.single('teamImage'), async (req, res) => {
  const { teamUuid } = req.params;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }
    const team = await Team.findOne({ uuid: teamUuid });
    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    if (team.teamImage) {
      const oldPublicId = team.teamImage.split('/').slice(-1)[0].split('.')[0];
      await cloudinary.uploader.destroy(oldPublicId);
    }

    const timestamp = Date.now();
    const customFilename = `${timestamp}-${req.file.originalname}`;
    const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
      public_id: customFilename.replace(path.extname(req.file.originalname), ''),
      resource_type: 'image',
    });

    team.teamImage = cloudinaryResult.secure_url;
    await team.save();

    res.status(200).json({ message: 'Team image updated successfully.', teamImage: team.teamImage });
  } catch (error) {
    console.error('Error uploading team image:', error);
    res.status(500).json({ error: 'Failed to upload team image' });
  }
});




// Handle team image deletion
router.delete('/delete-team-image', authMiddleware, async (req, res) => {
  try {
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ msg: 'Team ID not provided' });

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ msg: 'Team not found' });

    if (!team.teamImage) return res.status(404).json({ msg: 'No team image to delete' });

    const fileName = path.basename(team.teamImage);
    await cloudinary.uploader.destroy(fileName);

    team.teamImage = '';
    await team.save();

    res.json({ msg: 'Team image deleted successfully' });
  } catch (error) {
    console.error('Error deleting team image:', error);
    res.status(500).json({ error: 'Error deleting team image' });
  }
});



// Team file upload
router.post('/upload-to-team/:teamUuid', authMiddleware, upload.array('files'), async (req, res) => {
  const { teamUuid } = req.params;

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files were uploaded.' });
    }

    const team = await Team.findOne({ uuid: teamUuid });
    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    const files = await Promise.all(req.files.map(async (file) => {
      const originalFilename = path.parse(file.originalname).name;
      const fileExtension = path.extname(file.originalname);

      const timestamp = Date.now();
      const publicId = `${timestamp}-${originalFilename}`;

      const cloudinaryResult = await cloudinary.uploader.upload(file.path, {
        public_id: publicId,
        resource_type: 'auto',
      });

      return {
        teamUuid,
        uploadedBy: req.user._id,
        filename: file.originalname,
        fileUrl: cloudinaryResult.secure_url,
        fileSize: file.size / (1024 * 1024),
        description: req.body.description || '',
        fileType: file.mimetype,
      };
    }));

    const savedFiles = await TeamFile.insertMany(files);

    const filesWithDetails = await Promise.all(savedFiles.map(async (file) => {
      const user = await User.findById(file.uploadedBy);
      return {
        ...file.toObject(),
        uploadedByName: `${user.firstName} ${user.lastName}`,
        uploadedByPfp: user.profileImage,
      };
    }));

    res.status(200).json(filesWithDetails);
  } catch (error) {
    console.error('File upload failed:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File size exceeds the limit.' });
    }
    res.status(500).json({ error: 'File upload failed' });
  }
});


// Retrieve files for a specific team
router.get('/team/:teamUuid/files', authMiddleware, async (req, res) => {
  const { teamUuid } = req.params;
  try {
    const team = await Team.findOne({ uuid: teamUuid });

    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    const files = await TeamFile.find({ teamUuid: team.uuid })
      .populate('uploadedBy', 'firstName lastName profileImage')
      .exec();

    const filesWithDetails = files.map(file => ({
      ...file.toObject(),
      fileSize: (file.fileSize).toFixed(2) + ' MB',
      uploadedByName: `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}`,
      uploadedByPfp: file.uploadedBy.profileImage,
      fileType: file.fileType,
    }));

    res.status(200).json({ files: filesWithDetails });
  } catch (error) {
    console.error('Failed to retrieve files:', error);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});


// Delete a file by ID
router.delete('/team/:fileId', authMiddleware, async (req, res) => {
  const { fileId } = req.params;

  try {
    const file = await TeamFile.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }
    if (file.uploadedBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to delete this file.' });
    }
    const cloudinaryPublicId = file.fileUrl
      .split('/')
      .slice(-1)[0]
      .split('.')[0];

    await cloudinary.uploader.destroy(cloudinaryPublicId);
    await TeamFile.findByIdAndDelete(fileId);

    res.status(200).json({ message: 'File deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});



module.exports = router;
