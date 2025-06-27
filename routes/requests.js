const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');
const { emitEvent } = require('../utils/kafka');

// ✅ Create a Request or Offer
router.post('/create', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { type, category, title, description, location, price, time } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO requests (user_id, type, category, title, description, location, price, time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, type, category, title, description, location, price, time]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Error creating request' });
  }
});

// ✅ Get feed: only open + future-dated requests from friends
router.get('/feed', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT r.*, u.name AS poster_name, u.profile_image
       FROM requests r
       JOIN users u ON r.user_id = u.id
       WHERE r.status = 'open'
         AND r.time > NOW()
         AND r.user_id IN (
           SELECT friend_id FROM friends
           WHERE user_id = $1 AND status = 'accepted'
         )
       ORDER BY r.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Error loading feed' });
  }
});

// ✅ Accept a request (only if open and not expired)
router.post('/accept/:id', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const requestId = req.params.id;

  try {
    const result = await pool.query(
      `UPDATE requests
       SET status = 'accepted', accepted_by = $1
       WHERE id = $2 AND status = 'open' AND time > NOW()
       RETURNING *`,
      [userId, requestId]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ message: 'Request already accepted or expired' });
    }

    res.json({ message: 'Request accepted', request: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error accepting request' });
  }
});

// ✅ Get your own requests (posted by you)
router.get('/my', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT * FROM requests
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching your requests' });
  }
});

// Mark request as completed
router.post('/complete/:id', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const requestId = req.params.id;

  // Ensure the user completing is the one who accepted the task
  const { rows } = await pool.query(
    'SELECT accepted_by FROM requests WHERE id = $1',
    [requestId]
  );

  if (!rows.length || rows[0].accepted_by !== userId) {
    return res.status(403).json({ error: 'Not authorized to complete this request.' });
  }

  await pool.query(
    `UPDATE requests
     SET is_completed = TRUE,
         completed_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [requestId]
  );
    // ✅ Emit Kafka event
    await emitEvent('request_completed', {
      requestId,
      completedAt: new Date(),
    });

  res.status(200).json({ message: 'Task marked as complete and timestamped.' });
});

router.post('/confirm/:id', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const requestId = req.params.id;

  // Ensure the requester is the one confirming
  const { rows } = await pool.query(
    'SELECT user_id, is_completed FROM requests WHERE id = $1',
    [requestId]
  );

  if (!rows.length || rows[0].user_id !== userId) {
    return res.status(403).json({ error: 'Not authorized to confirm this request.' });
  }

  if (!rows[0].is_completed) {
    return res.status(400).json({ error: 'Task not yet marked as completed by helper.' });
  }

  await pool.query(
    `UPDATE requests
     SET confirmed_by_requester = TRUE
     WHERE id = $1`,
    [requestId]
  );

  res.status(200).json({ message: 'Task confirmed by requester.' });
});


module.exports = router;
