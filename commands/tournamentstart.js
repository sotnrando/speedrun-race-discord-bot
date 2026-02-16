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
                        name: 'Lycanthrope - Transform Tournament 2026',
                        value: 'lycanthrope-spr26te',
                    },
                    {
                        name: 'Nimble Lite - Transform Tournament 2026',
                        value: 'nimble-lite-spr26te',
                    },
                    {
                        name: 'Warlock - Transform Tournament 2026',
                        value: 'warlock-spr26te',
                    },
                    {
                        name: 'Random Tournament Preset',
                        value: 'random',
                    }
                )),
    async execute(interaction, client, race) {
        let optionsMap
        
        optionsMap = {
            "-l": false,         // Color Rando
            "-E": false,        // Enemy Stat Rando
            "-x": true,         // Magic Vessels
            "-z": false,         // Anti-Freeze
            "-R": false,         // No Prologue Mode
            "-y": false,         // That's My Purse!
            "-b": false,        // Infinite Wing Smash
            "-9": true,         // Fast Warps
            "-U": false,        // Unlocked Mode
            "-S": false,        // Surprise Mode
            "--ori": true,      // First Castle Random Start
            "--ori2": false,     // Second Castle Random Start
            "--sh": true,      // Shop Price Rando
            "--gd": false,       // Guaranteed Drops
            "--rl": true,      // Reverse Library Cards
            "--gss": false,     // Godspeed Shoes
            "--ls": false,      // Library Shortcut
        };
        let category = interaction.options.getString('category')
        if(category === "random"){
            const options = ["lycanthrope-spr26te", "warlock-spr26te", "nimble-lite-spr26te"];
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
        let tournamentLeaderboard = "transform-spring-2026";

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