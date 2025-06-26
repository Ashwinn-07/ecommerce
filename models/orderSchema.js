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
      size: {
        type: String,
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

      status: {
        type: String,
        required: true,
        enum: [
          "Pending",
          "Processing",
          "Shipped",
          "Delivered",
          "Cancelled",
          "Return Pending",
          "Returned",
        ],
        default: "Pending",
      },

      cancelledAt: {
        type: Date,
      },
      returnedAt: {
        type: Date,
      },

      cancellationReason: {
        type: String,
      },
      returnReason: {
        type: String,
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
      "Partially Cancelled",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Partially Returned",
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

orderSchema.methods.updateOrderStatus = function () {
  const itemStatuses = this.orderedItems.map((item) => item.status);
  const uniqueStatuses = [...new Set(itemStatuses)];

  if (uniqueStatuses.length === 1 && uniqueStatuses[0] === "Cancelled") {
    this.status = "Cancelled";
  } else if (uniqueStatuses.length === 1 && uniqueStatuses[0] === "Delivered") {
    this.status = "Delivered";
  } else if (uniqueStatuses.length === 1 && uniqueStatuses[0] === "Returned") {
    this.status = "Returned";
  } else if (itemStatuses.includes("Cancelled")) {
    this.status = "Partially Cancelled";
  } else if (itemStatuses.includes("Returned")) {
    this.status = "Partially Returned";
  } else {
    const statusPriority = ["Pending", "Processing", "Shipped", "Delivered"];
    let highestStatus = "Pending";

    for (const status of itemStatuses) {
      if (
        statusPriority.indexOf(status) > statusPriority.indexOf(highestStatus)
      ) {
        highestStatus = status;
      }
    }
    this.status = highestStatus;
  }
};

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
