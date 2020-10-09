const mongoose = require('mongoose');

const playerSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    playerID: String,
    displayName: String,
    times: Object,
    startMMR: Number,
    currentMMR: Number,
    points: Number
});

module.exports = mongoose.model('Player', playerSchema, "players");