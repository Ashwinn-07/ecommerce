const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
  if (res.locals.user) {
    next();
  } else {
    res.redirect("/login");
  }
};

const adminAuth = (req, res, next) => {
  User.findOne({ isAdmin: true })
    .then((data) => {
      if (data) {
        next();
      } else {
        res.redirect("/admin/login");
      }
    })
    .catch((error) => {
      console.log("Error authenticating admin", error);
      res.status(500).send("An error occured");
    });
};

module.exports = {
  userAuth,
  adminAuth,
};
