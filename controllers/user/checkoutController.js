const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
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
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0 });
      await wallet.save();
    }

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const total = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
    let discount = 0;
    let finalAmount = total;

    if (req.session.appliedCouponId) {
      const appliedCoupon = await Coupon.findById(req.session.appliedCouponId);
      if (appliedCoupon && appliedCoupon.minimumPrice <= total) {
        discount = appliedCoupon.offerPrice;
        finalAmount = total - discount;
      } else {
        delete req.session.appliedCouponId;
      }
    }

    const availableCoupons = await Coupon.find({
      isList: true,
      expireOn: { $gte: new Date() },
      minimumPrice: { $lte: total },
      usedBy: { $ne: userId },
    });

    res.render("checkout", {
      addresses,
      cart,
      total,
      discount,
      finalAmount,
      availableCoupons,
      wallet,
      appliedCouponId: req.session.appliedCouponId || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "internal server error" });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    const { couponSelect } = req.body;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const subtotal = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);

    if (!couponSelect) {
      return res.json({ success: true, discount: 0, newTotal: subtotal });
    }

    const coupon = await Coupon.findById(couponSelect);
    if (!coupon) {
      return res.json({ success: false, message: "Coupon not found" });
    }

    if (coupon.usedBy.includes(userId)) {
      return res.json({
        success: false,
        message: "You have already used this coupon",
        error: "coupon_already_used",
      });
    }
    if (
      coupon &&
      coupon.isList &&
      new Date() <= coupon.expireOn &&
      subtotal >= coupon.minimumPrice
    ) {
      const discount = coupon.offerPrice;
      const newTotal = subtotal - discount;
      req.session.appliedCouponId = coupon._id;
      return res.json({
        success: true,
        subtotal: subtotal,
        discount,
        newTotal,
      });
    } else if (coupon.usedBy.includes(userId)) {
      return res.json({
        success: false,
        message: "You have already used this coupon",
      });
    } else {
      return res.json({ success: false, message: "Coupon is not valid" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const { appliedCouponId } = req.body;
    const userId = req.session.user;

    if (appliedCouponId) {
      delete req.session.appliedCouponId;

      await Coupon.findByIdAndUpdate(appliedCouponId, {
        $pull: { usedBy: userId },
      });
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const subtotal = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);

    res.json({
      success: true,
      message: "Coupon removed successfully",
      subtotal,
    });
  } catch (error) {
    console.error("Error removing coupon:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
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

    let discount = req.body.discount || 0;
    let couponApplied = req.body.couponApplied || false;
    let appliedCouponId = req.body.appliedCouponId || null;

    const finalAmount = req.body.finalAmount || totalPrice - discount;

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: finalAmount.toFixed(2),
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
    const selectedAddress = req.body.selectedAddress || req.body.addressId;
    if (!selectedAddress) {
      return res.status(400).json({ message: "Address is required" });
    }

    const address = await Address.findOne({
      userId,
      "address._id": selectedAddress,
    });

    if (!address) {
      return res.status(400).json({ message: "Address not found" });
    }

    const selectedAddressDetails = address.address.id(selectedAddress);
    const checkoutDetails = {
      userId,
      cartItems: cart.items,
      totalPrice,
      finalAmount,
      selectedAddress: selectedAddressDetails,
      couponApplied,
      appliedCouponId,
      discount,
    };
    const checkoutSession = new CheckoutSession({
      paypalOrderId: order.result.id,
      checkoutDetails,
    });
    await checkoutSession.save();
    await CheckoutSession.findByIdAndUpdate(checkoutSession._id, {
      $set: { "checkoutDetails.couponApplied": couponApplied },
    });

    const approvalUrl = order.result.links.find(
      (link) => link.rel === "approve"
    ).href;
    return { success: true, approvalUrl };
  } catch (error) {
    console.error(error);
    return { success: false };
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
        discount,
        selectedAddress,
        couponApplied,
        appliedCouponId,
      } = checkoutDetails;
      let order;
      order = await Order.findOneAndUpdate(
        { userId, status: "Payment Pending" },
        {
          $set: {
            orderedItems: cartItems.map((item) => ({
              product: item.productId,
              size: item.size,
              quantity: item.quantity,
              price: item.totalPrice,
            })),
            totalPrice,
            finalAmount,
            discount,
            address: selectedAddress,
            status: "Pending",
            paymentMethod: "PayPal",
            couponApplied,
            appliedCouponId,
          },
        },
        { new: true }
      );

      if (!order) {
        const orderData = {
          userId,
          orderedItems: cartItems.map((item) => ({
            product: item.productId,
            size: item.size,
            quantity: item.quantity,
            price: item.totalPrice,
          })),
          totalPrice: totalPrice,
          finalAmount: finalAmount,
          discount: discount,
          address: selectedAddress,
          status: "Pending",
          paymentMethod: "PayPal",
          couponApplied,
          appliedCouponId,
        };

        order = new Order(orderData);
        await order.save();
      }
      if (couponApplied && appliedCouponId) {
        await Coupon.findByIdAndUpdate(appliedCouponId, {
          $addToSet: { usedBy: userId },
        });
      }

      for (const item of cartItems) {
        await Product.findOneAndUpdate(
          { _id: item.productId, "sizes.size": item.size },
          { $inc: { "sizes.$.quantity": -item.quantity } }
        );
      }

      await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

      await CheckoutSession.findByIdAndDelete(checkoutSession._id);

      req.session.lastOrderId = order._id;
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
    const { addressId, newAddress, paymentMethod, couponSelect } = req.body;

    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (!product || product.quantity < item.quantity) {
        return res.status(400).json({
          message: `Product "${product.productName}" is out of stock or has insufficient quantity.`,
        });
      }
    }
    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({
          message: `Product "${item.productId.productName}" not found.`,
        });
      }

      const sizeIndex = product.sizes.findIndex((s) => s.size === item.size);
      if (
        sizeIndex === -1 ||
        product.sizes[sizeIndex].quantity < item.quantity
      ) {
        return res.status(400).json({
          message: `Product "${product.productName}" (${item.size}) is out of stock or has insufficient quantity.`,
        });
      }
    }

    let totalPrice = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
    let discount = 0;
    let couponApplied = false;

    if (couponSelect) {
      const coupon = await Coupon.findById(couponSelect);
      if (
        coupon &&
        coupon.isList &&
        new Date() <= coupon.expireOn &&
        totalPrice >= coupon.minimumPrice &&
        !coupon.usedBy.includes(userId)
      ) {
        discount = coupon.offerPrice;
        couponApplied = true;
        console.log("Applied discount: ", discount);
      }
    }
    const finalAmount = totalPrice - discount;
    if (paymentMethod === "COD" && finalAmount > 1000) {
      return res
        .status(400)
        .json({ message: "COD is not available for orders above Rs 1000" });
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
    if (!addressId && (!newAddress || Object.keys(newAddress).length === 0)) {
      return res.status(400).json({
        message: "Please select an existing address or add a new one.",
      });
    }
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

    if (paymentMethod === "COD") {
      const orderData = {
        userId,
        orderedItems: cart.items.map((item) => ({
          product: item.productId,
          size: item.size,
          quantity: item.quantity,
          price: item.totalPrice,
        })),
        totalPrice: totalPrice,
        finalAmount: finalAmount,
        discount: discount,
        address: selectedAddress,
        status: "Pending",
        paymentMethod,
        couponApplied: couponApplied,
      };

      const order = new Order(orderData);
      const savedOrder = await order.save();
      if (couponApplied) {
        await Coupon.findByIdAndUpdate(couponSelect, {
          $addToSet: { usedBy: userId },
        });
      }

      for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: -item.quantity },
        });
      }
      for (const item of cart.items) {
        await Product.findOneAndUpdate(
          { _id: item.productId, "sizes.size": item.size },
          { $inc: { "sizes.$.quantity": -item.quantity } }
        );
      }

      cart.items = [];
      await cart.save();

      req.session.lastOrderId = savedOrder._id;

      return res.redirect("/order-confirmation");
    } else if (paymentMethod === "PayPal") {
      try {
        req.body.discount = discount;
        req.body.couponApplied = couponApplied;
        req.body.appliedCouponId = couponSelect;
        req.body.totalPrice = totalPrice;
        req.body.finalAmount = finalAmount;
        const paypalResult = await initiatePayPalPayment(req, res);
        if (paypalResult.success) {
          return res.redirect(paypalResult.approvalUrl);
        } else {
          throw new Error("failed to initiate payment");
        }
      } catch (error) {
        console.error(error);
        const orderData = {
          userId,
          orderedItems: cart.items.map((item) => ({
            product: item.productId,
            size: item.size,
            quantity: item.quantity,
            price: item.totalPrice,
          })),
          totalPrice: totalPrice,
          finalAmount: finalAmount,
          discount: discount,
          address: selectedAddress,
          status: "Payment Pending",
          paymentMethod,
          couponApplied: couponApplied,
        };

        const order = new Order(orderData);
        const savedOrder = await order.save();

        req.session.lastOrderId = savedOrder._id;
        return res.redirect("/order-confirmation?status=payment_failed");
      }
    } else if (paymentMethod === "Wallet") {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet || wallet.balance < finalAmount) {
        return res.status(400).json({ message: "Insufficient wallet balance" });
      }

      wallet.balance -= finalAmount;
      wallet.transactions.push({
        type: "DEBIT",
        amount: finalAmount,
        description: `Payment for order`,
      });
      await wallet.save();

      const orderData = {
        userId,
        orderedItems: cart.items.map((item) => ({
          product: item.productId,
          size: item.size,
          quantity: item.quantity,
          price: item.totalPrice,
        })),
        totalPrice: totalPrice,
        finalAmount: finalAmount,
        discount: discount,
        address: selectedAddress,
        status: "Pending",
        paymentMethod,
        couponApplied: couponApplied,
      };

      const order = new Order(orderData);
      const savedOrder = await order.save();

      for (const item of cart.items) {
        await Product.findOneAndUpdate(
          { _id: item.productId, "sizes.size": item.size },
          { $inc: { "sizes.$.quantity": -item.quantity } }
        );
      }
      cart.items = [];
      await cart.save();

      if (couponApplied) {
        await Coupon.findByIdAndUpdate(couponSelect, {
          $addToSet: { usedBy: userId },
        });
      }

      req.session.lastOrderId = savedOrder._id;

      return res.redirect("/order-confirmation");
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

    const order = await Order.findById(orderId)
      .populate("address")
      .populate("orderedItems.product");

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

const continuePayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order || order.status !== "Payment Pending") {
      return res
        .status(400)
        .json({ message: "Invalid order or payment already completed" });
    }

    const paypalResult = await initiatePayPalPayment(req, res);
    if (paypalResult.success) {
      return res.redirect(paypalResult.approvalUrl);
    } else {
      return res.status(400).json({ message: "error initiating payment" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getCheckoutPage,
  checkout,
  getOrderConfirmation,
  applyCoupon,
  removeCoupon,
  paypalSuccess,
  paypalCancel,
  initiatePayPalPayment,
  continuePayment,
};
