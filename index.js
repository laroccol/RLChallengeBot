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
    "187022616933040128": {platform: "steam", id: "76561198107782432", displayName: "Alerath", lastUpdatedMMR: 0}, //alerath
    "428392024014716939": {platform: "steam", id: "76561198278263410", displayName: "BubblyReaper", lastUpdatedMMR: 0}, //bubblyreaper
    "205516926208835584": {platform: "steam", id: "76561198062410935", displayName: "DarkBlader", lastUpdatedMMR: 0}, //darkblader
    "116334685872717829": {platform: "steam", id: "76561198070847183", displayName: "Krim", lastUpdatedMMR: 0}, //krim
    "145013723935932416": {platform: "steam", id: "76561198052637143", displayName: "LukedaSloth", lastUpdatedMMR: 0}, //lukedasloth
    "430417029158141954": {platform: "steam", id: "76561198311856585", displayName: "Mdlittl", lastUpdatedMMR: 0}, //mdlittle
    "751491479888986204": {platform: "xbl", id: "mrmustacheman21", displayName: "MrMustacheMan", lastUpdatedMMR: 0}, //mrmustacheman
    "388369130065231875": {platform: "steam", id: "76561198829977115", displayName: "Siick", lastUpdatedMMR: 0}, //siick
    "476657861758418944": {platform: "steam", id: "76561198814882047", displayName: "tjthemasterman", lastUpdatedMMR: 0}, //tjthemasterman
    "279809802463608832": {platform: "steam", id: "76561198067732842", displayName: "yolkk", lastUpdatedMMR: 0}, //yolkk
    "143094404608032768": {platform: "steam", id: "76561198049480636", displayName: "zader", lastUpdatedMMR: 0}, //zader
    "405730384786227200": {platform: "steam", id: "76561199084736827", displayName: "bjtrutt", lastUpdatedMMR: 0}, //bjtrutt
    "149996316334882816": {platform: "steam", id: "76561198008893298", displayName: "BoomWizard", lastUpdatedMMR: 0}, //boomwizard
    "299694944988430336": {platform: "steam", id: "76561198830139605", displayName: "GusBus", lastUpdatedMMR: 0}, //gusbus
    "245753756107538443": {platform: "steam", id: "76561198838366815", displayName: "Kelpo", lastUpdatedMMR: 0}, //kelpo
    "415905713810964481": {platform: "steam", id: "76561198845186862", displayName: "PanoramicRain", lastUpdatedMMR: 0}, //panoramicrain
    "266001817744179200": {platform: "steam", id: "76561198123365718",displayName: "PillowRL", lastUpdatedMMR: 0}, //pillowrl
    //"415964836342792213": {platform: "steam", id: ""}, //tgibbs
    "440249598326341632": {platform: "steam", id: "76561198128189081", displayName: "_Billy", lastUpdatedMMR: 0}, //underscorebilly
    "130796291650224128": {platform: "steam", id: "76561197982782157", displayName: "Watabou/Divinegon", lastUpdatedMMR: 0}
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

// Players
// -------------------------------------------------------------------------------------------------

