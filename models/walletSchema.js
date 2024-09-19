const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  balance: {
    type: Number,
    default: 0,
    min: 0,
  },
  transactions: [
    {
      type: {
        type: String,
        enum: ["CREDIT", "DEBIT"],
        required: true,
      },
      amount: {
        type: Number,
        required: true,
      },
      description: String,
      date: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

module.exports = mongoose.model("Wallet", walletSchema);
