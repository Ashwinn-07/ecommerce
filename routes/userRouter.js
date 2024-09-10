const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController");
const cartController = require("../controllers/user/cartController");
const addressController = require("../controllers/user/addressController");
const checkoutController = require("../controllers/user/checkoutController");
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
    res.redirect("/");
  }
);
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.get("/logout", userController.logout);

router.get("/shop", userController.loadShopPage);
router.get("/product/:id", userController.loadProductDetails);

router.get("/forgot-password", profileController.getForgotPassPage);
router.post("/forgot-email-valid", profileController.forgotEmailValid);
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp);
router.get("/reset-password", profileController.getResetPassPage);
router.post("/reset-password", profileController.postNewPassword);
router.post("/resend-forgot-otp", profileController.resendOtp);

router.get("/profile", profileController.getProfile);
router.post("/profile/edit", profileController.editProfile);

router.get("/cart", cartController.getCart);
router.post("/add-to-cart", cartController.addToCart);
router.post("/cart/remove/:id", cartController.removeFromCart);
router.post("/cart/update", cartController.updateCartQuantity);
router.get("/cart/total", cartController.getCartTotal);

router.get("/addresses", addressController.getAddress);
router.get("/address/add", addressController.getAddAddress);
router.post("/address/add", addressController.addAddress);
router.get("/address/edit/:id", addressController.getEditAddress);
router.post("/address/edit/:id", addressController.editAddress);
router.post("/address/delete/:id", addressController.deleteAddress);

router.get("/checkout", checkoutController.getCheckoutPage);
router.post("/checkout/place-order", checkoutController.checkout);
router.get("/order-confirmation", checkoutController.getOrderConfirmation);

module.exports = router;
