const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const Team = require('../models/Team');

// create a new meeting
router.post('/:teamId/meetings', async (req, res) => {
  const { teamId } = req.params;
  const { name } = req.body;

  try {
    const newMeeting = new Meeting({
      name,
      team: teamId,
      url: "will put it here later",
    });

    await newMeeting.save();
    res.status(201).json(newMeeting);
  } catch (error) {
    console.error("Error creating meeting:", error);
    res.status(500).json({ error: "Error creating meeting" });
  }
});

// get all meetings for a team
router.get('/:teamId/meetings', async (req, res) => {
  const { teamId } = req.params;

  try {
    const meetings = await Meeting.find({ team: teamId });
    res.status(200).json(meetings);
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: "Error fetching meetings" });
  }
});

module.exports = router;
