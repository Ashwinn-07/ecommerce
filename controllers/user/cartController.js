const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");

const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (product.quantity < quantity) {
      return res.status(400).json({ message: "Not enough stock" });
    }
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }
    const existingProductIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (existingProductIndex !== -1) {
      cart.items[existingProductIndex].quantity = quantity;
      cart.items[existingProductIndex].totalPrice =
        product.salePrice * quantity;
    } else {
      cart.items.push({
        productId,
        quantity,
        price: product.salePrice,
        totalPrice: product.salePrice * quantity,
      });
    }
    await cart.save();
    res.redirect("/cart");
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error adding to cart", error: error.message });
  }
};

const getCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      return res.render("cart", { cart: { items: [] }, total: 0 });
    }
    const total = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
    res.render("cart", { cart, total });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error fetching cart", error: error.message });
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
      return res.status(404).json({ message: "Cart not found" });
    }

    res.redirect("/cart");
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error removing from cart", error: error.message });
  }
};

const updateCartQuantity = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({ message: "Not enough stock" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].totalPrice = product.salePrice * quantity;
    } else {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    await cart.save();

    const cartTotal = cart.items.reduce(
      (total, item) => total + item.totalPrice,
      0
    );

    res.json({
      success: true,
      message: "Cart updated successfully",
      newQuantity: quantity,
      newItemTotal: product.salePrice * quantity,
      newCartTotal: cartTotal,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error updating cart", error: error.message });
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
    res
      .status(500)
      .json({ message: "Error calculating cart total", error: error.message });
  }
};

module.exports = {
  addToCart,
  getCart,
  removeFromCart,
  updateCartQuantity,
  getCartTotal,
};
