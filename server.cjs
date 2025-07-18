const express = require('express');
const app = express();
const cors = require('cors'); // Import the cors package
const port = 3000;

const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
    host: process.env.AZURE_POSTGRESQL_HOST,
    port: parseInt(process.env.AZURE_POSTGRESQL_PORT || '5432'),
    database: process.env.AZURE_POSTGRESQL_DATABASE,
    user: process.env.AZURE_POSTGRESQL_USER,
    password: process.env.AZURE_POSTGRESQL_PASSWORD
})

app.use(cors()); // Enable CORS for all routes
app.use(express.json());

app.get('/leaderboard', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM leaderboard ORDER BY score DESC LIMIT 10');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/add-score', async (req, res) => {
    const { name, score } = req.body;
    if (!name || score === undefined || score === null) {
        return res.status(400).json({ error: 'Name and score are required' });
    }
    if (typeof name !== 'string' || name.length > 20) {
        return res.status(400).json({ error: 'Name must be less than 20 characters.' });
    }

    try {
        const result = await pool.query('INSERT INTO leaderboard (name, score) VALUES ($1, $2) RETURNING *', [name, score]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding to leaderboard:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const path = require('path');

// Sert les fichiers statiques du frontend (Vite build)
app.use(express.static(path.join(__dirname, 'dist')));

// Redirige les autres requêtes vers index.html (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});