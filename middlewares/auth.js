const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
  if (res.locals.user) {
    next();
  } else {
    res.redirect("/login");
  }
};

const adminAuth = (req, res, next) => {
  if (req.session.admin) {
    next();
  } else {
    res.redirect("/admin/login");
  }
};

module.exports = {
  userAuth,
  adminAuth,
};
