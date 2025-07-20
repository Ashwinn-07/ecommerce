const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const { STATUS_CODES, MESSAGES } = require("../../utils/constants");

const updateCartPrices = async (userId) => {
  try {
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) return;

    let updated = false;
    for (let item of cart.items) {
      const product = item.productId;
      const currentPrice = product.salePrice;

      if (item.price !== currentPrice) {
        item.price = currentPrice;
        item.totalPrice = currentPrice * item.quantity;
        updated = true;
      }

      const sizeObj = product.sizes.find((s) => s.size === item.size);
      if (!sizeObj || sizeObj.quantity === 0) {
        cart.items = cart.items.filter((cartItem) => cartItem._id !== item._id);
        updated = true;
      }
    }

    if (updated) {
      await cart.save();
    }
  } catch (error) {
    console.error("Error updating cart prices:", error);
  }
};

const addToCart = async (req, res) => {
  try {
    const { productId, quantity, selectedSize } = req.body;
    const userId = req.session.user;
    const product = await Product.findById(productId);

    if (!selectedSize) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: MESSAGES.ERROR.SIZE_REQUIRED });
    }

    if (!product) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ success: false, message: MESSAGES.ERROR.PRODUCT_NOT_FOUND });
    }

    const sizeObj = product.sizes.find((s) => s.size === selectedSize);
    if (!sizeObj || sizeObj.quantity < quantity) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ERROR.NOT_ENOUGH_STOCK,
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingProductIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId && item.size === selectedSize
    );

    if (existingProductIndex !== -1) {
      const newQuantity =
        cart.items[existingProductIndex].quantity + parseInt(quantity);

      if (sizeObj.quantity < newQuantity) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.ERROR.NOT_ENOUGH_STOCK,
        });
      }

      cart.items[existingProductIndex].quantity = newQuantity;
      cart.items[existingProductIndex].totalPrice =
        product.salePrice * newQuantity;
    } else {
      cart.items.push({
        productId,
        quantity,
        size: selectedSize,
        price: product.salePrice,
        totalPrice: product.salePrice * quantity,
      });
    }

    await cart.save();
    res.json({ success: true, message: MESSAGES.SUCCESS.ITEM_ADDED_TO_CART });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: MESSAGES.ERROR.UNEXPECTED_ERROR });
  }
};

const getCart = async (req, res) => {
  try {
    const userId = req.session.user;
    await updateCartPrices(userId);
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.render("cart", { cart: null, total: 0, products: [] });
    }
    const total = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
    const products = cart.items.map((item) => ({
      name: item.productId.productName,
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.totalPrice,
    }));
    res.render("cart", { cart, total, products });
  } catch (error) {
    console.error(error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      message: MESSAGES.ERROR.ERROR_FETCHING_CART,
      error: error.message,
    });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user;
    const result = await Cart.findOneAndUpdate(
      { userId },
      { $pull: { items: { productId: productId } } },
      { new: true }
    );

    if (!result) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.CART_NOT_FOUND });
    }

    res.redirect("/cart");
  } catch (error) {
    console.error(error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      message: MESSAGES.ERROR.ERROR_REMOVING_FROM_CART,
      error: error.message,
    });
  }
};

const updateCartQuantity = async (req, res) => {
  try {
    const { productId, quantity, size } = req.body;
    const userId = req.session.user;

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.PRODUCT_NOT_FOUND });
    }

    const sizeObj = product.sizes.find((s) => s.size === size);
    if (!sizeObj || sizeObj.quantity < quantity) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: MESSAGES.ERROR.NOT_ENOUGH_STOCK });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.CART_NOT_FOUND });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId && item.size === size
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].totalPrice = product.salePrice * quantity;
    } else {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.ITEM_NOT_FOUND_IN_CART });
    }

    await cart.save();

    const cartTotal = cart.items.reduce(
      (total, item) => total + item.totalPrice,
      0
    );

    res.json({
      success: true,
      message: MESSAGES.SUCCESS.CART_UPDATED,
      newQuantity: quantity,
      newItemTotal: product.salePrice * quantity,
      newCartTotal: cartTotal,
    });
  } catch (error) {
    console.error(error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      message: MESSAGES.ERROR.ERROR_UPDATING_CART,
      error: error.message,
    });
  }
};

const getCartTotal = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.json({ total: 0 });
    }

    const total = cart.items.reduce((acc, item) => {
      return acc + item.quantity * item.productId.salePrice;
    }, 0);

    res.json({ total });
  } catch (error) {
    console.error(error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      message: MESSAGES.ERROR.ERROR_CALCULATING_CART_TOTAL,
      error: error.message,
    });
  }
};

module.exports = {
  addToCart,
  getCart,
  removeFromCart,
  updateCartQuantity,
  getCartTotal,
  updateCartPrices,
};
