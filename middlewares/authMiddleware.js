const User = require("../models/userSchema");

const authMiddleware = async (req, res, next) => {
  console.log("Auth middleware executed");
  res.locals.user = null;
  if (req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
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
  } else if (req.user) {
    res.locals.user = req.user;
  }
  next();
};

module.exports = authMiddleware;
