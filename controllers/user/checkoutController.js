const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");

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
    const { addressId, newAddress, paymentMethod } = req.body;
    console.log("Received address ID: ", addressId);
    console.log("Received new address: ", newAddress);

    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }
    if (!paymentMethod) {
      return res.status(400).json({ message: "payment method is required" });
    }
    let selectedAddress;
    if (addressId) {
      const addressDoc = await Address.findOne({
        userId,
        "address._id": addressId,
      });
      if (!addressDoc) {
        return res.status(400).json({ message: " Address not found" });
      }
      selectedAddress = addressDoc.address.id(addressId);
      console.log("Fetched Address:", selectedAddress);
    } else if (newAddress && Object.keys(newAddress).length > 0) {
      const addressDoc = await Address.findOne({ userId });
      if (addressDoc) {
        addressDoc.address.push(newAddress);
        await addressDoc.save();
        selectedAddress = addressDoc.address[addressDoc.address.length - 1];
      } else {
        const newAddressDoc = new Address({ userId, address: [newAddress] });
        await newAddressDoc.save();
        selectedAddress = newAddressDoc.address[0];
      }
    } else {
      return res.status(400).json({ message: "Address is required" });
    }

    const totalPrice = cart.items.reduce(
      (acc, item) => acc + item.totalPrice,
      0
    );

    const orderData = new Order({
      userId,
      orderedItems: cart.items.map((item) => ({
        product: item.productId,
        quantity: item.quantity,
        price: item.totalPrice,
      })),
      totalPrice: totalPrice,
      finalAmount: totalPrice,
      address: selectedAddress,
      status: "Pending",
      paymentMethod,
    });
    const order = new Order(orderData);
    const savedOrder = await order.save();

    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { quantity: -item.quantity },
      });
    }

    cart.items = [];
    await cart.save();
    req.session.lastOrderId = savedOrder._id;

    res.redirect("/order-confirmation");
  } catch (error) {
    console.error(error);
  }
};

const getOrderConfirmation = async (req, res) => {
  try {
    const orderId = req.session.lastOrderId;

    if (!orderId) {
      return res.status(404).render("error", { message: "Order not found" });
    }

    const order = await Order.findById(orderId).populate("address");

    if (!order) {
      console.log("Order not found in database:", orderId);
      return res.status(404).render("error", { message: "Order not found" });
    }
    if (!order.address) {
      console.log("Address not found for order:", orderId);
      const address = await Address.findOne({ userId: order.userId });
      if (address) {
        order.address = address;
      }
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
