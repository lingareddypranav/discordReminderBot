const { Client } = require('pg');

// Initialize the PostgreSQL client
const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Important for avoiding SSL issues in cloud environments
    }
});

db.connect();

// Create tables if they do not exist
db.query(`
    CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        userId TEXT NOT NULL,
        task TEXT NOT NULL,
        channelId TEXT NOT NULL,
        interval INTEGER NOT NULL
    )
`, (err, res) => {
    if (err) throw err;
    console.log('Reminders table is ready');
});

db.query(`
    CREATE TABLE IF NOT EXISTS favorite_artists (
        id SERIAL PRIMARY KEY,
        userId TEXT NOT NULL,
        artistName TEXT NOT NULL,
        lastChecked DATE
    )
`, (err, res) => {
    if (err) throw err;
    console.log('Favorite artists table is ready');
});

module.exports = db;