const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
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

module.exports = router;
