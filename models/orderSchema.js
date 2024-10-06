const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },
  orderedItems: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        default: 0,
      },
    },
  ],
  totalPrice: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  finalAmount: {
    type: Number,
    required: true,
  },
  address: {
    addressType: String,
    name: String,
    city: String,
    state: String,
    pincode: Number,
    phone: String,
  },
  status: {
    type: String,
    required: true,
    enum: [
      "Pending",
      "Return Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Return Request",
      "Returned",
      "Payment Pending",
    ],
  },
  paymentMethod: {
    type: String,
    enum: ["COD", "PayPal", "Wallet"],
    required: true,
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
