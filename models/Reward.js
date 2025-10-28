const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true, 
    maxlength: 100 
  },
  shortDescription: { 
    type: String, 
    required: true, 
    trim: true, 
    maxlength: 200 
  },
  description: { 
    type: String, 
    required: true, 
    maxlength: 1000 
  },
  termsAndConditions: [{
    type: String,
    trim: true,
    maxlength: 500
  }],
  pointsCost: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  type: {
    type: String,
    required: true,
    enum: ['voucher', 'discount', 'coupon', 'gift', 'experience', 'other'],
    default: 'other'
  },
  images: [{
    url: { type: String, required: true },
    caption: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  validUntil: {
    type: Date
  },
  terms: {
    type: String,
    maxlength: 2000
  }
}, { timestamps: true });

rewardSchema.index({ name: 1 });
rewardSchema.index({ type: 1 });
rewardSchema.index({ pointsCost: 1 });
rewardSchema.index({ isActive: 1 });

module.exports = mongoose.model('Reward', rewardSchema);
