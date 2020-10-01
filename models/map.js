const mongoose = require('mongoose');

const mapSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    mapName: String,
    inputType: String,
    sortOrder: Number,
    startDate: String
});

module.exports = mongoose.model('Map', mapSchema, "maps");