const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");

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

    order.status = "Cancelled";
    await order.save();

    res.redirect("/orders");
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  getUserOrders,
  cancelOrder,
};
