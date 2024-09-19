const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");

const getWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const wishlist = await Wishlist.findOne({ userId }).populate(
      "products.productId"
    );
    res.render("wishlist", { wishlist });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "internal server error" });
  }
};

const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.session.user;
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }
    const productExists = wishlist.products.some(
      (item) => item.productId.toString() === productId
    );
    if (!productExists) {
      wishlist.products.push({ productId });
      await wishlist.save();
      res.redirect("/wishlist");
    } else {
      res.status(400).json({ message: "product is already in wishlist" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.session.user;
    const wishlist = await Wishlist.findOne({ userId });

    if (wishlist) {
      wishlist.products = wishlist.products.filter(
        (item) => item.productId.toString() !== productId
      );
      await wishlist.save();
      res.redirect("/wishlist");
    } else {
      res.status(404).json({ message: "wishlist not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
