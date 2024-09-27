const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController");
const cartController = require("../controllers/user/cartController");
const addressController = require("../controllers/user/addressController");
const checkoutController = require("../controllers/user/checkoutController");
const orderController = require("../controllers/user/orderController");
const wishlistController = require("../controllers/user/wishlistController");
const walletController = require("../controllers/user/walletController");
const invoiceController = require("../controllers/user/invoiceController");
const { userAuth, adminAuth } = require("../middlewares/auth");
const passport = require("passport");

router.use((req, res, next) => {
  if (req.session.user && req.session.user.isDemo) {
    res.locals.user = { ...req.session.user, isDemo: true };
  } else {
    res.locals.user = req.session.user;
  }
  next();
});

router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    console.log("User logged in");
    req.session.userId = req.user._id;
    res.locals.user = req.user;
    res.redirect("/");
  }
);
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.get("/logout", userController.logout);

router.get("/shop", userController.loadShopPage);
router.get("/product/:id", userController.loadProductDetails);
router.post("/product/review", userAuth, userController.addReview);

router.get("/forgot-password", profileController.getForgotPassPage);
router.post("/forgot-email-valid", profileController.forgotEmailValid);
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp);
router.get("/reset-password", profileController.getResetPassPage);
router.post("/reset-password", profileController.postNewPassword);
router.post("/resend-forgot-otp", profileController.resendOtp);

router.get("/profile", userAuth, profileController.getProfile);
router.post("/profile/edit", userAuth, profileController.editProfile);

router.get("/cart", userAuth, cartController.getCart);
router.post("/add-to-cart", userAuth, cartController.addToCart);
router.post("/cart/remove/:id", userAuth, cartController.removeFromCart);
router.post("/cart/update", userAuth, cartController.updateCartQuantity);
router.get("/cart/total", userAuth, cartController.getCartTotal);

router.get("/addresses", userAuth, addressController.getAddress);
router.get("/address/add", userAuth, addressController.getAddAddress);
router.post("/address/add", userAuth, addressController.addAddress);
router.get("/address/edit/:id", userAuth, addressController.getEditAddress);
router.post("/address/edit/:id", userAuth, addressController.editAddress);
router.post("/address/delete/:id", userAuth, addressController.deleteAddress);

router.get("/checkout", userAuth, checkoutController.getCheckoutPage);
router.post("/checkout/place-order", userAuth, checkoutController.checkout);
router.get(
  "/checkout/initiate-paypal",
  checkoutController.initiatePayPalPayment
);
router.get(
  "/order-confirmation",
  userAuth,
  checkoutController.getOrderConfirmation
);
router.get(
  "/checkout/paypal-success",
  userAuth,
  checkoutController.paypalSuccess
);
router.get(
  "/checkout/paypal-cancel",
  userAuth,
  checkoutController.paypalCancel
);

router.post(
  "/continue-payment/:orderId",
  userAuth,
  checkoutController.continuePayment
);

router.get("/orders", userAuth, orderController.getUserOrders);
router.post("/orders/:orderId/cancel", userAuth, orderController.cancelOrder);
router.post("/orders/:orderId/return", userAuth, orderController.returnOrder);

router.get("/change-password", userAuth, profileController.getChangePassword);
router.post("/change-password", userAuth, profileController.changePassword);

router.get("/wishlist", userAuth, wishlistController.getWishlist);
router.post(
  "/wishlist/add/:productId",
  userAuth,
  wishlistController.addToWishlist
);
router.post(
  "/wishlist/remove/:productId",
  userAuth,
  wishlistController.removeFromWishlist
);

router.post("/apply-coupon", userAuth, checkoutController.applyCoupon);

router.get("/wallet", userAuth, walletController.getWalletPage);

router.get(
  "/download-invoice/:orderId",
  userAuth,
  invoiceController.getInvoice
);

module.exports = router;
