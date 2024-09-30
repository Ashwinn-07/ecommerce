const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");

const getUserOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;
    const userId = req.session.user;
    const orders = await Order.find({ userId })
      .populate("orderedItems.product")
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("orders", {
      orders,
      currentPage: page,
      totalPages: totalPages,
      totalOrders: totalOrders,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "internal server error" });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user;
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.status === "Cancelled" || order.status === "Delivered") {
      return res.status(400).json({ message: "Cannot cancel this order" });
    }

    for (const item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { quantity: item.quantity },
      });
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId });
    }

    wallet.balance += order.totalPrice;
    wallet.transactions.push({
      type: "CREDIT",
      amount: order.totalPrice,
      description: "Refund for cancelled order",
    });

    await wallet.save();

    order.status = "Cancelled";
    await order.save();

    res.redirect("/orders");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "internal server error" });
  }
};

const returnOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user;
    const { returnReason } = req.body;
    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "Delivered") {
      return res
        .status(400)
        .json({ message: "Order cannot be returned unless delivered" });
    }

    for (const item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { quantity: item.quantity },
      });
    }
    order.status = "Returned";
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId });
    }

    wallet.balance += order.totalPrice;
    wallet.transactions.push({
      type: "CREDIT",
      amount: order.totalPrice,
      description: "Refund for returned order",
    });

    await wallet.save();

    await order.save();
    res.redirect("/orders");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getUserOrders,
  cancelOrder,
  returnOrder,
};
