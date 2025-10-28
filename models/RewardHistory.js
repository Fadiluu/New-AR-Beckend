const mongoose = require('mongoose');

const rewardHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true, maxlength: 200 },
  timestamp: { type: Date, required: true, default: Date.now }
}, { timestamps: true });

rewardHistorySchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('RewardHistory', rewardHistorySchema);
