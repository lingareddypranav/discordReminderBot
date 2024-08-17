const db = require('./database');
const { spotifyApi, getAccessToken } = require('./spotify');
const cron = require('node-cron');
// Set a reminder

function setReminder(client, userId, task, channelId) {
    const interval = 3600000; // 1 hour in milliseconds
    db.run(`INSERT INTO reminders (userId, task, channelId, interval) VALUES (?, ?, ?, ?)`, [userId, task, channelId, interval], function(err) {
        if (err) {
            client.channels.cache.get(channelId).send(`Error setting reminder: ${err.message}`);
            return;
        }
        client.channels.cache.get(channelId).send(`Ok, I will remind you about "${task}" every hour!`);
        const intervalId = setInterval(() => {
            client.channels.cache.get(channelId).send(`<@${userId}>, don't forget to: ${task}`);
        }, interval);
    });
}

// Stop a reminder
function stopReminder(client, userId, task, channelId) {
    db.get(`SELECT id FROM reminders WHERE userId = ? AND task = ?`, [userId, task], (err, row) => {
        if (err) {
            client.channels.cache.get(channelId).send(`Error stopping reminder: ${err.message}`);
            return;
        }
        if (!row) {
            client.channels.cache.get(channelId).send(`No active reminder found for "${task}".`);
            return;
        }
        db.run(`DELETE FROM reminders WHERE id = ?`, row.id, (err) => {
            if (err) {
                client.channels.cache.get(channelId).send(`Error removing reminder: ${err.message}`);
                return;
            }
            client.channels.cache.get(channelId).send(`Your reminder for "${task}" has been stopped.`);
        });
    });
}

// Restore reminders on bot startup
function restoreReminders(client) {
    db.each(`SELECT userId, task, channelId, interval FROM reminders`, (err, row) => {
        if (err) {
            console.error(err.message);
            return;
        }
        const intervalId = setInterval(() => {
            client.channels.cache.get(row.channelId).send(`<@${row.userId}>, don't forget to: ${row.task}`);
        }, row.interval);
    });
}

// Set a favorite artist and immediately check for new releases
function setFavoriteArtist(client, userId, artistName, channelId) {
    db.run(`INSERT INTO favorite_artists (userId, artistName, lastChecked) VALUES (?, ?, date('now'))`, [userId, artistName], function(err) {
        if (err) {
            client.channels.cache.get(channelId).send(`Error setting favorite artist: ${err.message}`);
            return;
        }
        client.channels.cache.get(channelId).send(`Your favorite artist "${artistName}" has been saved!`);
        
        // Immediately check for new releases for the added artist
        checkNewReleaseForArtist(client, userId, artistName, channelId);
    });
}

// Check for new releases for a specific artist
async function checkNewReleaseForArtist(client, userId, artistName, channelId) {
    await getAccessToken(); // Refresh the access token

    try {
        const searchResult = await spotifyApi.searchArtists(artistName);
        const artist = searchResult.body.artists.items[0];

        if (artist) {
            const newReleases = await spotifyApi.getArtistAlbums(artist.id, { limit: 1 });
            const now = new Date();
            const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));

            const recentReleases = newReleases.body.items.filter(album => {
                const releaseDate = new Date(album.release_date);
                return releaseDate >= oneWeekAgo;
            });

            if (recentReleases.length > 0) {
                client.channels.cache.get(channelId).send(`<@${userId}>, your favorite artist ${artistName} has released music this week!`);
                db.run(`UPDATE favorite_artists SET lastChecked = date('now') WHERE userId = ? AND artistName = ?`, [userId, artistName]);
            } else {
                client.channels.cache.get(channelId).send(`<@${userId}>, your favorite artist ${artistName} has not released any new music this week.`);
            }
        } else {
            client.channels.cache.get(channelId).send(`Could not find artist "${artistName}" on Spotify.`);
        }
    } catch (err) {
        console.error(`Error checking new releases for ${artistName}: ${err.message}`);
    }
}

// Existing function to check all artists
async function checkNewReleases(client) {
    await getAccessToken(); // Refresh the access token

    db.all(`SELECT id, userId, artistName, channelId FROM favorite_artists`, async (err, rows) => {
        if (err) {
            console.error(`Error fetching favorite artists: ${err.message}`);
            return;
        }

        for (const row of rows) {
            await checkNewReleaseForArtist(client, row.userId, row.artistName, row.channelId);
        }
    });
}

// Schedule the check to run daily at midnight
cron.schedule('0 0 * * *', () => {
    console.log('Running daily check for new releases');
    checkNewReleases(client);
});

module.exports = { setReminder, stopReminder, restoreReminders, setFavoriteArtist, checkNewReleases };