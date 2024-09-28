const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    require: true,
    unique: true,
  },
  phone: {
    type: Number,
  },
  password: {
    type: String,
    required: false,
  },
  googleId: {
    type: String,
    unique: true,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },

  createdOn: {
    type: Date,
    default: Date.now,
  },
  referralCode: {
    type: String,
    unique: true,
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  referredUsers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

const User = mongoose.model("User", userSchema);

module.exports = User;
