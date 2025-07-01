const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user exists
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );

    res.status(201).json({ user: result.rows[0] });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Create JWT
    const token = jwt.sign(
      { id: user.id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return token and user info
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        rating: user.rating,
        profile_image: user.profile_image
      }
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


const verifyToken = require('../middleware/auth');

router.get('/me', verifyToken, (req, res) => {
  res.json({ message: `Hello, ${req.user.name}`, user: req.user });
});

// Search users by name (exclude self, name param optional)
router.get('/search', verifyToken, async (req, res) => {
  const { name } = req.query;
  const userId = req.user.id;
  try {
    let result;
    if (name) {
      result = await pool.query(
        `SELECT id, name, email, rating, profile_image FROM users WHERE LOWER(name) LIKE LOWER($1) AND id != $2`,
        [`%${name}%`, userId]
      );
    } else {
      result = await pool.query(
        `SELECT id, name, email, rating, profile_image FROM users WHERE id != $1`,
        [userId]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error searching user' });
  }
});


module.exports = router;
