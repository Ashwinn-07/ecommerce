const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");

const listOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const orders = await Order.find()
      .populate("userId", "name email")
      .populate("orderedItems.product")
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);
    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("orderlist", {
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

const changeOrderStatus = async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "order not found" });
    }

    order.status = newStatus;
    await order.save();

    res.redirect("/admin/orderList");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "internal server error" });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate(
      "orderedItems.product"
    );

    if (!order) {
      return res.status(404).json({ message: "order not found" });
    }

    if (order.status !== "Cancelled") {
      for (item of order.orderedItems) {
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: { quantity: item.quantity },
        });
      }
    }

    order.status = "Cancelled";
    await order.save();

    res.redirect("/admin/orderList");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "internal server error" });
  }
};
const approveReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate("userId");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "Return Pending") {
      return res
        .status(400)
        .json({ message: "This order is not pending return approval" });
    }

    for (const item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: item.quantity },
      });
    }

    order.status = "Returned";

    let wallet = await Wallet.findOne({ userId: order.userId._id });
    if (!wallet) {
      wallet = new Wallet({ userId: order.userId._id });
    }

    wallet.balance += order.finalAmount;
    wallet.transactions.push({
      type: "CREDIT",
      amount: order.finalAmount,
      description: "Refund for returned order",
    });

    await wallet.save();
    await order.save();

    res.redirect("/admin/orderList");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const cancelReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "Return Pending") {
      return res
        .status(400)
        .json({ message: "This order is not pending return approval" });
    }

    order.status = "Delivered";
    await order.save();

    res.redirect("/admin/orderList");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  listOrders,
  changeOrderStatus,
  cancelOrder,
  approveReturn,
  cancelReturnRequest,
};
