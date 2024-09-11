const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");

const listOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;
    const orders = await Order.find()
      .populate("userId", "name email")
      .populate("orderedItems.product")
      .sort({ createdAt: -1 })
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
  }
};

module.exports = {
  listOrders,
  changeOrderStatus,
  cancelOrder,
};
