const mongoose = require('mongoose');

const matchSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    matchID: String,
    player1ID: String,
    player2ID: String,
    winnerID: String
});

module.exports = mongoose.model('Match', playerSchema, "matches");