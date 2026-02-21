const playersDb = require('../data/players.json');
const eloConfig = require('../elo/eloConfig.json');
const config = require('../config.json');
const path = require('path');
const fs = require('fs');
const http = require('http');
const request = require('sync-request');

const placementMatches = (eloConfig.placementMatches);

let players = [];

function restApiCall(method, path, body = null) {
    const url = `http://${config.apiUrl}:${config.apiPort}${path}`;
    const options = {
        method: method,
        headers: {
            'Authorization': process.env.API_KEY,
            'Content-Type': 'application/json'
        }
    };

    if (body !== null) {
        options.body = JSON.stringify(body); // Set the body if present
    }

    try {
        const res = request(method, url, options);

        if (res.statusCode >= 200 && res.statusCode < 300) {
            return JSON.parse(res.getBody('utf8')); // Return parsed JSON response
        } else {
            console.error(`Request ${method} ${path} failed with status:`, res.statusCode);
            return null; // Return null for non-2xx status
        }
    } catch (error) {
        console.error("Request error:", error);
        return null; // Return null in case of error
    }
}


function restApiCallAsync(method, path, body = null) {
    return new Promise((resolve) => {
        const options = {
            hostname: config.apiUrl,
            port: config.apiPort,
            path: path,
            method: method,
            headers: {
                'Authorization': process.env.API_KEY,
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(data ? JSON.parse(data) : null);
                    } catch (e) {
                        console.error("Parse error in restApiCallAsync:", e);
                        resolve(null);
                    }
                } else {
                    console.error(`Request ${method} ${path} failed with status:`, res.statusCode);
                    resolve(null);
                }
            });
        });

        req.on('error', (error) => {
            console.error("Request error (async):", error);
            resolve(null);
        });

        if (body !== null) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}


function savePlayer(player) {
    let playerData = restApiCall("GET", `/user_by_id/${player.user_id}`);
    if (playerData !== null ) {
        // Ensure something is being updated or else just return the player data.
        if("user_id" in player && Object.keys(player).length > 1) {
            return restApiCall("PATCH", `/private/user`, player);
        }
        return playerData;
    } else {
        return restApiCall("POST", `/private/user`, player)
    }
}

function getPlayerById(id) {
    if(id < 0){
        console.log("Invalid id");
        return null;
    }
    let player = restApiCall("GET", `/user_by_id/${id}`);
    if(player === null) {
        player = savePlayer({ user_id: id }) 
    }
    player.id = player.user_id  // Added for compatibility
    return player;
}

function getPlayerRankedData(id, category){
    let playerData = getPlayerById(id);
    let playerCategoryData = null;
    for (const elo of playerData.ranked_elos){
        if(category === elo.preset){
            playerCategoryData = elo;
            playerCategoryData.id = playerData.user_id;
            playerCategoryData.username = playerData.username;
        }
    }
    return playerCategoryData;
}


function changePlayerElo(user_id, category, setElo, eloAmount){
    let dataObj = {
        "user_id": user_id,
        "preset": category,
        "set_elo": setElo,
        "elo": eloAmount
    }
    return restApiCall("PUT", "/private/elo", dataObj);
}


