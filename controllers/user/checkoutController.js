const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");
const paypal = require("@paypal/checkout-server-sdk");
const CheckoutSession = require("../../models/checkoutSessionSchema");

let clientId = process.env.PAYPAL_CLIENT_ID;
let clientSecret = process.env.PAYPAL_CLIENT_SECRET;
let environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
let client = new paypal.core.PayPalHttpClient(environment);

const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const addresses = await Address.find({ userId });
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const total = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);

    const availableCoupons = await Coupon.find({
      isList: true,
      expireOn: { $gte: new Date() },
      minimumPrice: { $lte: total },
    });

    res.render("checkout", { addresses, cart, total, availableCoupons });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "internal server error" });
  }
};

const couponValidate = async (req, res) => {
  try {
    const { couponId } = req.params;
    const { subtotal } = req.body;
    console.log(`Coupon ID: ${couponId}, Subtotal: ${subtotal}`);
    const coupon = await Coupon.findById(couponId);
    if (
      coupon &&
      coupon.isList &&
      new Date() <= coupon.expireOn &&
      subtotal >= coupon.minimumPrice
    ) {
      const discount = coupon.offerPrice;
      res.json({ isValid: true, discount });
    } else {
      res.json({ isValid: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const initiatePayPalPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    let totalPrice = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);

    const { appliedCouponId, discountAmount } = req.body;
    if (appliedCouponId && discountAmount) {
      totalPrice -= parseFloat(discountAmount);
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: totalPrice.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: `${req.protocol}://${req.get(
          "host"
        )}/checkout/paypal-success`,
        cancel_url: `${req.protocol}://${req.get(
          "host"
        )}/checkout/paypal-cancel`,
      },
    });

    const order = await client.execute(request);
    const checkoutDetails = {
      userId,
      cartItems: cart.items,
      totalPrice,
      finalAmount: totalPrice,
      selectedAddress: req.body.selectedAddress,
      couponApplied: !!appliedCouponId,
      appliedCouponId,
      discountAmount,
    };
    const checkoutSession = new CheckoutSession({
      paypalOrderId: order.result.id,
      checkoutDetails,
    });
    await checkoutSession.save();

    const approvalUrl = order.result.links.find(
      (link) => link.rel === "approve"
    ).href;
    res.redirect(approvalUrl);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const paypalSuccess = async (req, res) => {
  try {
    const paypalOrderId = req.query.token;

    const checkoutSession = await CheckoutSession.findOne({ paypalOrderId });

    if (!checkoutSession) {
      return res.status(400).json({ message: "Checkout session not found" });
    }

    const { checkoutDetails } = checkoutSession;

    const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
    request.requestBody({});
    const capture = await client.execute(request);

    if (capture.result.status === "COMPLETED") {
      const {
        userId,
        cartItems,
        totalPrice,
        finalAmount,
        selectedAddress,
        couponApplied,
      } = checkoutDetails;

      const orderData = {
        userId,
        orderedItems: cartItems.map((item) => ({
          product: item.productId,
          quantity: item.quantity,
          price: item.totalPrice,
        })),
        totalPrice: totalPrice,
        finalAmount: finalAmount,
        address: selectedAddress,
        status: "Pending",
        paymentMethod: "PayPal",
        couponApplied: couponApplied,
      };

      const order = new Order(orderData);
      const savedOrder = await order.save();

      for (const item of cartItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: -item.quantity },
        });
      }

      await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

      await CheckoutSession.findByIdAndDelete(checkoutSession._id);

      req.session.lastOrderId = savedOrder._id;
      res.redirect("/order-confirmation");
    } else {
      res.status(400).json({ message: "An error occurred" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const paypalCancel = (req, res) => {
  res.redirect("/checkout?error=payment_cancelled");
};

const checkout = async (req, res) => {
  try {
    const {
      addressId,
      newAddress,
      paymentMethod,
      appliedCouponId,
      discountAmount,
    } = req.body;

    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }
    if (!paymentMethod) {
      return res.status(400).json({ message: "payment method is required" });
    }
    const blockedProduct = cart.items.find((item) => item.productId.isBlocked);
    if (blockedProduct) {
      return res.status(400).json({
        message: `Product "${blockedProduct.productId.productName}" is blocked and cannot be ordered.`,
      });
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

    let totalPrice = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
    let discount = 0;
    let couponApplied = false;

    if (appliedCouponId && discountAmount) {
      const coupon = await Coupon.findById(appliedCouponId);
      if (
        coupon &&
        coupon.isList &&
        new Date() <= coupon.expireOn &&
        totalPrice >= coupon.minimumPrice
      ) {
        discount = parseFloat(discountAmount);
        couponApplied = true;
        console.log("Applied discount: ", discount);
      }
    }
    const finalAmount = totalPrice - discount;

    if (paymentMethod === "COD") {
      const orderData = {
        userId,
        orderedItems: cart.items.map((item) => ({
          product: item.productId,
          quantity: item.quantity,
          price: item.totalPrice,
        })),
        totalPrice: totalPrice,
        finalAmount: finalAmount,
        address: selectedAddress,
        status: "Pending",
        paymentMethod,
        couponApplied: couponApplied,
      };

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

      return res.redirect("/order-confirmation");
    } else if (paymentMethod === "PayPal") {
      return res.redirect("/checkout/initiate-paypal");
    } else {
      return res.status(400).json({ message: "Invalid payment method" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "internal server error" });
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
    res.status(500).json({ message: "internal server error" });
  }
};

module.exports = {
  getCheckoutPage,
  checkout,
  getOrderConfirmation,
  couponValidate,
  paypalSuccess,
  paypalCancel,
  initiatePayPalPayment,
};
