const mongoose = require('mongoose');

const playerSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    playerID: String,
    displayName: String,
    times: Object,
    startMMR1s: Number,
    startMMR2s: Number,
    startMMR3s: Number,
    points: Number
});

module.exports = mongoose.model('Player', playerSchema, "players");