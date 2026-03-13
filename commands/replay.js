const { SlashCommandBuilder } = require('@discordjs/builders');
const FormData = require('form-data');
const config = require('../config.json');
const maxFileSize = 50000;
const replayFileExtension = ".sotnr";
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('replay')
        .setDescription(`Submit a replay.`)
        .addAttachmentOption(option => 
            option.setName('replay')
            .setDescription('Your replay for this race.')
            .setRequired(true)
        ),
    async execute(interaction, client, race) {
        await interaction.deferReply({ephemeral: true});
        if (!race.includes(interaction.user.id)) {
            await interaction.editReply({ content: `Can't submit replays if you are not in the race!`});
            return;
        }

        if (!race.playerHasFinished(interaction.user)) {
            await interaction.editReply({ content: `Can't submit replays if you haven't finished the race!`});
            return;
        }

        let replay = interaction.options.getAttachment('replay');

        if (replay.size > maxFileSize) {
            await interaction.editReply({ content: `File size was too large!`});
            return;
        }

        if (!replay.name.endsWith(replayFileExtension)) {
            await interaction.editReply({ content: `Invalid file type!`});
            return;
        }

        try {
            // Download the file from the attachment URL
            const response = await fetch(replay.url);
            const arrayBuffer = await response.arrayBuffer(); // Convert to binary data
            const buffer = Buffer.from(arrayBuffer);  // Convert to Buffer for Node.js compatibility

            // Create a FormData object and append the file
            const formData = new FormData();
            formData.append('replay_file', buffer, replay.name); // Add file with original name

            // Send the file to the API
            const apiResponse = await axios.post(
                `http://${config.apiUrl}:${config.apiPort}/private/match_results/replay/${race.raceId}/${interaction.user.id}`, formData, {
                headers: {
                    'Authorization': process.env.API_KEY,
                    ...formData.getHeaders(), // Set headers for multipart/form-data
                },
            });
            const replayUrl = apiResponse.data.replay_url;
            const timeSeconds = buffer.length >= 2 ? buffer.readUInt16LE(0) : null;
            race.addReplay(replayUrl, interaction.user, timeSeconds);

            await interaction.editReply({ content: 'Replay submitted!' });
        } catch (error) {
            console.error('Error uploading file:', error);
            await interaction.editReply({ content: 'Error uploading replay.' });
        }

        race.update();
    },
};