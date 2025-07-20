const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
const { STATUS_CODES, MESSAGES } = require("../../utils/constants");

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
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR_LOWER });
  }
};

const changeOrderStatus = async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ORDER_NOT_FOUND });
    }

    order.status = newStatus;
    await order.save();

    res.redirect("/admin/orderList");
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR_LOWER });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate(
      "orderedItems.product"
    );

    if (!order) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ORDER_NOT_FOUND });
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
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR_LOWER });
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
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ORDER_NOT_FOUND });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ITEM_NOT_FOUND });
    }

    if (item.status === "Cancelled") {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: MESSAGES.ERROR.ITEM_ALREADY_CANCELLED });
    }

    if (item.status === "Delivered") {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: MESSAGES.ERROR.CANNOT_CANCEL_DELIVERED });
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
      message: MESSAGES.SUCCESS.ITEM_CANCELLED,
      refundAmount: order.paymentMethod !== "COD" ? item.price : 0,
    });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
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
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ORDER_NOT_FOUND });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ITEM_NOT_FOUND });
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
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: MESSAGES.ERROR.INVALID_STATUS });
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
      message: MESSAGES.SUCCESS.ITEM_STATUS_UPDATED,
    });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

const approveReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate("userId");

    if (!order) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ORDER_NOT_FOUND });
    }

    if (order.status !== "Return Pending") {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: MESSAGES.ERROR.NOT_PENDING_RETURN });
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
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

const approveItemReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    const order = await Order.findById(orderId)
      .populate("userId")
      .populate("orderedItems.product");

    if (!order) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ORDER_NOT_FOUND });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ITEM_NOT_FOUND });
    }

    if (item.status !== "Return Pending") {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: MESSAGES.ERROR.ITEM_NOT_PENDING_RETURN });
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
      message: MESSAGES.SUCCESS.RETURN_APPROVED,
      refundAmount: item.price,
    });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
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
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ORDER_NOT_FOUND });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ITEM_NOT_FOUND });
    }

    if (item.status !== "Return Pending") {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: MESSAGES.ERROR.ITEM_NOT_PENDING_RETURN });
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
      message: MESSAGES.SUCCESS.RETURN_REJECTED,
    });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

const cancelReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ORDER_NOT_FOUND });
    }

    if (order.status !== "Return Pending") {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: MESSAGES.ERROR.NOT_PENDING_RETURN });
    }

    order.status = "Delivered";
    await order.save();

    res.redirect("/admin/orderList");
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
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
      return res.status(STATUS_CODES.NOT_FOUND).redirect("/admin/orderList");
    }

    res.render("admin-order-details", { order });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
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
