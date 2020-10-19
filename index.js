const botconfig = require("./botconfig.json");
const Discord = require("discord.js");
const mongoose = require('mongoose');
const Player = require('./models/player');
const Map = require('./models/map')
var XMLHttpRequest = require('xhr2');
var fetch = require('node-fetch');

const bot = new Discord.Client({disableEveryone: true});

bot.mongoose = require('./utils/mongoose');

const PREFIX = "!";

const REPORT_CHANNEL_IDS = ["763218464025870337", "760722612304740352"];
const LEADERBOARD_CHANNEL_IDS = ["763218194491899934", "760723745701625899"];
const MMR_CHANNEL_ID = "761050538300801056";

const INPUT_TYPES = ["time", "score"];
const SORT_ORDERS = [1, -1];

const POINTS_DISTRIBUTION = [100, 50, 25];
const CONSOLE_MULTIPLIER = 1.5;

const STEAM_IDS = {
    "187022616933040128": {platform: "steam", id: "76561198107782432", displayName: "Alerath"}, //alerath
    "428392024014716939": {platform: "steam", id: "76561198278263410", displayName: "BubblyReaper"}, //bubblyreaper
    "205516926208835584": {platform: "steam", id: "76561198062410935", displayName: "DarkBlader"}, //darkblader
    "116334685872717829": {platform: "steam", id: "76561198070847183", displayName: "Krim"}, //krim
    "145013723935932416": {platform: "steam", id: "76561198052637143", displayName: "LukedaSloth"}, //lukedasloth
    "430417029158141954": {platform: "steam", id: "76561198311856585", displayName: "Mdlittl"}, //mdlittle
    "751491479888986204": {platform: "xbl", id: "mrmustacheman21", displayName: "MrMustacheMan"}, //mrmustacheman
    "388369130065231875": {platform: "steam", id: "76561198829977115", displayName: "Siick"}, //siick
    "476657861758418944": {platform: "steam", id: "76561198814882047", displayName: "tjthemasterman"}, //tjthemasterman
    "279809802463608832": {platform: "steam", id: "76561198067732842", displayName: "yolkk"}, //yolkk
    "143094404608032768": {platform: "steam", id: "76561198049480636", displayName: "zader"}, //zader
    "405730384786227200": {platform: "steam", id: "76561199084736827", displayName: "bjtrutt"}, //bjtrutt
    "149996316334882816": {platform: "steam", id: "76561198008893298", displayName: "BoomWizard"}, //boomwizard
    "299694944988430336": {platform: "steam", id: "76561198830139605", displayName: "GusBus"}, //gusbus
    "245753756107538443": {platform: "steam", id: "76561198838366815", displayName: "Kelpo"}, //kelpo
    "415905713810964481": {platform: "steam", id: "76561198845186862", displayName: "PanoramicRain"}, //panoramicrain
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

function CreateStandingsEmbed(title) {
    let embed = new Discord.MessageEmbed()
        .setTitle(title)
        .setColor("GOLD");

    return embed;
}

// Map
// -------------------------------------------------------------------------------------------------
async function AddMapToDatabase(name, newInputType, newSortOrder, channel) {
    if (!CheckMapParameter(newInputType, newSortOrder)) {
        channel.send(CreateErrorEmbed("Invalid Input"));
        return;
    }
    var result = await DoesMapExist(name);
    if (!result || result === null) {
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
    var result = await GetAllChallenges();
    if (result && result.length !== 0) {
        result.forEach((challenge) => {
            if (challenge.mapName) {
                embed.addField(`${challenge.mapName}`, `Input type: ${challenge.inputType}`);
            }
        });
    } else {
        embed = CreateErrorEmbed("No Challenges Available");
    }
    channel.send(embed);
}

function CheckMapParameter(newInputType, newSortOrder) {
    if (!INPUT_TYPES.includes(newInputType) || !SORT_ORDERS.includes(parseInt(newSortOrder))) {
        return false;
    }
    return true;
}

async function GetAllChallenges() {
    var challenges = await Map.find({ startDate: { $exists: false}});
    return challenges;
}

// -------------------------------------------------------------------------------------------------

//LeaderBoards
// -------------------------------------------------------------------------------------------------

async function GenerateLeaderboard(map, channel) {
    var actualMap = await Map.findOne({mapName: map});
    if (actualMap) {
        var results = await GetChallengeStandings(actualMap);
        let embed = new Discord.MessageEmbed()
            .setTitle(`__**${map}**__ leaderboard`);

        if (!results || results.length === 0) {
            embed.setColor("RED");
            embed.addField("No Data Found", "There are either no entries or something went wrong");
        } else if (results.length < 5) {
            for (i = 0; i < results.length; i++) {
                var displayValue = await parseChallengeValue(results[i].times[map], map);
                embed.setColor("GOLD");
                embed.addField(`${i + 1}. ${results[i].displayName}`, displayValue);
            }
        } else {
            for (i = 0; i < 5; i++) {
                var displayValue = await parseChallengeValue(results[i].times[map], map);
                embed.setColor("GOLD");
                embed.addField(`${i + 1}. ${results[i].displayName}`, displayValue);
            }
        }

        channel.send(embed);
    } else {
        channel.send(CreateErrorEmbed(`The challenge name __**${map}**__ does not exist`));
    }
}

async function GetChallengeStandings(actualMap) {
    myString = `times.${actualMap.mapName}`;
    var standings = await Player.aggregate([{
        "$match": {
            [myString]: { $exists: true}
        }
    }, {
        "$sort": {
            [myString]: actualMap.sortOrder
        }
    }]);
    return standings;
}

async function UpdateMMRChanges(channel, start, places) {
    var embed = new Discord.MessageEmbed();
    var titleEmbed = new Discord.MessageEmbed()
        .setColor("GOLD");
    await UpdateMMR(start);

    if (start) {
        var date = new Date();
        await Map.updateOne({mapName: "Ub&7|Bh$5(w?P2m"}, {startDate: date.toLocaleString("en-US", {timeZone: "America/Chicago"})});
    }

    await Player.find({startMMR: { $gte: 1}})
            .sort([['currentMMR', 'descending']])
            .exec((err, res)  => {
                if (err) console.error(err);
                if (res.length === 0) {
                    embed.setColor("RED");
                    embed.addField("No Data Found", "There are either no entries or something went wrong");
                } else if (res.length < places) {
                    for (i = 0; i < res.length; i++) {
                        embed.setColor("GOLD");
                        embed.addField(`${i + 1}. ${res[i].displayName}`, `${res[i].currentMMR}`);
                    }
                } else {
                    for (i = 0; i < places; i++) {
                        embed.setColor("GOLD");
                        embed.addField(`${i + 1}. ${res[i].displayName}`, `${res[i].currentMMR}`);
                    }
                }

            });

    var startDate = await GetMMRStartDate();
    titleEmbed.setTitle("MMR GAIN Leaderboard");
    titleEmbed.setDescription(`Since: ${startDate}`);
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

/*
async function ajaxRequest(key) {
    var rating = 0;
    var url = `https://rocketleague.tracker.network/rocket-league/profile/${STEAM_IDS[key].platform}/${STEAM_IDS[key].id}/mmr?playlist=13`;
    await fetch(url, {
        method: "GET",
        headers: {'Content-Type': 'application/json'},
        //credentials: 'same-origin'
      })
      .then(resp => {
          if(resp.status != 200) throw new Error(resp.statusText);
          rating = getRank(resp.text(), "Ranked Standard 3v3");
      });
      return rating;
}
*/

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

async function UpdateMMR(start, channel) {
    var standBy = null;
    var percent = 0;
    var count = 0;
    channel.send("Please Stand By 0%")
        .then(msg => {standBy = msg})
        .catch(err => console.error(err));
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
                points: 0
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
            //console.log(`${rating} : ${player.startMMR}`);
            //console.log(rating - player.startMMR);
        }
        percent += 6.667;
        if (percent > 100) {
            percent = 100;
        }
        count += 1
        if (count === 3) {
            await standBy.edit(`Please Stand By ${Math.floor(percent)}%`);
            count = 0;
        }
    }

    standBy.delete({ timeout: 0 });
}

async function GetMMRStandings() {
    var players = await Player.find({startMMR: { $gte: 1}})
            .sort([['currentMMR', 'descending']]);
    return players;
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
            points: 0
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

//End Cycle
// -------------------------------------------------------------------------------------------------

async function EndCycle(channel) {
    var challenges = await GetAllChallenges();
    channel.send(CreateStandingsEmbed("Results"));
    if (challenges) {
        for (const challenge of challenges) {
            var embed = CreateStandingsEmbed(`${challenge.mapName}`);
            var standings = await GetChallengeStandings(challenge);
            if (standings) {
                var count = 0;
                for (const player of standings) {
                    var points = POINTS_DISTRIBUTION[count];
                    await AddPointsToPlayer(player, points);
                    var challengeValue = await parseChallengeValue(player.times[challenge.mapName], challenge.mapName);
                    embed.addField(`${count + 1}. ${player.displayName} - ${points} points`, `${challengeValue}`);
                    if (count >= 2) {
                        break;
                    }
                    count += 1;
                }
                channel.send(embed);
                await RemoveMapFromDatabase(challenge.mapName, channel);
            }
        }
    }
    await UpdateMMR(false, channel);
    var mmrStandings = await GetMMRStandings();
    if (mmrStandings) {
        var embed = CreateStandingsEmbed(`MMR Results`);
        var count = 0;
        for (const player of mmrStandings) {
            var points = POINTS_DISTRIBUTION[count];
            await AddPointsToPlayer(player, points);
            embed.addField(`${count + 1}. ${player.displayName}`, `${points}`);
            if (count >= 2) {
                break;
            }
            count += 1;
        }
        channel.send(embed);
    }
}

async function AddPointsToPlayer(player, inPoints) {
    if (player) {
        var id = player.playerID;
        var isConsole = STEAM_IDS[id].platform == "xbl";
        var multiplier = 1;
        if (isConsole) multipler = CONSOLE_MULTIPLIER;
        var newPoints = player.points + Math.round(inPoints * multiplier);
        await Player.updateOne({ playerID: id}, { points: newPoints});
    }
}

async function GetPointsStandings(channel) {
    myString = `points`;
    var standings = await Player.aggregate([{
        "$match": {
            [myString]: { $exists: true}
        }
    }, {
        "$sort": {
            [myString]: -1
        }
    }]);

    let embed = new Discord.MessageEmbed()
        .setTitle(`Points leaderboard`);

    if (!standings || standings.length === 0) {
        embed.setColor("RED");
        embed.addField("No Data Found", "There are either no entries or something went wrong");
    } else {
        for (i = 0; i < standings.length; i++) {
            var displayValue = standings[i].points;
            embed.setColor("GOLD");
            embed.addField(`${i + 1}. ${standings[i].displayName}`, displayValue);
        }
    }
    channel.send(embed);
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
    if (REPORT_CHANNEL_IDS.includes(message.channel.id)) {
        if (message.content.startsWith(`${PREFIX}add_challenge`)) {
            if (messageArray.length === 4 && (message.member.permissions.has("ADMINISTRATOR") || message.member.user.id === "145013723935932416")) {
                await AddMapToDatabase(messageArray[1], messageArray[2], messageArray[3], message.channel);
            } else {
                if (message.member.permissions.has("ADMINISTRATOR")) {
                    message.channel.send(CreateErrorEmbed("Invalid format"));
                } else {
                    message.channel.send(CreateErrorEmbed("You must be an Admin to add challenges"));
                }
            }
        } else if (message.content.startsWith(`${PREFIX}remove_challenge`)) {
            if (messageArray.length === 2 && (message.member.permissions.has("ADMINISTRATOR") || message.member.user.id === "145013723935932416")) {
                await RemoveMapFromDatabase(messageArray[1], message.channel);
            } else {
                if (message.member.permissions.has("ADMINISTRATOR") || message.member.user.id === "145013723935932416") {
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

    if (LEADERBOARD_CHANNEL_IDS.includes(message.channel.id)) {
        //GetPlayerTime(message.member.user.id, messageArray[0]);
        if (message.content.startsWith(`${PREFIX}standings`)) {
            if (messageArray.length === 2) {
                await GenerateLeaderboard(messageArray[1], message.channel);
            }
        } else if (message.content.startsWith(`${PREFIX}get`)) {
            if (messageArray.length === 2) {
                await GetPlayerTime(message.member.user.id, messageArray[1], message.channel);
            }
        } else if (message.content.startsWith(`${PREFIX}top5`)) {
            if (messageArray.length === 1) {
                await UpdateMMRChanges(message.channel, false, 5);
            }
        } else if (message.content.startsWith(`${PREFIX}leaderboard`)) {
            if (messageArray.length === 1) {
                await UpdateMMRChanges(message.channel, false, Object.keys(STEAM_IDS).length);
            }
        } else if (message.content.startsWith(`${PREFIX}mymmr`)) {
            if (messageArray.length === 1) {
                await GetIndividualMMRChange(message.member.user.id, message.channel);
            }
        } else if (message.content.startsWith(`${PREFIX}start`)) {
            if (messageArray.length === 1 && (message.member.permissions.has("ADMINISTRATOR") || message.member.user.id === "145013723935932416")) {
                await UpdateMMRChanges(message.channel, true, 5);
            } else {
                if (message.member.permissions.has("ADMINISTRATOR")) {
                    message.channel.send(CreateErrorEmbed("Invalid format"));
                } else {
                    message.channel.send(CreateErrorEmbed("You must be an Admin to start"));
                }
            }
        } else if (message.content.startsWith(`${PREFIX}end`)) {
            if (messageArray.length === 1 && (message.member.permissions.has("ADMINISTRATOR") || message.member.user.id === "145013723935932416")) {
                await EndCycle(message.channel);
            } else {
                if (message.member.permissions.has("ADMINISTRATOR")) {
                    message.channel.send(CreateErrorEmbed("Invalid format"));
                } else {
                    message.channel.send(CreateErrorEmbed("You must be an Admin to start"));
                }
            }
        } else if (message.content.startsWith(`${PREFIX}points`)) {
            if (messageArray.length === 1) {
                await GetPointsStandings(message.channel);
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
