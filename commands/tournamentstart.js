const { SlashCommandBuilder } = require('@discordjs/builders');
const config = require('../config.json');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('tournamentstart')
        .setDescription(`Starts a new race with the current or upcoming tournament settings.`)
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Category of the race')
                .setRequired(true)
                .addChoices(
                    {
                        name: 'Beyond Confirmed for T1D3 B1T3 2026',
                        value: 'beyond-confirmed-sum26te',
                    },
                    {
                        name: 'Random Tournament Preset',
                        value: 'random',
                    }
                )),
    async execute(interaction, client, race) {
        let optionsMap
        
        optionsMap = {
            "-l": true,         // Color Rando
            "-E": false,        // Enemy Stat Rando
            "-x": false,         // Magic Vessels
            "-z": false,         // Anti-Freeze
            "-R": false,         // No Prologue Mode
            "-y": false,         // That's My Purse!
            "-b": false,        // Infinite Wing Smash
            "-9": false,         // Fast Warps
            "-U": false,        // Unlocked Mode
            "-S": false,        // Surprise Mode
            "--ori": false,      // First Castle Random Start
            "--ori2": false,     // Second Castle Random Start
            "--sh": false,      // Shop Price Rando
            "--gd": false,       // Guaranteed Drops
            "--rl": false,      // Reverse Library Cards
            "--gss": false,     // Godspeed Shoes
            "--ls": false,      // Library Shortcut
        };
        let category = interaction.options.getString('category')
        if(category === "random"){
            const options = ["beyond-confirmed-sum26te"];
            category = options[Math.floor(Math.random() * options.length)];
        }

        await interaction.deferReply({ ephemeral: true });
        const tournament = true;
        const unranked = false;

        if ((race.started || !race.finished) && race.tournament && !interaction.member.roles.cache.find(x => x.id === config.refereeRoleId)) {
            await interaction.editReply({ content: 'Only referees can close tournament races!'});
            return;
        }
        let raceChannel = client.guilds.cache.first(1)[0].channels;
        let tournamentLeaderboard = "t1d3-b1t3-2026";

        race.initiate(category, unranked, tournament, interaction, raceChannel, interaction.options.getBoolean('lockout'), interaction.options.getString('password'), optionsMap, tournamentLeaderboard);

    },
};

// #########- for use when there is no active tournament: -#########
// module.exports = {
//     data: new SlashCommandBuilder()
//         .setName('tournamentstart')
//         .setDescription(`Starts a new race with the current or upcoming tournament settings.`),
//     async execute(interaction, client) {
//         let output = ''

//         output += 'Hello, there!';
//         output += '\n ';
//         output += '\nThere is no active tournament at this time, please try again later!';
//         output += '\n ';
//         output += '\nApologies, call me if you need me for anything else!';

//         await interaction.reply({ content: output, ephemeral: true });
//     },
// };