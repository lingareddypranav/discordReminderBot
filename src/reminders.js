const db = require('./database');
const { spotifyApi, getAccessToken } = require('./spotify');
const cron = require('node-cron');

// Set a reminder
function setReminder(client, userId, task, channelId) {
    const interval = 3600000; // 1 hour in milliseconds
    db.query(`INSERT INTO reminders (userId, task, channelId, interval) VALUES ($1, $2, $3, $4)`, [userId, task, channelId, interval], (err, res) => {
        if (err) {
            client.channels.cache.get(channelId).send(`Error setting reminder: ${err.message}`);
            return;
        }
        client.channels.cache.get(channelId).send(`Ok, I will remind you about "${task}" every hour!`);
        setInterval(() => {
            client.channels.cache.get(channelId).send(`<@${userId}>, don't forget to: ${task}`);
        }, interval);
    });
}

// Stop a reminder
function stopReminder(client, userId, task, channelId) {
    db.query(`SELECT id FROM reminders WHERE userId = $1 AND task = $2`, [userId, task], (err, res) => {
        if (err) {
            client.channels.cache.get(channelId).send(`Error stopping reminder: ${err.message}`);
            return;
        }
        if (res.rows.length === 0) {
            client.channels.cache.get(channelId).send(`No active reminder found for "${task}".`);
            return;
        }
        db.query(`DELETE FROM reminders WHERE id = $1`, [res.rows[0].id], (err) => {
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
    db.query(`SELECT userId, task, channelId, interval FROM reminders`, (err, res) => {
        if (err) {
            console.error(err.message);
            return;
        }
        res.rows.forEach(row => {
            setInterval(() => {
                client.channels.cache.get(row.channelId).send(`<@${row.userId}>, don't forget to: ${row.task}`);
            }, row.interval);
        });
    });
}

// Set a favorite artist and immediately check for new releases
function setFavoriteArtist(client, userId, artistName, channelId) {
    db.query(`INSERT INTO favorite_artists (userId, artistName, lastChecked) VALUES ($1, $2, NOW())`, [userId, artistName], function(err) {
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
                db.query(`UPDATE favorite_artists SET lastChecked = NOW() WHERE userId = $1 AND artistName = $2`, [userId, artistName]);
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

// Check all artists for new releases
async function checkNewReleases(client) {
    await getAccessToken(); // Refresh the access token

    try {
        const res = await db.query(`SELECT id, userId, artistName, channelId FROM favorite_artists`);
        for (const row of res.rows) {
            await checkNewReleaseForArtist(client, row.userId, row.artistName, row.channelId);
        }
    } catch (err) {
        console.error(`Error fetching favorite artists: ${err.message}`);
    }
}

// Schedule the check to run daily at midnight
cron.schedule('0 0 * * *', () => {
    console.log('Running daily check for new releases');
    checkNewReleases(client);
});

module.exports = { setReminder, stopReminder, restoreReminders, setFavoriteArtist, checkNewReleases };