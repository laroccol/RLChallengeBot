const botconfig = require("./botconfig.json");
const Discord = require("discord.js");
const mongoose = require('mongoose');
const Player = require('./models/player');
const Map = require('./models/map')
var XMLHttpRequest = require('xhr2');

const bot = new Discord.Client({disableEveryone: true});

bot.mongoose = require('./utils/mongoose');

const PREFIX = "!";

const REPORT_CHANNEL_ID = "763218464025870337";
const LEADERBOARD_CHANNEL_ID = "763218194491899934";
const MMR_CHANNEL_ID = "761050538300801056";

const INPUT_TYPES = ["time", "score"];
const SORT_ORDERS = [1, -1];

const STEAM_IDS = {
    "187022616933040128": {platform: "steam", id: "76561198107782432", displayName: "Alerath"}, //alerath
    "428392024014716939": {platform: "steam", id: "76561198278263410", displayName: "BubblyReaper"}, //bubblyreaper
    "205516926208835584": {platform: "steam", id: "76561198062410935", displayName: "DarkBlader"}, //darkblader
    //"116334685872717829": {platform: "steam", id: ""}, //krim
    "145013723935932416": {platform: "steam", id: "76561198052637143", displayName: "LukedaSloth"}, //lukedasloth
    "430417029158141954": {platform: "steam", id: "76561198311856585", displayName: "Mdlittl"}, //mdlittle
    "751491479888986204": {platform: "xbl", id: "mrmustacheman21", displayName: "MrMustacheMan"}, //mrmustacheman
    "388369130065231875": {platform: "steam", id: "76561198829977115", displayName: "Siick"}, //siick
    //"476657861758418944": {platform: "steam", id: ""}, //tjthemasterman
    "279809802463608832": {platform: "steam", id: "76561198067732842", displayName: "yolkk"}, //yolkk
    "143094404608032768": {platform: "steam", id: "76561198049480636", displayName: "zader"}, //zader
    "405730384786227200": {platform: "steam", id: "76561199084736827", displayName: "bjtrutt"}, //bjtrutt
    "149996316334882816": {platform: "steam", id: "76561198008893298", displayName: "BoomWizard"}, //boomwizard
    "299694944988430336": {platform: "steam", id: "76561198830139605", displayName: "GusBus"}, //gusbus
    "245753756107538443": {platform: "steam", id: "76561198838366815", displayName: "Kelpo"}, //kelpo
    //"415905713810964481": {platform: "steam", id: ""}, //panoramicrain
    "266001817744179200": {platform: "steam", id: "76561198123365718",displayName: "PillowRL"}, //pillowrl
    //"415964836342792213": {platform: "steam", id: ""}, //tgibbs
    "440249598326341632": {platform: "steam", id: "76561198128189081", displayName: "_Billy"}, //underscorebilly
    "130796291650224128": {platform: "steam", id: "76561197982782157", displayName: "Watabou/Divinegon"}
}

function GetCurrentTime() {
    var currentDate = new Date();
    return currentDate.getTime();
}

function CreateErrorEmbed(title) {
    let embed = new Discord.MessageEmbed()
        .setTitle(title)
        .setColor("RED");

    return embed;
}

function CreateSuccessEmbed(title) {
    let embed = new Discord.MessageEmbed()
        .setTitle(title)
        .setColor("GREEN");

    return embed;
}

// Map
// -------------------------------------------------------------------------------------------------
async function AddMapToDatabase(name, newInputType, newSortOrder, channel) {
    if (!CheckMapParameter(newInputType, newSortOrder)) {
        channel.send(CreateErrorEmbed("Invalid Input"));
        return;
    }
    await Map.findOne({
        mapName: name
    }, (err, result) => {
        if (err) console.error(err);
        if (!result) {
            var map = new Map({
                _id: mongoose.Types.ObjectId(),
                mapName: name,
                inputType: newInputType,
                sortOrder: parseInt(newSortOrder)
            });

            map.save()
                .then(result => console.log(result))
                .catch(err => console.error(err));

            channel.send(CreateSuccessEmbed(`Successfully added challenge __**${name}**__`));

            console.log("A challenge has been added to the database!");
        } else {
            channel.send(CreateErrorEmbed(`The challenge name __**${name}**__ already exists`))
        }
    });
}

async function RemoveMapFromDatabase(name, channel) {
    let maps = await Map.deleteMany({mapName: name});
    if (maps && maps.n != 0) {
        channel.send(CreateSuccessEmbed(`Successfully deleted challenge __**${name}**__`));
    } else {
        channel.send(CreateErrorEmbed(`The challenge name __**${name}**__ does not exist`));
    }
}

async function DoesMapExist(name) {
    var mapExists = await Map.exists({mapName: name});
    return mapExists;
}

