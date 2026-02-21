const config = require('../config.json');
const data = require('../data/data.js');
const elo = require('../elo/elo.js');
const seed = require('../common/seed.js');
const generatePPF = require('../common/generatePPF.js');
const lockVoiceChannel = require('../common/lockVoiceChannel');
const unlockVoiceChannel = require('../common/unlockVoiceChannel');
const updateLeaderboard = require('../common/updateLeaderboard');
const createBingosyncRoom = require('../common/createBingo.js');
const Player = require('./player.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { v4: uuidv4 } = require('uuid');

module.exports = class Race {
    constructor(client, audioPlayer) {
        this.client = client;
        this.channel = client.guilds.cache.first(1)[0].channels.fetch(config.raceChannelId);
        this.audioPlayer = audioPlayer;
        this.started = false;
        this.finished = true;
        this.startedAt = null;
        this.initiatedAt = null;
        this.players = [];
        this.offset = parseInt(config.defaultOffset);
        this.category = null;
        this.messageId = null;
        this.seed = null;
        this.seedName = '';
        this.multistream = null;
        this.status = '';
        this.tournament = false;
        this.ranked = true;
        this.message = null;
        this.replays = [];
        this.referenceReplays = {};
        this.raceId = null;
        this.forcedCategory = null;
    }

    includes(id) {
        return this.players.find(player => player.id === id) !== undefined;
    }

    isRanked() {
        return this.ranked;
    }

    removePlayer(id) {
        let player = this.players.find(player => player.id === id);
        this.players.splice(this.players.indexOf(player), 1);
    }

    addPlayer(username, id) {
        let player = new Player(username, id);
        this.players.push(player);
        data.curAddPlayer(username);
    }

    joinPlayer(user) {
        if (this.finished || this.started) {
            return;
        }
        if (this.includes(user.id)) {
            this.removePlayer(user.id);
            this.update();
            data.curRemovePlayer(user.username);
        } else {
            this.addPlayer(user.username, user.id);
            this.update();
        }
    }

    readyPlayer(user) {
        if (!this.finished && !this.started && this.includes(user.id)) {
            if (this.players.find(player => player.username === user.username).ready) {
                this.players.find(player => player.username === user.username).ready = false;
                this.update();
            } else {
                this.players.find(player => player.username === user.username).ready = true;
                this.update();
            }
        }
    }

    finishPlayer(user) {
        if (!this.finished && this.started && this.includes(user.id)) {
            if (this.players.find(player => player.username === user.username).forfeited) {
                return;
            }
            if (this.players.find(player => player.username === user.username).time) {
                this.players.find(player => player.username === user.username).time = null;
                this.update();
            } else {
                let time = new Date().getTime() - this.startedAt;
                this.players.find(player => player.username === user.username).time = time;
                this.update();
                data.curFinishPlayer(user.username, time, false);
            }
        }
    }

    playerHasFinished(user) {
        if (this.finished || this.players.find(player => player.username === user.username).time || this.players.find(player => player.username === user.username).forfeited) {
            return true;
        }
        return false;
    }

    forfeitPlayer(user) {
        if (!this.finished && this.started && this.includes(user.id)) {
            this.players.find(player => player.username === user.username).forfeited = true;
            this.update();
            data.curFinishPlayer(user.username, null, true);
        }
    }

    sortPlayers() {
        this.players.sort(function (a, b) {
            if (a.time == null) {
                if (b.time) {
                    return 1;
                }
            }
            if (b.time == null) {
                if (a.time) {
                    return -1;
                }
            }
            if (b.forfeited == true) {
                if (!a.forfeited) {
                    return 1;
                }
            }
            if (a.forfeited == true) {
                if (!b.forfeited) {
                    return -1;
                }
            }
            if (a.time > b.time) {
                return 1;
            }
            if (a.time == b.time) {
                return 0;
            }
            if (a.time < b.time) {
                return -1;
            }
            return 0;
        });
    }

    playersReady() {
        return this.players.every(x => x.ready);
    }

    playersFinished() {
        return this.players.every(x => x.time != null || x.forfeited === true);
    }

    playersForfeited() {
        return this.players.every(x => x.forfeited === true);
    }

    generateMultistream() {
        this.multistream = 'https://multistre.am/';
        this.players.forEach(player => {
            let userTwitch = data.getPlayerTwitch(player.id);
            if (userTwitch) {
                this.multistream += userTwitch + '/';
            } else {
                this.multistream += player.username.replace(/\W/gi, "") + '/';
            }
        });
    }

    addReplay(fileurl, user) {
        this.replays.push(fileurl);
        this.referenceReplays[user.id] = fileurl;
        this.players.find(player => player.username === user.username).replaySubmitted = true;
    }

    getReplays() {
        return this.replays;
    }

    allReplaysSubmitted() {
        if (!this.finished || this.playersForfeited()) {
            return false;
        }

        this.players.every(x => x.time != null || x.forfeited === true);

        for (let i = 0; i < this.players.length; i++) {
            if (!this.players[i].forfeited && !this.players[i].replaySubmitted) {
                return false;
            }
        }
        
        return true;
    }

    anyReplaysSubmitted(){
        if (!this.finished || this.playersForfeited()) {
            return false;
        }

        return this.players.some((element) => element.replaySubmitted);
    }

    setSeedName(name) {
        this.seedName = name;
    }

    getCategory() {
        if(this.forcedCategory !== null) return this.forcedCategory;
        return this.category;
    }

    initiate(category, unranked, tournament, interaction, raceChannel, bingoLockout, bingoPassword, optionsMap, forceCategory) {
        this.defaults();
        if(forceCategory) this.forcedCategory = forceCategory;
        this.status = 'RACE: WAITING FOR PLAYERS';
        this.category = category;
        this.ranked = !unranked;
        let user = interaction.user;
        this.randomusic = !interaction.options.getBoolean('vanilla-music');
        unlockVoiceChannel(this.client);
        if (category.includes("bingo")){
            createBingosyncRoom(this.client, bingoLockout, bingoPassword);
        }
        if (!category.includes('Custom')) {
            let seedData = seed(category.toLowerCase());
            this.seed = seedData;
            this.seedName = seedData.name;
            const ppfCategory =  category.toLowerCase().replace("-qualifiers", "");

            if (config.generatePPF) {
                generatePPF(this.seed, this.seedName, raceChannel, ppfCategory ,tournament, interaction,this.randomusic,true, this.raceId, optionsMap);
            }
        } else {
            var crypto = require("crypto");
            var id = crypto.randomBytes(10).toString('hex');
            this.seedName = "custom" + id;
        }        

        this.finished = false;
        this.tournament = tournament;
        data.curNewRace(this.getCategory());
        this.addPlayer(user.username, user.id);
        this.generateMultistream()
        this.initiatedAt = new Date().getTime();

        let buttonComponents = [
            new ButtonBuilder()
                .setCustomId('join')
                .setLabel('Join')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('ready')
                .setLabel('Ready')
                .setStyle(ButtonStyle.Success)
        ];

        if (this.seed && this.randomusic) {
            buttonComponents.push(
                new ButtonBuilder()
                    .setLabel('Seed')
                    .setStyle(ButtonStyle.Link)
                    .setURL(this.seed.link),
            );
        }

        buttonComponents.push(
            new ButtonBuilder()
                .setLabel('Multistream')
                .setStyle(ButtonStyle.Link)
                .setURL(this.multistream)
        );

        const buttons = new ActionRowBuilder()
            .addComponents(buttonComponents);

        let raceFooter = 'Category: ' + this.category + '\n' + "Race ID: " + this.raceId;
        const raceEmbed = new EmbedBuilder()
            .setColor(0x1f0733)
            .setTitle(((this.ranked ? 'RANKED \n' : '') + this.status))
            .setFooter({ text: raceFooter });

        this.channel.then(channel => {
            channel.send({ embeds: [raceEmbed], components: [buttons] }).then(msg => {
                this.message = msg;
                this.messageId = msg.id;
                this.updateMessage();
            })
        }).catch(console.error);
    }

    async start() {
        const sleep = m => new Promise(r => setTimeout(r, m));
        this.audioPlayer.connectToChannel();
        await sleep(1700);
        this.audioPlayer.play();
        this.status = 'GET READY';
        this.updateMessage()
        await sleep(1700);
        this.status = 'Starting in: 3';
        this.updateMessage()
        await sleep(1000);
        this.status = 'Starting in: 2';
        this.updateMessage();
        await sleep(1000);
        this.status = 'Starting in: 1';
        this.updateMessage();
        if (!this.playersReady()) {
            this.status = 'INTERRUPTED: WAITING FOR PLAYERS';
            this.updateMessage();
            return;
        }
        await sleep(1000);
        this.status = 'PLAY!';
        this.updateMessage();
        await sleep(1500);
        this.status = 'RACE STARTED'
        this.started = true;
        this.updateMessage();
        this.audioPlayer.disconnect();

        let buttonComponents = [
            new ButtonBuilder()
                .setCustomId('finish')
                .setLabel('Finish')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('forfeit')
                .setLabel('Forfeit')
                .setStyle(ButtonStyle.Danger),
        ];

        if (this.seed && this.randomusic) {
            buttonComponents.push(
                new ButtonBuilder()
                    .setLabel('Seed')
                    .setStyle(ButtonStyle.Link)
                    .setURL(this.seed.link),
            );
        }

        buttonComponents.push(
            new ButtonBuilder()
                .setLabel('Multistream')
                .setStyle(ButtonStyle.Link)
                .setURL(this.multistream)
        );

        this.startedAt = new Date().getTime() + this.offset;

        const buttons = new ActionRowBuilder()
            .addComponents(buttonComponents);

        this.message.edit({ components: [buttons] });

        lockVoiceChannel(this.client);
        data.curStartRace();
    }

    end() {
        if (!this.playersForfeited()) {
            let raceCategory = this.getCategory();
            let adjustments = elo.resolveMatch(this.players, raceCategory, this.ranked, this.raceId);
            if(this.ranked){
                for (let i = 0; i < this.players.length; i++) {
                    this.players[i].adjustment = adjustments[i];
                    data.setPlayerUsername(this.players[i].id, this.players[i].username);
                }
                updateLeaderboard(this.client, this.category);
            }            
        }

        this.status = 'RACE FINISHED';
        this.started = false;
        this.finished = true;
        this.updateMessage();
        unlockVoiceChannel(this.client);

        let buttonComponents = [];

        if (this.seed && this.randomusic) {
            buttonComponents.push(
                new ButtonBuilder()
                    .setLabel('Seed')
                    .setStyle(ButtonStyle.Link)
                    .setURL(this.seed.link),
            );
        }

        buttonComponents.push(
            new ButtonBuilder()
                .setLabel('Multistream')
                .setStyle(ButtonStyle.Link)
                .setURL(this.multistream)
        );

        const buttons = new ActionRowBuilder()
            .addComponents(buttonComponents);

        this.message.edit({ components: [buttons] });
        data.curFinishRace();
    }

    async update() {
        this.sortPlayers();

        if (!this.started && !this.finished && this.playersReady() && this.players.length > 1) {
            await this.start();
        }

        if (this.started && !this.finished && this.playersFinished()) {
            this.end();
        }

        this.updateMessage();
    }

    updateSeed() {

        let buttonComponents = [
            new ButtonBuilder()
                .setCustomId('join')
                .setLabel('Join')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('ready')
                .setLabel('Ready')
                .setStyle(ButtonStyle.Success)
        ];

        if (this.seed && this.randomusic) {
            buttonComponents.push(
                new ButtonBuilder()
                    .setLabel('Seed')
                    .setStyle(ButtonStyle.Link)
                    .setURL(this.seed.link),
            );
        }

        buttonComponents.push(
            new ButtonBuilder()
                .setLabel('Multistream')
                .setStyle(ButtonStyle.Link)
                .setURL(this.multistream)
        );

        const buttons = new ActionRowBuilder()
            .addComponents(buttonComponents);

        this.message.edit({ components: [buttons] });
    }

    updateMessage() {
        this.sortPlayers();
        let output = "";
        if(this.anyReplaysSubmitted()){
            output += `Replays:\n`;
            this.players.forEach(player => {
                if(player.replaySubmitted){
                    let replayUrl = this.referenceReplays[player.id]
                    output += `Player: ${player.username.replace(/_+/g, "_")} - [Replay Link](${replayUrl}) \n`;
                }
            })
        }

        output += "```";
        for (let i = 0; i < this.players.length; i++) {
            output += '\n';
            output += (' ' + this.players[i].username.replace(/\W/gi, "")).padEnd(20, " ");

            if (this.players[i].time || this.players[i].forfeited) {
                let rightCol = (this.players[i].forfeited) ? 'forfeited' : this.players[i].hours().toString().padStart(2, "0") + ':' + this.players[i].minutes().toString().padStart(2, "0") + ':' + this.players[i].seconds().toString().padStart(2, "0") + ' ';
                if (this.players[i].replaySubmitted) {
                    rightCol += ` (R)  `
                } else {
                    rightCol += '      '
                }
                if (this.finished && this.players[i].adjustment) {
                    rightCol += '      ' + ((this.players[i].adjustment > 0) ? '+' + this.players[i].adjustment : this.players[i].adjustment);
                }
                output += (rightCol).padEnd(22, " ");
            } else {
                let rightCol = '';
                if (!this.started) {
                    rightCol = (this.players[i].ready) ? 'ready ' : ' ';
                }
                output += (rightCol).padEnd(22, " ");
            }
        }
        if (this.players.length < 1) {
            output += ' ';

        }
        output += '```';

        const raceEmbed = new EmbedBuilder()
            .setColor(0x1f0733)
            .setTitle(((this.ranked ? 'RANKED ' : '') + this.status))
            .setDescription(output)
            .setFooter({ text: 'Category: ' + this.category + '\n' + "Race ID: " + this.raceId });

        this.message.edit({ embeds: [raceEmbed] });
    }

    restart() {
        this.started = false;
        this.finished = false;
        this.startedAt = null;
        this.initiatedAt = new Date().getTime();
        this.offset = parseInt(config.defaultOffset);
        this.status = 'RACE RESTARTED: WAITING FOR PLAYERS';
        this.players.forEach(player => {
            player.ready = false;
        });
        this.updateMessage();
        unlockVoiceChannel(this.client);
    }

    defaults() {
        this.started = false;
        this.finished = true;
        this.startedAt = null;
        this.initiatedAt = null;
        this.players = [];
        this.offset = parseInt(config.defaultOffset);
        this.category = null;
        this.messageId = null;
        this.seed = null;
        this.multistream = null;
        this.tournament = false;
        this.ranked = true;
        this.seedName = '';
        this.replays = [];
        this.raceId = uuidv4();
        this.forcedCategory = null;
    }

    close() {
        this.started = false;
        this.finished = true;
        this.offset = parseInt(config.defaultOffset);
        this.status = 'RACE CLOSED';
        this.updateMessage();
        this.audioPlayer.disconnect();

        let buttonComponents = [];

        if (this.seed && this.randomusic) {
            buttonComponents.push(
                new ButtonBuilder()
                    .setLabel('Seed')
                    .setStyle(ButtonStyle.Link)
                    .setURL(this.seed.link),
            );
        }

        buttonComponents.push(
            new ButtonBuilder()
                .setLabel('Multistream')
                .setStyle(ButtonStyle.Link)
                .setURL(this.multistream)
        );

        const buttons = new ActionRowBuilder()
            .addComponents(buttonComponents);

        this.message.edit({ components: [buttons] });
    }

    /*
    Discord.js internally retries API calls
    async retry(apiCall, retries) {
        const sleep = m => new Promise(r => setTimeout(r, m));
        for (let i = 0; i < retries; i++) {
            try {
                apiCall();
                return;
            } catch (error) {
                console.log(error);
                await sleep(Math.pow(12, i) + Math.floor(Math.random() * 10));
            }
        }
    }
    */
}