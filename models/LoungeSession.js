const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  videoId:     { type: String, required: true },
  title:       { type: String, required: true },
  artist:      { type: String, default: '' },
  isDefault:   { type: Boolean, default: false },
  suggestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  votes:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  suggestedAt: { type: Date, default: Date.now },
});

const loungeSessionSchema = new mongoose.Schema({
  estateId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Estate', required: true, unique: true },
  isAutoDJ:  { type: Boolean, default: true },
  suggestions: [suggestionSchema],
}, { timestamps: true });

module.exports = mongoose.model('LoungeSession', loungeSessionSchema);