async function ShowChallenges(channel) {
    var embed = CreateSuccessEmbed("Challenges");
    await Map.find({startDate: { $exists: false}}, (err, result) => {
        if (result.length === 0) {
            embed = CreateErrorEmbed("No Challenges Available");
        } else {
            result.forEach((challenge) => {
                if (challenge.mapName) {
                    embed.addField(`${challenge.mapName}`, `Input type: ${challenge.inputType}`);
                }
            });
        }
    });

    channel.send(embed);
}

function CheckMapParameter(newInputType, newSortOrder) {
    if (!INPUT_TYPES.includes(newInputType) || !SORT_ORDERS.includes(parseInt(newSortOrder))) {
        return false;
    }
    return true;
}

// -------------------------------------------------------------------------------------------------

//LeaderBoards
// -------------------------------------------------------------------------------------------------

async function GenerateLeaderboard(map, channel) {
    var actualMap = await Map.findOne({mapName: map});
    if (actualMap) {
        myString = `times.${map}`;
        Player.aggregate([{
            "$match": {
                [myString]: { $exists: true}
            }
        }, {
            "$sort": {
                [myString]: actualMap.sortOrder
            }
        }], async (err, res) => {
            if (err) console.error(err);
            let embed = new Discord.MessageEmbed()
                .setTitle(`__**${map}**__ leaderboard`);

            if (res.length === 0) {
                embed.setColor("RED");
                embed.addField("No Data Found", "There are either no entries or something went wrong");
            } else if (res.length < 5) {
                for (i = 0; i < res.length; i++) {
                    var displayValue = await parseChallengeValue(res[i].times[map], map);
                    embed.setColor("GOLD");
                    embed.addField(`${i + 1}. ${res[i].displayName}`, displayValue);
                }
            } else {
                for (i = 0; i < 5; i++) {
                    var displayValue = await parseChallengeValue(res[i].times[map], map);
                    embed.setColor("GOLD");
                    embed.addField(`${i + 1}. ${res[i].displayName}`, displayValue);
                }
            }

            channel.send(embed);
        });
    } else {
        channel.send(CreateErrorEmbed(`The challenge name __**${map}**__ does not exist`));
    }
}

async function UpdateMMRChanges(channel, start) {
    var standBy = null;
    var percent = 0;
    var count = 0;
    channel.send("Please Stand By 0%")
        .then(msg => {standBy = msg})
        .catch(err => console.error(err));

        var embed = new Discord.MessageEmbed();
        var titleEmbed = new Discord.MessageEmbed()
        .setColor("GOLD");
    for (var key in STEAM_IDS) {
        var rating = await getHTML(key);
        var player = await FindPlayerByID(key);
        var displayName = STEAM_IDS[key].displayName;
        if (!player) {
            let newPlayer = new Player({
                _id: mongoose.Types.ObjectId(),
                playerID: key,
                displayName: displayName,
                times: {_origin: 1},
                startMMR: 0,
                currentMMR: 0,
            });
        
            await newPlayer.save()
                .then(result => player = result)
                .catch(err => console.error(err));
        
            console.log("A player has been added to the database!");
        }
        if (start) {
            await Player.updateOne({playerID: key}, {startMMR: rating, currentMMR: 0});
        } else {
            await Player.updateOne({playerID: key}, {currentMMR: (rating - player.startMMR)});
            console.log(`${rating} : ${player.startMMR}`);
            console.log(rating - player.startMMR);
        }
        percent += 6.667;
        if (percent > 100) {
            percent = 100;
        }
        count += 1
        if (count === 3) {
            await standBy.edit(`Please Stand By ${Math.floor(percent)}`);
            count = 0;
        }
    }

    if (start) {
        var date = new Date();
        await Map.updateOne({mapName: "Ub&7|Bh$5(w?P2m"}, {startDate: date.toLocaleString("en-US", {timeZone: "America/Los_Angeles"})});
    }

    await Player.find({startMMR: { $gte: 1}})
            .sort([['currentMMR', 'descending']])
            .exec((err, res)  => {
                if (err) console.error(err);
                if (res.length === 0) {
                    embed.setColor("RED");
                    embed.addField("No Data Found", "There are either no entries or something went wrong");
                } else if (res.length < 5) {
                    for (i = 0; i < res.length; i++) {
                        embed.setColor("GOLD");
                        embed.addField(`${i + 1}. ${res[i].displayName}`, `${res[i].currentMMR}`);
                    }
                } else {
                    for (i = 0; i < 5; i++) {
                        embed.setColor("GOLD");
                        embed.addField(`${i + 1}. ${res[i].displayName}`, `${res[i].currentMMR}`);
                    }
                }

            });

    var startDate = await GetMMRStartDate();
    titleEmbed.setTitle("MMR GAIN Leaderboard");
    titleEmbed.setDescription(`Since: ${startDate}`);
    standBy.delete({ timeout: 0 });
    channel.send(titleEmbed);
    channel.send(embed);
}

