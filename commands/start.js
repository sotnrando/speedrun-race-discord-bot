const { SlashCommandBuilder } = require('@discordjs/builders');
const config = require('../config.json');
const zipReplays = require('../common/zipReplays');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start')
        .setDescription(`Starts a new race with the selected options.`)
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Category of the race')
                .setRequired(true)
                .addChoices(
                    {
                        name: 'Guarded OG',
                        value: 'guarded-og',
                    },
                    {
                        name: 'Safe',
                        value: 'safe',
                    },
                    {
                        name: 'Safe - Season 2',
                        value: 'stwosafe',
                    },
                    {
                        name: 'Casual',
                        value: 'casual',
                    },
                    {
                        name: 'Lycanthrope',
                        value: 'lycanthrope',
                    },
                    {
                        name: 'Nimble',
                        value: 'nimble',
                    },
                    {
                        name: 'Nimble Lite',
                        value: 'nimble-lite',
                    },
                    {
                        name: 'Warlock',
                        value: 'warlock',
                    },
                    {
                        name: 'Expedition',
                        value: 'expedition',
                    },
                    {
                        name: 'Mobility',
                        value: 'mobility',
                    },
                    {
                        name: 'Target Confirmed',
                        value: 'target-confirmed',
                    },
                    {
                        name: 'Rampage',
                        value: 'rampage',
                    },
                    {
                        name: 'Rampage Tournament Edition',
                        value: 'rampage-25te',
                    },
                    {
                        name: 'Beyond',
                        value: 'beyond',
                    },
                    {
                        name: 'Leg Day',
                        value: 'leg-day',
                    },
                    {
                        name: 'Big Toss',
                        value: 'big-toss',
                    },
                    {
                        name: 'Max Rando',
                        value: 'max-rando',
                    },
                    {
                        name: 'Boss Rush',
                        value: 'boss-rush',
                    },
                    {
                        name: 'Gear Rush',
                        value: 'gear-rush',
                    },
                    {
                        name: 'Recycler',
                        value: 'recycler',
                    },
                    {
                        name: 'Battle Mage',
                        value: 'battle-mage',
                    },
                    {
                        name: 'Custom',
                        value: 'Custom',
                    }
                ))
        .addBooleanOption(option =>
            option.setName('tournament')
                .setDescription('Tournament races have more restrictions for non-referees.')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('unranked')
                .setDescription('Unranked races don\'t get tracked on the leaderboards.')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('vanilla-music')
                .setDescription('Determines whether resulting seed will have randomized OST.')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('lockout')
                .setDescription('If running Bingo, determines if the bingo room will use the lockout setting.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('password')
                .setDescription('Password for the Bingo Room. If not given, a random password will be generated and shared.')
                .setRequired(false)),
    async execute(interaction, client, race) {
        if(interaction.options.getString('category')=='Custom'){
            await interaction.reply({ content: 'Custom Race Started!', ephemeral: true });
        } else {
            await interaction.deferReply({ ephemeral: true });
        }
        if ((race.started || !race.finished) && race.tournament && !interaction.member.roles.cache.find(x => x.id === config.refereeRoleId)) {
            await interaction.reply({ content: 'Only referees can close tournament races!', ephemeral: true });
            return;
        }
        let raceChannel = client.guilds.cache.first(1)[0].channels;

        race.initiate(interaction.options.getString('category'), interaction.options.getBoolean('unranked'), interaction.options.getBoolean('tournament'), interaction, raceChannel, interaction.options.getBoolean('lockout'), interaction.options.getString('password'));

    },
};