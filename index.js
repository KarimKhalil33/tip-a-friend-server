const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const pool = require('./config/db');

const PORT = process.env.PORT || 4000;


app.use(cors());
app.use(express.json());

const { connectProducer } = require('./utils/kafka');
connectProducer();


const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

const friendRoutes = require('./routes/friends');
app.use('/api/friends', friendRoutes);

const requestRoutes = require('./routes/requests');
app.use('/api/requests', requestRoutes);

const reviewRoutes = require('./routes/reviews');
app.use('/api/reviews', reviewRoutes);


app.get('/', (req, res) => {
  res.send('Tip A Friend API is live 🚀');
});

app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ time: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('DB Error');
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
});
