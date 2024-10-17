const Wishlist = require("../../models/wishlistSchema");

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
    const size = req.body.size;
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }
    const productExists = wishlist.products.some(
      (item) => item.productId.toString() === productId
    );
    if (!productExists) {
      wishlist.products.push({ productId, size });
      await wishlist.save();
      res.redirect(`/product/${productId}?wishlist=added`);
    } else {
      res.redirect(`/product/${productId}?wishlist=exists`);
    }
  } catch (error) {
    console.error(error);
    res.redirect(`/product/${productId}?wishlist=error`);
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
      res.redirect("/wishlist?action=remove&result=success");
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
