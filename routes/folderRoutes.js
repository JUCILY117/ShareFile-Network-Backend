const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Folder = require('../models/Folder');
const authMiddleware = require('../middleware/authMiddleware');

// create a folder
router.post('/create-folder', authMiddleware, async (req, res) => {
  const { name, parentId } = req.body;
  
  try {
    const folderName = `${Date.now()}-${name}`;
    const newFolder = new Folder({
      name: folderName,
      parentFolderId: parentId || null,
      userId: req.user._id,
    });

    await newFolder.save();

    const folderPath = path.join(__dirname, '../folders', folderName);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    res.status(201).json(newFolder);
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Error creating folder' });
  }
});


// fetch all folders
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const folders = await Folder.find({ userId }).populate('parentFolderId');
    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve folders.' });
  }
});


router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const folderId = req.params.id;
    const folder = await Folder.findById(folderId).populate('parentFolderId');
    
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found.' });
    }
    
    res.json(folder);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve folder.' });
  }
});


// delete a folder
router.delete('/:id', authMiddleware, async (req, res) => {
  const folderId = req.params.id;
  console.log('Folder ID received:', folderId);

  if (!mongoose.Types.ObjectId.isValid(folderId)) {
    console.error('Invalid ObjectId format:', folderId);
    return res.status(400).json({ msg: 'Invalid folder ID' });
  }

  try {
    const folder = await Folder.findById(folderId);

    if (!folder) {
      console.error('Folder not found:', folderId);
      return res.status(404).json({ msg: 'Folder not found' });
    }

    await Folder.findByIdAndDelete(folderId);

    const folderPath = path.join(__dirname, '../folders', folder.name);
    console.log('Folder path:', folderPath);

    fs.rm(folderPath, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error('Failed to delete folder from filesystem:', err);
        return res.status(500).json({ error: 'Failed to delete folder from filesystem' });
      }
      
      console.log('Folder deleted permanently');
      res.status(200).json({ msg: 'Folder deleted permanently' });
    });

  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Error deleting folder' });
  }
});

module.exports = router;
