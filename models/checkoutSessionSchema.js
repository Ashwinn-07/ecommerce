const mongoose = require("mongoose");

const checkoutSessionSchema = new mongoose.Schema({
  paypalOrderId: { type: String, required: true, unique: true },
  checkoutDetails: { type: Object, required: true },
  createdAt: { type: Date, default: Date.now, expires: "1h" },
});

module.exports = mongoose.model("CheckoutSession", checkoutSessionSchema);
