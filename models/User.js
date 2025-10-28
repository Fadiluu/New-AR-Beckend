const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  profile: {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    pictureUrl: { type: String, trim: true }
  },
  login: {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
    password: { type: String, required: true, minlength: 6 }
  },
  rewardPoints: {
    total: { type: Number, default: 0, min: 0 }
  },
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Place' }],
  rewards: [{
    name: { type: String, required: true, trim: true, maxlength: 100 },
    shortDescription: { type: String, trim: true, maxlength: 200 },
    pointsCost: { type: Number, required: true, min: 0 },
    redeemedAt: { type: Date, required: true, default: Date.now },
    used: { type: Boolean, default: false },
    usedAt: { type: Date }
  }],
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  // Hash the user's password when it has been created or modified
  if (!this.isModified('login.password')) return next();
  try {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const salt = await bcrypt.genSalt(saltRounds);
    this.login.password = await bcrypt.hash(this.login.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  // Compare a plaintext password with the stored hashed password
  return bcrypt.compare(candidatePassword, this.login.password);
};

userSchema.set('toJSON', {
  virtuals: false,
  transform: function(doc, ret) {
    if (ret.login) delete ret.login.password;
    return ret;
  }
});

userSchema.index({ 'profile.email': 1 });
userSchema.index({ 'login.username': 1 });
userSchema.index({ 'rewardPoints.total': -1 });

module.exports = mongoose.model('User', userSchema);
