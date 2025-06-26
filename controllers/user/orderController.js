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

    const totalOrders = await Order.countDocuments({ userId });
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
    const order = await Order.findOne({ _id: orderId, userId }).populate(
      "orderedItems.product"
    );
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.status === "Cancelled" || order.status === "Delivered") {
      return res.status(400).json({ message: "Cannot cancel this order" });
    }

    let refundAmount = 0;

    for (const item of order.orderedItems) {
      if (item.status !== "Cancelled") {
        await Product.findOneAndUpdate(
          { _id: item.product, "sizes.size": item.size },
          { $inc: { "sizes.$.quantity": item.quantity } }
        );

        item.status = "Cancelled";
        item.cancelledAt = new Date();
        refundAmount += item.price;
      }
    }

    if (refundAmount > 0) {
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({ userId });
      }

      wallet.balance += refundAmount;
      wallet.transactions.push({
        type: "CREDIT",
        amount: refundAmount,
        description: "Refund for cancelled order",
      });

      await wallet.save();
    }

    order.updateOrderStatus();
    await order.save();

    res.redirect("/orders");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "internal server error" });
  }
};

const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const userId = req.session.user;

    const order = await Order.findOne({ _id: orderId, userId }).populate(
      "orderedItems.product"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found in order" });
    }

    if (item.status === "Cancelled") {
      return res.status(400).json({ message: "Item is already cancelled" });
    }

    if (item.status === "Delivered") {
      return res.status(400).json({ message: "Cannot cancel delivered item" });
    }

    await Product.findOneAndUpdate(
      { _id: item.product, "sizes.size": item.size },
      { $inc: { "sizes.$.quantity": item.quantity } }
    );

    item.status = "Cancelled";
    item.cancelledAt = new Date();

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId });
    }

    wallet.balance += item.price;
    wallet.transactions.push({
      type: "CREDIT",
      amount: item.price,
      description: `Refund for cancelled item: ${item.product.productName}`,
    });

    await wallet.save();

    order.updateOrderStatus();
    await order.save();

    res.json({
      success: true,
      message: "Item cancelled successfully",
      refundAmount: item.price,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const returnOrderItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const userId = req.session.user;
    const { returnReason } = req.body;

    const order = await Order.findOne({ _id: orderId, userId }).populate(
      "orderedItems.product"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found in order" });
    }

    if (item.status !== "Delivered") {
      return res
        .status(400)
        .json({ message: "Item cannot be returned unless delivered" });
    }

    item.status = "Return Pending";
    item.returnReason = returnReason;

    await Product.findOneAndUpdate(
      { _id: item.product, "sizes.size": item.size },
      { $inc: { "sizes.$.quantity": item.quantity } }
    );

    order.updateOrderStatus();
    await order.save();

    res.json({
      success: true,
      message: "Return request submitted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const returnOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user;
    const { returnReason } = req.body;
    const order = await Order.findOne({ _id: orderId, userId }).populate(
      "orderedItems.product"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "Delivered") {
      return res
        .status(400)
        .json({ message: "Order cannot be returned unless delivered" });
    }

    for (const item of order.orderedItems) {
      if (item.status === "Delivered") {
        item.status = "Return Pending";
        item.returnReason = returnReason;

        await Product.findOneAndUpdate(
          { _id: item.product, "sizes.size": item.size },
          { $inc: { "sizes.$.quantity": item.quantity } }
        );
      }
    }
    order.updateOrderStatus();
    await order.save();
    res.redirect("/orders");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user;

    const order = await Order.findOne({ _id: orderId, userId })
      .populate("orderedItems.product")
      .populate("userId", "name email")
      .exec();

    if (!order) {
      return res.status(404).redirect("/orders");
    }

    res.render("order-details", { order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getUserOrders,
  cancelOrder,
  cancelOrderItem,
  returnOrderItem,
  returnOrder,
  getOrderDetails,
};
