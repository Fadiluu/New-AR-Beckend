const mongoose = require('mongoose');

const checkinSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  placeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Place', required: true },
  location: {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  timestamp: { type: Date, required: true, default: Date.now }
}, { timestamps: true });

checkinSchema.index({ location: '2dsphere' });
checkinSchema.index({ userId: 1, timestamp: -1 });
checkinSchema.index({ placeId: 1, timestamp: -1 });

module.exports = mongoose.model('Checkin', checkinSchema);
