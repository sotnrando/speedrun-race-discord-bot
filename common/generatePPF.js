const config = require('../config.json');
const cp = require('child_process');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const {options} = require("axios");


async function sendFile(filepath, raceId, fileName) {
    try {
        // Create a FormData instance
        const form = new FormData();

        // Append the file
        form.append('seed_file', fs.createReadStream(filepath), fileName);

        // Use axios to send the form-data
        await axios.post(
            `http://${config.apiUrl}:${config.apiPort}/private/match_results/seed/${raceId}`, form, {
                headers: {
                    'Authorization': process.env.API_KEY,
                    ...form.getHeaders(), // Set headers for multipart/form-data
                },
            });

        console.log('Seed file uploaded successfully');
    } catch (error) {
        console.error('Error uploading file:', error.response?.data || error.message);
    }
}


const mapColors = [
    "u",
    "r",
    "g",
    "p",
    "n",
    "k",
    "b",
    "i",
    "y"
]

function sendReply(patchFilePath,patchFileName,output, channel, interaction,isRace) {
    if (fs.existsSync(patchFilePath)) {
        console.log("here");
        let files = []
        if(!isRace){
            files = [{
                attachment: patchFilePath,
                name: patchFileName
            }]
        }
        else{
            channel.then(ch => {
                ch.send({
                    content: output,
                    files: [{
                        attachment: patchFilePath,
                        name: patchFileName
                    }],
                })
            }).catch(console.error);
        }
        interaction.editReply({ 
            content: output,
            files: files
        ,});
    }
}

function sendErrorReply(interaction) {
    interaction.editReply({
        content: "TinMan Encountered an error, please try again!",
    });
}

module.exports = async (seed, seedName, channel, catagory, tournament,interaction, randoMusic, isRace, raceId, optionsMap) => {
    let month = new Date().getMonth() + 1;
    let day = new Date().getDate();
    let isAprilFools = month === 4 && day === 1;

    console.log(month + '/' + day + ' - ' + seedName);
    
    if (isAprilFools){
        catagory = 'april-fools'
    }

    let patchFileName = catagory + "-" + seedName + ".ppf";
    let randoPath = config.randoPath;

    console.log("generating seed...");

    let logs = '';
    let newlogs = '';
    let args = ["-o", config.patchFolder + patchFileName, "-p", catagory, "-s", seedName,"-l"]; // removed , "--race" because the race tag forces url gen and url gen is dead to me FUCK URL GEN

    if (!randoMusic && catagory !== "boss-rush" && catagory !== "bingo"){
        args.push("--opt","~m")
    }
    if (catagory === "bingo"){
        args.push("--opt","~r")
    }
    console.log(randoPath + "randomize", args);
    if (tournament && catagory !== "boss-rush"){
        args.push("-t","--zr","--os")
    }
    if(optionsMap){
        for(const key in optionsMap){
            if(optionsMap[key]){
                args.push(key)
            }
        }
    }
    console.log(randoPath + "randomize", args);
    let randomizer;
    randomizer = cp.fork(randoPath + "randomize", args, { cwd: randoPath, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });


    randomizer.stdout.on('data', (outdata) => {
        logs += outdata;
    });
    randomizer.stderr.on('data' ,  (outdata) => {
        console.log(outdata);
    });
    randomizer.on('exit', async () => {
        console.log('logged: ' + logs);
        let output = `Successfully generated seed ${seedName} of preset ${catagory}!\n`;
        logs = logs.replace(/(?:\r\n|\r|\n)/g, ',').replace(/\s\s+/g, ' ');
        let items = logs.split('Starting equipment:, ')[1];
        // if(catagory === "boss-rush" || catagory === "bountyhunter"){
        //     items = items?.split('Relic locations:, ') ?? "";
        //     if(items?.length>0){items=items[0]}
        // }
        output+= 'https://ppf.sotn.io/'
        output += '\n Starting equipment: ||' + items + '||';
        // if(catagory === "bountyhunter" || catagory === "chaos" || catagory === "chaos-lite" || catagory === "bountyhuntertc" || catagory === "hitman"){
        //     let ars = "-input";
        //     if(catagory === "bountyhuntertc"){
        //         ars = "-tconf";
        //     }else if(catagory === "hitman"){
        //         ars = "-hitmn";
        //     }
        //     let ppfApplier = cp.exec("D:/GithubDesktop/Repositories/speedrun-race-discord-bot/scripts/genBH.sh " + config.sotnVanillaBinPath + " " + config.ppfApplierPath + " " +config.patchFolder + patchFileName + " " + config.bhGeneratorToolPath + " " + ars);
        //     ppfApplier.stderr.on('data', (outdata) => {
        //         newlogs += outdata;
        //     });
        //     ppfApplier.on('exit', async () => {
        //         console.log(newlogs);
        //         try {
        //             sendReply(config.patchFolder + patchFileName,patchFileName,output,channel.fetch(config.raceChannelId),interaction, isRace)
        //             sendFile(config.patchFolder + patchFileName, raceId, patchFileName)
        //         } catch{
        //             await sendErrorReply(interaction);
        //         }
        //     });
        // }
        // else {
        try {
            sendReply(config.patchFolder + patchFileName,patchFileName,output,channel.fetch(config.raceChannelId),interaction, isRace)
            sendFile(config.patchFolder + patchFileName, raceId, patchFileName)
        } catch{
            await sendErrorReply(interaction);
        }
        // }
    });
};
