const Wishlist = require("../../models/wishlistSchema");
const { STATUS_CODES, MESSAGES } = require("../../utils/constants");

const getWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const wishlist = await Wishlist.findOne({ userId }).populate(
      "products.productId"
    );
    res.render("wishlist", { wishlist });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR_LOWER });
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
      res.json({
        success: true,
        action: "added",
        message: "Product added to wishlist",
      });
    } else {
      res.json({
        success: true,
        action: "exists",
        message: "Product already in wishlist",
      });
    }
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Error adding to wishlist" });
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
      res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: "wishlist not found" });
    }
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