async function AddPlayerToDatabase(memberID, displayName) {
    let newPlayer = new Player({
        _id: mongoose.Types.ObjectId(),
        playerID: memberID,
        displayName: displayName,
        times: {_origin: 1},
        startMMR1s: 0,
        startMMR2s: 0,
        startMMR3s: 0,
        points: 0
    });

    await newPlayer.save()
        .then(result => player = result)
        .catch(err => console.error(err));

    console.log("A player has been added to the database!");
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

async function UpdateMMRChanges(channel, places) {
    var embed = new Discord.MessageEmbed();
    var titleEmbed = new Discord.MessageEmbed().setColor("GOLD");
    var changes = await GetAllMMRChanges(channel);
    var sortedChanges = changes.sort((a, b) => {
        return a.threes > b.threes ? 1 : -1;
    });

    if (sortedChanges.length === 0) {
        embed.setColor("RED");
        embed.addField("No Data Found", "There are either no entries or something went wrong");
    } else if (sortedChanges.length < places) {
        for (i = 0; i < sortedChanges.length; i++) {
            embed.setColor("GOLD");
            embed.addField(`${i + 1}. ${sortedChanges[i].displayName}`, `${sortedChanges[i].threes}`);
        }
    } else {
        for (i = 0; i < places; i++) {
            embed.setColor("GOLD");
            embed.addField(`${i + 1}. ${sortedChanges[i].displayName}`, `${sortedChanges[i].threes}`);
        }
    }

    var startDate = await GetMMRStartDate();
    titleEmbed.setTitle("MMR GAIN Leaderboard");
    titleEmbed.setDescription(`Since: ${startDate}`);
    channel.send(titleEmbed);
    channel.send(embed);
}

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

// -------------------------------------------------------------------------------------------------

//MMR Helpers
// -------------------------------------------------------------------------------------------------

function GetCurrentMMR(key) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        var url = `https://rocketleague.tracker.network/rocket-league/profile/${STEAM_IDS[key].platform}/${STEAM_IDS[key].id}/overview`;
        xhr.open('get', url, true);
        xhr.onreadystatechange = function () {
            status = xhr.status;
            if (this.readyState == 4 && this.status == 200) {
                console.log(this);
                resolve(getRank(this));
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

function getRank(xml) {
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

async function GetAllMMRChanges(channel) {
    var standBy = null;
    var percent = 0;
    var count = 0;

    var changes = [];

    channel.send("Please Stand By 0%")
        .then(msg => {standBy = msg})
        .catch(err => console.error(err));
    for (var key in STEAM_IDS) {
        var rating = await GetCurrentMMR(key);
        var threesRating = rating.threes - player.startMMR3s;
        var player = await FindPlayerByID(key);
        var displayName = STEAM_IDS[key].displayName;
        if (!player) {
            await AddPlayerToDatabase(key, displayName);
            changes.push({ones: 0, twos: 0, threes: 0, displayName: displayName, playerID: key});
        } else {
            changes.push({threes: threesRating, displayName: displayName, playerID: key});
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

// -------------------------------------------------------------------------------------------------

//Individual Stats
// -------------------------------------------------------------------------------------------------

async function GetIndividualMMRChange(memberID) {
    //var displayName = STEAM_IDS[memberID].displayName;
    var player = await FindPlayerByID(memberID);
    if (player) {
        var rating = await GetCurrentMMR(memberID);
        var startDate = await GetMMRStartDate();
        var onesRating = rating.ones - player.startMMR1s;
        var twosRating = rating.twos - player.startMMR2s;
        var threesRating = rating.threes - player.startMMR3s;
        return {ones: onesRating, twos: twosRating, threes: threesRating, startDate: startDate};
    }

    return null;
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
        await AddPlayerToDatabase(member.user.id, member.displayName);
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

async function AddPointsToPlayer(playerID, inPoints) {
    var player = await FindPlayerByID(playerID);
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

async function ResetPoints(channel)
{
    for (var key in STEAM_IDS)
    {
        await Player.updateOne({playerID: key}, {points: 0});
    }
    channel.send(CreateSuccessEmbed("Points have been reset"));
}

// -------------------------------------------------------------------------------------------------

//Event Handlers
// -------------------------------------------------------------------------------------------------

async function onLeaderboard(channel) {
    UpdateMMRChanges(channel, 10);
}

async function onTop5(channel) {
    UpdateMMRChanges(channel, 5);
}

async function onStart(channel) {
    var date = new Date();
    await Map.updateOne({mapName: "Ub&7|Bh$5(w?P2m"}, {startDate: date.toLocaleString("en-US", {timeZone: "America/Chicago"})});

    for (var key in STEAM_IDS) {
        var player = FindPlayerByID(key);
        var rating = GetCurrentMMR(key);
        if (!player) {
            await AddPlayerToDatabase(key, STEAM_IDS[key].displayName);
        }

        await Player.updateOne({playerID: key}, {startMMR1s: rating.ones, startMMR2s: rating.twos, startMMR3s: rating.threes});
    }

    channel.send(CreateSuccessEmbed("Successfully Started"));
}

async function onEnd(channel) {
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
    var changes = await GetAllMMRChanges(channel);
    var sortedChanges = changes.sort((a, b) => {return a.threes > b.threes ? 1 : -1});

    var embed = CreateStandingsEmbed(`MMR Results`);
    var count = 0;
    for (const player of sortedChanges) {
        var points = POINTS_DISTRIBUTION[count];
        await AddPointsToPlayer(player.playerID, points);
        embed.addField(`${count + 1}. ${player.displayName} - ${points} points`, `${player.threes}`);
        if (count >= 2) {
            break;
        }
        count += 1;
    }
    channel.send(embed);

}

async function onMyMMR(memberID, channel) {
    var changes = await GetIndividualMMRChange(memberID);
    var embed = null;
    if (changes !== null) {
        embed = CreateSuccessEmbed('MMR Change:');
        embed.setDescription(`Since: ${changes.startDate}`);
        embed.addField('1v1', `${changes.ones}`);
        embed.addField('2v2', `${changes.twos}`);
        embed.addField('3v3', `${changes.threes}`);
    } else {
        embed = CreateErrorEmbed('Player not found');
    }

    channel.send(embed);
}

async function onDebug(channel) {
    await GetCurrentMMR("76561198052637143");
}

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
        } else if (message.content.startsWith(`${PREFIX}debug`)) {
            await onDebug(message.channel);
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
        } else if (message.content.startsWith(`${PREFIX}resetpoints`))
        {
            ResetPoints(message.channel);
        }
    }

    if (message.content.startsWith(`${PREFIX}challenges`)) {
        await ShowChallenges(message.channel);
    }
});

bot.mongoose.init();
bot.login(process.env.TOKEN);

// -------------------------------------------------------------------------------------------------
