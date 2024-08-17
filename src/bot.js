require('dotenv').config();

//console.log(process.env.DISCORDJS_BOT_TOKEN);
const { Client, GatewayIntentBits } = require('discord.js');

const { restoreReminders, setReminder, stopReminder, setFavoriteArtist } = require('./reminders');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           
        GatewayIntentBits.GuildMessages,    
        GatewayIntentBits.MessageContent
    ]
});
const PREFIX = "$";

client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith(PREFIX)) {
        const [CMD_NAME, ...args] = message.content.trim().substring(PREFIX.length).split(/\s+/);
        if (CMD_NAME === 'remind') {
            if (args.length === 0) {
                message.channel.send('Please provide a task to remind you about.');
                return;
            }
            const task = args.join(' ');
            setReminder(client, message.author.id, task, message.channel.id); // Call the function from reminders.js

        } else if (CMD_NAME === 'stopremind') {
            if (args.length === 0) {
                message.channel.send('Please provide the task you want to stop being reminded about.');
                return;
            }
            const task = args.join(' ');
            stopReminder(client, message.author.id, task, message.channel.id); // Call the function from reminders.js
        } else if (CMD_NAME === 'favartist') {
            if (args.length === 0) {
                message.channel.send('Please provide the name of your favorite artist.');
                return;
            }
            const artistName = args.join(' ');
            setFavoriteArtist(client, message.author.id, artistName, message.channel.id);
        }
    }
})

client.once('ready', () => {
    console.log('Bot is online!');
    restoreReminders(client); // Restore reminders on startup using the client
});

client.login(process.env.DISCORDJS_BOT_TOKEN);