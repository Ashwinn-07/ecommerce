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

const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { cancellationReason } = req.body;

    const order = await Order.findById(orderId).populate(
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
    if (cancellationReason) {
      item.cancellationReason = cancellationReason;
    }

    if (order.paymentMethod !== "COD") {
      let wallet = await Wallet.findOne({ userId: order.userId });
      if (!wallet) {
        wallet = new Wallet({ userId: order.userId });
      }

      wallet.balance += item.price;
      wallet.transactions.push({
        type: "CREDIT",
        amount: item.price,
        description: `Admin cancelled item: ${item.product.productName}`,
      });

      await wallet.save();
    }

    order.updateOrderStatus();
    await order.save();

    res.json({
      success: true,
      message: "Item cancelled successfully",
      refundAmount: order.paymentMethod !== "COD" ? item.price : 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateOrderItemStatus = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { newStatus } = req.body;

    const order = await Order.findById(orderId).populate(
      "orderedItems.product"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found in order" });
    }

    const validStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Return Pending",
      "Returned",
    ];

    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    item.status = newStatus;

    if (newStatus === "Delivered") {
      item.deliveredAt = new Date();
    } else if (newStatus === "Returned") {
      item.returnedAt = new Date();
    }

    order.updateOrderStatus();
    await order.save();

    res.json({
      success: true,
      message: "Item status updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
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

const approveItemReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    const order = await Order.findById(orderId)
      .populate("userId")
      .populate("orderedItems.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found in order" });
    }

    if (item.status !== "Return Pending") {
      return res
        .status(400)
        .json({ message: "This item is not pending return approval" });
    }

    item.status = "Returned";
    item.returnedAt = new Date();

    await Product.findOneAndUpdate(
      { _id: item.product, "sizes.size": item.size },
      { $inc: { "sizes.$.quantity": item.quantity } }
    );

    let wallet = await Wallet.findOne({ userId: order.userId });
    if (!wallet) {
      wallet = new Wallet({ userId: order.userId });
    }

    wallet.balance += item.price;
    wallet.transactions.push({
      type: "CREDIT",
      amount: item.price,
      description: `Refund for returned item: ${item.product.productName}`,
    });

    await wallet.save();

    order.updateOrderStatus();
    await order.save();

    res.json({
      success: true,
      message: "Return approved successfully",
      refundAmount: item.price,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const rejectItemReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { rejectionReason } = req.body;

    const order = await Order.findById(orderId).populate(
      "orderedItems.product"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found in order" });
    }

    if (item.status !== "Return Pending") {
      return res
        .status(400)
        .json({ message: "This item is not pending return approval" });
    }

    item.status = "Delivered";
    item.returnRejectionReason = rejectionReason;

    await Product.findOneAndUpdate(
      { _id: item.product, "sizes.size": item.size },
      { $inc: { "sizes.$.quantity": -item.quantity } }
    );

    order.updateOrderStatus();
    await order.save();

    res.json({
      success: true,
      message: "Return request rejected successfully",
    });
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

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const order = await Order.findById(orderId)
      .populate("orderedItems.product")
      .populate("userId", "name email")
      .exec();

    if (!order) {
      return res.status(404).redirect("/admin/orderList");
    }

    res.render("admin-order-details", { order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  listOrders,
  changeOrderStatus,
  cancelOrder,
  cancelOrderItem,
  updateOrderItemStatus,
  approveReturn,
  approveItemReturn,
  rejectItemReturn,
  cancelReturnRequest,
  getOrderDetails,
};
