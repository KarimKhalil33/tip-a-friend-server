const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');
const { emitEvent } = require('../utils/kafka');

router.post('/', verifyToken, async (req, res) => {
  const reviewerId = req.user.id;
  const { request_id, rating, comment } = req.body;

  try {
    // Get the accepted user (the person being reviewed)
    const { rows } = await pool.query(
      'SELECT accepted_by FROM requests WHERE id = $1',
      [request_id]
    );

    if (!rows.length || !rows[0].accepted_by) {
      return res.status(400).json({ error: 'No accepted user for this request.' });
    }

    const revieweeId = rows[0].accepted_by;

    // Insert review
    const result = await pool.query(
      `INSERT INTO reviews (reviewer_id, reviewee_id, request_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [reviewerId, revieweeId, request_id, rating, comment]
    );

    // Update request table with the review ID
    await pool.query(
      `UPDATE requests SET review_id = $1 WHERE id = $2`,
      [result.rows[0].id, request_id]
    );

        // Emit Kafka event
    await emitEvent('review_posted', {
      requestId: request_id,
      reviewerId,
      revieweeId,
      rating,
      comment,
      createdAt: new Date(),
    });
    res.status(201).json({ message: 'Review posted successfully.' });

  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: 'Failed to post review.' });
  }
});
module.exports = router;