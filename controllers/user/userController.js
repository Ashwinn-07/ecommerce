const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
dotenv.config();

const loadHomepage = async (req, res) => {
  try {
    const userId = req.session.user;
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    }
    res.render("home", { user });
  } catch (error) {
    console.log("homepage not found");
    res.status(500).send("server error");
  }
};

const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("page not found");
    res.status(500).send("server error");
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `your otp is {otp}`,
      html: `<b>Your OTP : {otp} </b>`,
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("error sending email", error);
    return false;
  }
}

const signup = async (req, res) => {
  try {
    const { name, email, password, cPassword } = req.body;

    if (password !== cPassword) {
      return res.render("signup", { message: "Passwords do not match" });
    }
    const findUser = await User.findOne({ email });

    if (findUser) {
      return res.render("signup", {
        message: "User with this email already exists",
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json("email-error");
    }

    req.session.userOtp = otp;
    req.session.userData = { name, email, password };

    res.render("verify-otp");
    console.log("otp sent", otp);
  } catch (error) {
    console.error("signup error", error);
    res.status(500).send("server error");
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);

    return passwordHash;
  } catch (error) {
    console.error("Error hashing password", error);
    throw new Error("Password hashing failed");
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log(otp);
    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);

      const saveUserData = new User({
        name: user.name,
        email: user.email,
        password: passwordHash,
      });

      await saveUserData.save();
      req.session.user = saveUserData._id;
      res.json({ success: true, redirectUrl: "/" });
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP" });
    }
  } catch (error) {
    console.error("Error verifying OTP", error);
    res.status(500).json({ success: false, message: "An error occured" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "email not found" });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("OTP Resent", otp);
      res.status(200).json({ success: true, message: "OTP Resent" });
    } else {
      res.status(500).json({ success: false, message: "failed to resend OTP" });
    }
  } catch (error) {
    console.error("error resending OTP", error);
    res.status(500).json({ success: false, message: "An error occured" });
  }
};

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("login");
    } else {
      res.redirect("/");
    }
  } catch (error) {
    console.log("page not found");
    res.status(500).send("server error");
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: 0, email: email });
    if (!findUser) {
      return res.render("login", { message: "User not found" });
    }
    if (findUser.isBlocked) {
      return res.render("login", { message: "User is blocked by the Admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render("login", { message: "Password is incorrect" });
    }

    req.session.user = findUser._id;
    res.redirect("/");
  } catch (error) {
    console.error("login error", error);
    res.render("login", { message: "An error occured while logging in" });
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("error destroying session", err.message);
      }
      return res.redirect("login");
    });
  } catch (error) {
    console.log("logout error", error);
  }
};

module.exports = {
  loadHomepage,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
};
