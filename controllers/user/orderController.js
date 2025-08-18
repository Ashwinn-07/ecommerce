const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
const { STATUS_CODES, MESSAGES } = require("../../utils/constants");

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
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR_LOWER });
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
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ORDER_NOT_FOUND });
    }
    if (order.status === "Cancelled" || order.status === "Delivered") {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: MESSAGES.ERROR.CANNOT_CANCEL_ORDER });
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
      if (order.discount > 0) {
        const discountProportion = order.discount / order.totalPrice;
        const discountToDeduct = refundAmount * discountProportion;
        refundAmount = Math.max(0, refundAmount - discountToDeduct);
      }

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
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR_LOWER });
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
        .json({ message: MESSAGES.ERROR.CANNOT_CANCEL_DELIVERED_ITEM });
    }

    await Product.findOneAndUpdate(
      { _id: item.product, "sizes.size": item.size },
      { $inc: { "sizes.$.quantity": item.quantity } }
    );

    item.status = "Cancelled";
    item.cancelledAt = new Date();

    let refundAmount = item.price;
    if (order.discount > 0) {
      const itemProportion = item.price / order.totalPrice;
      const itemDiscountShare = order.discount * itemProportion;
      refundAmount = Math.max(0, item.price - itemDiscountShare);
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId });
    }

    wallet.balance += refundAmount;
    wallet.transactions.push({
      type: "CREDIT",
      amount: refundAmount,
      description: `Refund for cancelled item: ${item.product.productName}`,
    });

    await wallet.save();

    order.updateOrderStatus();
    await order.save();

    res.json({
      success: true,
      message: MESSAGES.SUCCESS.ITEM_CANCELLED,
      refundAmount: refundAmount,
    });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
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

    if (item.status !== "Delivered") {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: MESSAGES.ERROR.ITEM_CANNOT_BE_RETURNED });
    }

    item.status = "Return Pending";
    item.returnReason = returnReason;

    order.updateOrderStatus();
    await order.save();

    res.json({
      success: true,
      message: MESSAGES.SUCCESS.RETURN_REQUEST_SUBMITTED,
    });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
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
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ORDER_NOT_FOUND });
    }

    if (order.status !== "Delivered") {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: MESSAGES.ERROR.ORDER_CANNOT_BE_RETURNED });
    }

    let totalRefundAmount = 0;
    let returnedItemsPrice = 0;

    for (const item of order.orderedItems) {
      if (item.status === "Delivered") {
        returnedItemsPrice += item.price;
      }
    }

    totalRefundAmount = returnedItemsPrice;
    if (order.discount > 0 && returnedItemsPrice > 0) {
      const returnProportion = returnedItemsPrice / order.totalPrice;
      const returnDiscountShare = order.discount * returnProportion;
      totalRefundAmount = Math.max(0, returnedItemsPrice - returnDiscountShare);
    }

    if (totalRefundAmount > 0) {
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({ userId });
      }

      wallet.balance += totalRefundAmount;
      wallet.transactions.push({
        type: "CREDIT",
        amount: totalRefundAmount,
        description: "Refund for returned order",
      });

      await wallet.save();
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
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
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
      return res.status(STATUS_CODES.NOT_FOUND).redirect("/orders");
    }

    res.render("order-details", { order });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
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