module.exports = {
    getPlayerIndexById(id) {
        if (players.length < 1) {
            players = playersDb;
        }
        if (id < 1) {
            console.log("Invalid id");
            return null;
        }
        let player = players.find(x => x.id === id);
        if (player) {
            return players.findIndex(x => x.id === id);
        } else {
            savePlayer({ id: id });
        }
        return players.findIndex(x => x.id === id);
    },
    checkPlayerRanked: function(id, category) {
        let playerCategoryData = getPlayerRankedData(id, category);
        if (playerCategoryData === null){
            return false;
        }
        return (playerCategoryData.matches >= placementMatches);
    },
    getPlayerTwitch: function(id) {
        let player = getPlayerById(id);
        if (player === null){
            return null;
        }
        return player.twitch;
    },
    setPlayerTwitch: function(id, twitch) {
        savePlayer({ user_id: id, twitch: twitch });
    },
    setPlayerUsername: function(id, username) {
        savePlayer({ user_id: id, username: username });
    },
    getPlayerUsername: function(id) {
        return getPlayerById(id).username;
    },
    getPlayerElo: function(id, category) {
        let playerRanked = getPlayerRankedData(id, category);
        if (playerRanked !== null && playerRanked.elo !== 0 && playerRanked.matches > 0) {
            return playerRanked.elo;
        } else {
            changePlayerElo(id, category, true, 1000);
            return 1000;
        }
    },
    uploadMatchResults: function(category, isRanked, results, raceId) {
        const reqBody = {
            "match_id": raceId,
            "preset": category,
            "match_type": isRanked ? "ranked" : "unranked",
            "results": results
        }
        return restApiCall("POST", "/private/match_results", reqBody);
    },
    getCategoryLeaderboard: function(category) {
        let leaderboard = restApiCall("GET", `/leaderboards/elo/${category}`);
        if (leaderboard === null || leaderboard.leaderboards.length === 0) {
            console.log('no board for "' + category + '"');
            return null;
        }
        let board = [];
        leaderboard.leaderboards.forEach(item => {
            board.push({
                username: item.username,
                elo: item.elo
            })
        })
        return board;
    },
    getCategoryStats: function(category) {
        let board = [];
        let stats = {
            categoryPlayers: 0
        };
        let leaderboard = restApiCall("GET", `/leaderboards/elo/${category}`);    
        if (leaderboard === null || leaderboard.leaderboards.length === 0) {
            console.log('no stats for "' + category + '"');
            return null;
        }
        leaderboard.leaderboards.forEach(item => {
            board.push({
                username: item.username,
                elo: item.elo,
                rank: item.rank
            })
        })
        stats.categoryPlayers = board.length;
        stats.top = board.slice(0, 50);
        return stats;
    },
    getPlayerStats: function(player) {
        let stats = {};
        stats.categories = [];
        let playerData = getPlayerById(player);
        if (playerData === null) {
            return stats;
        }
        stats.twitch = 'https://www.twitch.tv/' + ((playerData.twitch) ? playerData.twitch : player);
        playerData.ranked_elos.forEach(item => {
            stats.categories.push({
                name: item.preset,
                rank: item.rank,
                elo: item.elo,
                matches: item.matches
            })
        })
        return stats;
    },
    getReplays: function(raceId){
        let replays = restApiCall("GET", `/match_details/${raceId}`);
        let result = {}
        replays.results.forEach(items => {
            result[items.username] = items.replay_url
        })
        return result
    },
    curNewRace: function(category){
        restApiCall("POST", "/private/currentrace/create", {"preset": category});
    },
    curAddPlayer: function(username){
        restApiCallAsync("POST", "/private/currentrace/add", {"player_name": username});
    },
    curRemovePlayer: function(username){
        restApiCallAsync("DELETE", "/private/currentrace/remove", {"player_name": username});
    },
    curStartRace: function(){
        restApiCallAsync("POST", "/private/currentrace/start");
    },
    curFinishPlayer: function(username, time, forfeited){
        restApiCallAsync("POST", "/private/currentrace/player/finish", {"player_name": username, "finish_time": time, "forfeited": forfeited});
    },
    curFinishRace: function(){
        restApiCallAsync("POST", "/private/currentrace/race/finish");
    },
    startNewSeason: function(seasonNumber) {
        if (players.length < 1) {
            players = playersDb;
        }
        fs.writeFileSync(path.join(__dirname, '../data/season-' + seasonNumber + '.json'), JSON.stringify(players, null, 2));
        let newSeason = [];
        players.forEach(player => {
            let lastSeasonPlayer = {username: player.username, id: player.id, twitch: player.twitch};
            config.categories.forEach(category => {
                if (player[category].elo && player[category].elo < eloConfig.defaultElo - 100) {
                    lastSeasonPlayer[category].elo = eloConfig.defaultEloLow;
                } else if (player[category].elo && player[category].elo > eloConfig.defaultElo + 100) {
                    lastSeasonPlayer[category].elo = eloConfig.defaultEloHigh;
                } else {
                    lastSeasonPlayer[category].elo = eloConfig.defaultElo;
                }
            });
            newSeason.push(lastSeasonPlayer)
        });

        fs.writeFileSync(path.join(__dirname, playersDb), JSON.stringify(newSeason, null, 2));
    }
};
