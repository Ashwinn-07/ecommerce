const User = require("../models/userSchema");

const authMiddleware = async (req, res, next) => {
  res.locals.user = null;
  if (req.session.user) {
    try {
      const user = await User.findById(req.session.user);
      if (user && !user.isBlocked) {
        res.locals.user = user;
      } else {
        req.session.destroy((err) => {
          if (err) console.error("error destroying session");
        });
        return res.redirect("/login");
      }
    } catch (error) {
      console.error("Error in auth middleware:", error);
      return res.redirect("/login");
    }
  }
  next();
};

module.exports = authMiddleware;