// -------------------------------------------------------------------------------------------------

//MMR Helpers
// -------------------------------------------------------------------------------------------------

function getHTML(key) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        var url = `https://rocketleague.tracker.network/rocket-league/profile/${STEAM_IDS[key].platform}/${STEAM_IDS[key].id}/mmr?playlist=13`;
        xhr.open('get', url, true);
        xhr.onreadystatechange = function () {
            status = xhr.status;
            if (this.readyState == 4 && this.status == 200) {
                resolve(getRank(this, "Ranked Standard 3v3"));
            } else if (this.readyState == 4) {
                resolve(0);
            }
        };
        xhr.send();
    });
}

function getRank(xml, rankString) {
    var xmlDoc = xml.response;
    var start = xmlDoc.indexOf(`"Ranked Standard 3v3"`);
    var rankKnownStart = xmlDoc.indexOf(`"metadata":{},"value":`, start);
    var secondrankKnownStart = xmlDoc.indexOf(`"metadata":{},"value":`, rankKnownStart + 22);
    var rankEnd = xmlDoc.indexOf(`,"displayValue"`, secondrankKnownStart);
    var rating = parseInt(xmlDoc.substring(secondrankKnownStart + 22, rankEnd));

    return rating;
}

async function GetMMRStartDate() {
    var map = await Map.findOne({
        mapName: "Ub&7|Bh$5(w?P2m"
    }, (err, result) => {
        if (err) console.error(err);
    });

    if (map && map.startDate) {
        return map.startDate;
    }
    return "Error";
}

// -------------------------------------------------------------------------------------------------

//Individual Stats
// -------------------------------------------------------------------------------------------------

async function GetIndividualMMRChange(memberID, channel) {
    //var displayName = STEAM_IDS[memberID].displayName;
    var player = await FindPlayerByID(memberID);
    var embed = null;
    if (player) {
        var rating = await getHTML(memberID);
        var startDate = await GetMMRStartDate();
        embed = CreateSuccessEmbed(`MMR Change: ${rating - player.startMMR}`);
        embed.setDescription(`Since: ${startDate}`);
    } else {
        embed = CreateErrorEmbed("Player not found");
    }

    channel.send(embed);
}

async function GetPlayerTime(memberID, map, channel) {
    var player =  await FindPlayerByID(memberID);
    if (player) {
        var value = player.times[map];
        if (value != undefined) {
            var displayValue = await parseChallengeValue(value, map);
            channel.send(CreateSuccessEmbed(`Your best score is ${displayValue}`));
        } else {
            channel.send(CreateErrorEmbed("This challenge does not exist or you have not entered a score for it"));
        }
    } else {
        channel.send(CreateErrorEmbed("You are not currently registered, report a score to get registered"));
    }
}

async function FindPlayerByID(memberID) {
    var player = null
    player = await Player.findOne({
        playerID: memberID
    }, (err, result) => {
        if (err) console.error(err);
    });
    return player;
}

async function parseChallengeValue(value, mapID) {
    var displayValue = "";
    var map = await Map.findOne({mapName: mapID});
    if (map) {
        var input = map.inputType;
        switch (input) {
            case "time":
                var hours = Math.floor(value / 3600);
                var minutes = Math.floor((value - (hours * 3600)) / 60);
                var seconds = value - (hours * 3600) - (minutes * 60);
                displayValue = `${hours} Hour(s) ${minutes} Minute(s) ${seconds} Second(s)`
                break;
            case "score":
                displayValue = `${value} Points`;
                break;
        }
    }

    return displayValue;
}

// -------------------------------------------------------------------------------------------------

//Reporting
// -------------------------------------------------------------------------------------------------

async function UpdateDatabaseField(member, map, value, channel) {
    var player = await FindPlayerByID(member.user.id);
    if (!player) {
        let newPlayer = new Player({
            _id: mongoose.Types.ObjectId(),
            playerID: member.user.id,
            displayName: member.displayName,
            times: {_origin: 1},
            startMMR: 0,
            currentMMR: 0,
        });
    
        await newPlayer.save()
            .then(result => player = result)
            .catch(err => console.error(err));
    
        console.log("A player has been added to the database!");
    }

    var mapExists = await DoesMapExist(map);
    if (mapExists) {
        var actualMap = await Map.findOne({mapName: map});
        var inputValue = parseInput(value, actualMap.inputType);
        var valueStored = inputValue[0];
        var valueDisplayed = inputValue[1];
        if (valueStored != -1) {
            var playerTimes = player.times;
            playerTimes[map] = valueStored;
            await Player.updateOne({playerID: member.user.id}, {times: playerTimes});
            channel.send(CreateSuccessEmbed(`${valueDisplayed}`));
        } else {
            channel.send(CreateErrorEmbed(`Invalid Input Format`));
        }
    } else {
        channel.send(CreateErrorEmbed(`The challenge name __**${map}**__ does not exist`));
    }
}

