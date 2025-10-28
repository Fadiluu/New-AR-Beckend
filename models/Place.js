const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, maxlength: 1000 },
  redemption: {
    eligible: { type: Boolean, default: false },
    pointsCost: { type: Number, min: 0, default: 0 }
  },
  location: {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && coords[0] >= -180 && coords[0] <= 180 && coords[1] >= -90 && coords[1] <= 90;
        },
        message: 'Coordinates must be valid longitude/latitude values'
      }
    }
  },
  images: [{ url: { type: String, required: true }, caption: String }]
}, { timestamps: true });

placeSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Place', placeSchema);
