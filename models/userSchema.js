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
  cart: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cart",
    },
  ],
  wallet: {
    type: Number,
    default: 0,
  },
  wishlist: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wishlist",
    },
  ],
  orderHistory: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
  createdOn: {
    type: Date,
    default: Date.now,
  },
  referralCode: {
    type: String,
  },
  redeemed: {
    type: Boolean,
  },
  redeemedUsers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  searchHistory: [
    {
      category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
      brand: {
        type: String,
      },
      searchOn: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

const User = mongoose.model("User", userSchema);

module.exports = User;
