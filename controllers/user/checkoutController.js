const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");

const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const addresses = await Address.find({ userId });
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      res.redirect("/cart");
    }

    const total = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
    res.render("checkout", { addresses, cart, total });
  } catch (error) {
    console.error(error);
  }
};

const checkout = async (req, res) => {
  try {
    const { addressId, newAddress } = req.body;
    console.log("Received address ID: ", addressId);
    console.log("Received new address: ", newAddress);

    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      res.status(400).json({ message: "Cart is empty" });
    }
    let address;
    if (addressId) {
      address = await Address.findById(addressId);
      console.log("Fetched Address:", address);
    } else if (newAddress) {
      address = new Address({ ...newAddress, userId });
      await address.save();
    }
    if (!address) {
      return res.status(400).json({ message: "address required" });
    }

    const totalPrice = cart.items.reduce(
      (acc, item) => acc + item.totalPrice,
      0
    );

    const order = new Order({
      userId,
      orderedItems: cart.items.map((item) => ({
        product: item.productId,
        quantity: item.quantity,
        price: item.totalPrice,
      })),
      totalPrice,
      address: address._id,
      status: "pending",
    });
    await order.save();
    cart.items = [];
    await cart.save();

    res.redirect("/order-confirmation");
  } catch (error) {
    console.error(error);
  }
};

const getOrderConfirmation = async (req, res) => {
  try {
    const userId = req.session.user;
    const order = await Order.findOne({ userId }).sort({ createdAt: -1 });
    if (!order) {
      res.status(404).json({ message: "order not found" });
    }
    res.render("order-confirmation", { order });
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  getCheckoutPage,
  checkout,
  getOrderConfirmation,
};
