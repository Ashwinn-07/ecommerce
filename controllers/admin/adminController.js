const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");

const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/");
  }
  res.render("admin-login", { message: null });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.render("admin-login", {
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (passwordMatch) {
      req.session.admin = true;
      return res.redirect("/admin");
    } else {
      return res.render("admin-login", {
        message: "Invalid email or password",
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.render("admin-login", {
      message: "An error occurred. Please try again later.",
    });
  }
};

const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      res.render("dashboard");
    } catch (error) {
      console.log("error", error);
    }
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session", err);
      }
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.log("An error occured", error);
  }
};

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  logout,
};
