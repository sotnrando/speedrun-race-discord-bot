const { SlashCommandBuilder } = require('@discordjs/builders');
const config = require('../config.json');
const presets = require('../preset-data.json');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('expertstart')
        .setDescription(`[EXPERT] Starts a new race for the selected preset code.`)
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Category of the race')
                .setRequired(true))
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
            option.setName('color-rando')
                .setDescription('Adds Color Randomizer to the seed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('magic-max')
                .setDescription('Adds Magic Max Mode to the seed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('anti-freeze')
                .setDescription('Adds Anti Freeze to the seed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('no-prologue')
                .setDescription('Removes prologue from the seed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('purse-mode')
                .setDescription('Adds Thats my Purse! to the seed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('iws')
                .setDescription('Adds Infinite Wing Smash to the seed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('fast-warp')
                .setDescription('Adds Fast Warp to the seed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('unlocked-mode')
                .setDescription('Adds Unlocked Mode to the seed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('surprise-mode')
                .setDescription('Adds Surprise Mode to the seed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('enemy-stat-rando')
                .setDescription('Adds Enemy Stat Randomizer to the seed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('shop-price-rando')
                .setDescription('Adds Shop Price Randomizer to the seed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('guaranteed-drops')
                .setDescription('Makes drops guaranteed fron enemies.')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('reverse-lbc')
                .setDescription('Adds Reverse Library Cardsto the seed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('godspeed-shoes')
                .setDescription('Double-tap forward to run')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('library-shortcut')
                .setDescription('Allows for quick library escape-entry')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('single-hit-gears')
                .setDescription('Adds single-hit gear mode to the seed')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('password')
                .setDescription('Password for the Bingo Room. If not given, a random password will be generated and shared.')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('lockout')
                .setDescription('If running Bingo, determines if the bingo room will use the lockout setting.')
                .setRequired(false)),
    async execute(interaction, client, race) {
        await interaction.deferReply({ ephemeral: true });
        let optionsMap = {
            "-l": interaction.options.getBoolean('color-rando'),
            "-E": interaction.options.getBoolean('enemy-stat-rando'),
            "-x": interaction.options.getBoolean('magic-max'),
            "-z": interaction.options.getBoolean('anti-freeze'),
            "-R": interaction.options.getBoolean('no-prologue'),
            "-y": interaction.options.getBoolean('purse-mode'),
            "-b": interaction.options.getBoolean('iws'),
            "-9": interaction.options.getBoolean('fast-warp'),
            "-U": interaction.options.getBoolean('unlocked-mode'),
            "-S": interaction.options.getBoolean('surprise-mode'),
            "--sh": interaction.options.getBoolean('shop-price-rando'),
            "--gd": interaction.options.getBoolean('guaranteed-drops'),
            "--rl": interaction.options.getBoolean('reverse-lbc'),
            "--gss": interaction.options.getBoolean('godspeed-shoes'),
            "--ls": interaction.options.getBoolean('library-shortcut'),
            "--gp": interaction.options.getBoolean('single-hit-gears'),
        };

        if ((race.started || !race.finished) && race.tournament && !interaction.member.roles.cache.find(x => x.id === config.refereeRoleId)) {
            await interaction.editReply({ content: 'Only referees can close tournament races!'});
            return;
        }
        let raceChannel = client.guilds.cache.first(1)[0].channels;
        const presetIds = presets.map(item => item.id);
        if(!presetIds.includes(interaction.options.getString('category'))){
            await interaction.editReply({ content: 'That is not a valid preset id!'});
            return;
        }
        race.initiate(interaction.options.getString('category'), interaction.options.getBoolean('unranked'), interaction.options.getBoolean('tournament'), interaction, raceChannel, interaction.options.getBoolean('lockout'), interaction.options.getString('password'), optionsMap);

    },
};