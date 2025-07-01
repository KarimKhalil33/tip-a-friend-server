const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');

// ✅ Send a friend request
router.post('/send', verifyToken, async (req, res) => {
  const { friendId } = req.body;
  const userId = req.user.id;

  if (userId === friendId) return res.status(400).json({ message: "Can't friend yourself" });

  try {
    await pool.query(
      'INSERT INTO friends (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, friendId]
    );
    res.status(200).json({ message: 'Friend request sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error sending request' });
  }
});

// ✅ Accept a friend request
router.post('/accept', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const requesterId = req.body?.requesterId;
    // Check if requesterId is provided
    if (!requesterId) {
    return res.status(400).json({ message: 'Missing requesterId in body' });
    }

  try {
    const result = await pool.query(
      `UPDATE friends SET status = 'accepted'
       WHERE user_id = $1 AND friend_id = $2 RETURNING *`,
      [requesterId, userId]
    );

    // Add reciprocal row if not already present
    await pool.query(
      'INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [userId, requesterId, 'accepted']
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No pending request found' });
    }

    res.status(200).json({ message: 'Friend request accepted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error accepting request' });
  }
});

// ✅ Get list of current friends
router.get('/list', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.profile_image, f.created_at
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = $1 AND f.status = 'accepted'`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving friends' });
  }
});

// Get all pending friend requests sent by the user
router.get('/sent-requests', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.profile_image, f.created_at
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = $1 AND f.status = 'pending'`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving sent requests' });
  }
});

// Get all pending friend requests received by the user
router.get('/received-requests', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.profile_image, f.created_at
       FROM friends f
       JOIN users u ON f.user_id = u.id
       WHERE f.friend_id = $1 AND f.status = 'pending'`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving received requests' });
  }
});

module.exports = router;
