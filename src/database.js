const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./reminders.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the reminders database.');
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        task TEXT NOT NULL,
        channelId TEXT NOT NULL,
        interval INTEGER NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS favorite_artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        artistName TEXT NOT NULL,
        lastChecked DATE
    )`);
});

module.exports = db;