function parseInput(value, inputType) {
    var result = [-1, ""];
    switch (inputType) {
        case "time":
            if (/[0-9]h[0-5]?[0-9]m[0-5]?[0-9]s/.test(value)) {
                var times = value.split(/[a-zA-Z]/);
                var hours = parseInt(times[0]);
                var minutes = parseInt(times[1]);
                var seconds = parseInt(times[2]);
                result[0] = (hours * 3600) + (minutes * 60) + seconds;
                result[1] = `Successfully set time of ${hours} Hour(s) ${minutes} Minute(s) ${seconds} Second(s)`
            } 
            break;
        case "score":
            if (!isNaN(value)) {
                result[0] = parseInt(value);
                result[1] = `Successfully set score of ${value} Points`;
            } 
            break;
    }

    return result;
}

// -------------------------------------------------------------------------------------------------

//Event Handlers
// -------------------------------------------------------------------------------------------------

bot.on("ready", async () => {
    console.log(`${bot.user.username} is online!`);
    bot.user.setActivity("Nothing", {type: "PLAYING"});
});

bot.on("message", async (message) => {
    messageArray = message.content.split(" ");
    if (message.channel.id === REPORT_CHANNEL_ID) {
        if (message.content.startsWith(`${PREFIX}add_challenge`)) {
            if (messageArray.length === 4 && message.member.permissions.has("ADMINISTRATOR")) {
                await AddMapToDatabase(messageArray[1], messageArray[2], messageArray[3], message.channel);
            } else {
                if (message.member.permissions.has("ADMINISTRATOR")) {
                    message.channel.send(CreateErrorEmbed("Invalid format"));
                } else {
                    message.channel.send(CreateErrorEmbed("You must be an Admin to add challenges"));
                }
            }
        } else if (message.content.startsWith(`${PREFIX}remove_challenge`)) {
            if (messageArray.length === 2 && message.member.permissions.has("ADMINISTRATOR")) {
                await RemoveMapFromDatabase(messageArray[1], message.channel);
            } else {
                if (message.member.permissions.has("ADMINISTRATOR")) {
                    message.channel.send(CreateErrorEmbed("Invalid format"));
                } else {
                    message.channel.send(CreateErrorEmbed("You must be an Admin to remove challenges"));
                }
            }
        } else if (message.content.startsWith(`${PREFIX}report`)) {
            if (messageArray.length === 3) {
                await UpdateDatabaseField(message.member, messageArray[1], messageArray[2], message.channel);
                //console.log(`Updated field ${messageArray[1]} to ${messageArray[2]} for ${message.member.displayName}`)
            }
        }
    }

    if (message.channel.id === LEADERBOARD_CHANNEL_ID) {
        //GetPlayerTime(message.member.user.id, messageArray[0]);
        if (message.content.startsWith(`${PREFIX}standings`)) {
            if (messageArray.length === 2) {
                await GenerateLeaderboard(messageArray[1], message.channel);
            }
        } else if (message.content.startsWith(`${PREFIX}get`)) {
            if (messageArray.length === 2) {
                await GetPlayerTime(message.member.user.id, messageArray[1], message.channel);
            }
        } else if (message.content.startsWith(`${PREFIX}mmr`)) {
            if (messageArray.length === 1) {
                await UpdateMMRChanges(message.channel, false);
            }
        } else if (message.content.startsWith(`${PREFIX}mymmr`)) {
            if (messageArray.length === 1) {
                await GetIndividualMMRChange(message.member.user.id, message.channel);
            }
        } else if (message.content.startsWith(`${PREFIX}start`)) {
            if (messageArray.length === 1 && message.member.permissions.has("ADMINISTRATOR")) {
                await UpdateMMRChanges(message.channel, true);
            } else {
                if (message.member.permissions.has("ADMINISTRATOR")) {
                    message.channel.send(CreateErrorEmbed("Invalid format"));
                } else {
                    message.channel.send(CreateErrorEmbed("You must be an Admin to start"));
                }
            }
        }
    }

    if (message.content.startsWith(`${PREFIX}challenges`)) {
        await ShowChallenges(message.channel);
    }
});

bot.mongoose.init();
bot.login(process.env.TOKEN);

// -------------------------------------------------------------------------------------------------
