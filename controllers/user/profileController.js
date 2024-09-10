const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
dotenv.config();
const session = require("express-session");

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
      subject: "OTP for password reset",
      text: `your otp is ${otp}`,
      html: `<b>Your OTP : ${otp} </b>`,
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("error sending email", error);
    return false;
  }
}

function generateOtp() {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

const getForgotPassPage = async (req, res) => {
  try {
    res.render("forgot-password");
  } catch (error) {
    console.error(error);
  }
};

const forgotEmailValid = async (req, res) => {
  try {
    const { email } = req.body;
    const findUser = await User.findOne({ email: email });
    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        req.session.userOtp = otp;
        req.session.email = email;
        res.render("forgotPass-otp");
        console.log(otp);
      } else {
        res.json({ success: false, message: "failed to send otp" });
      }
    } else
      [
        res.render("forgot-password", {
          message: "User with this email does not exist",
        }),
      ];
  } catch (error) {
    console.error(error);
  }
};

const verifyForgotPassOtp = async (req, res) => {
  try {
    const enteredOtp = req.body.otp;
    if (enteredOtp === req.session.userOtp) {
      res.json({ success: true, redirectUrl: "/reset-password" });
    } else {
      res.json({ success: false, message: "OTP does not match" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "An error occured" });
  }
};

const getResetPassPage = async (req, res) => {
  try {
    res.render("reset-password");
  } catch (error) {
    console.error(error);
  }
};

const resendOtp = async (req, res) => {
  try {
    const otp = generateOtp();
    req.session.userOtp = otp;
    const email = req.session.email;
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("New OTP:", otp);
      res.status(200).json({ success: true, message: "OTP Resent!" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "server error" });
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error(error);
  }
};

const postNewPassword = async (req, res) => {
  try {
    const { newPass1, newPass2 } = req.body;
    const email = req.session.email;
    if (newPass1 === newPass2) {
      const passwordHash = await securePassword(newPass1);
      await User.updateOne(
        { email: email },
        { $set: { password: passwordHash } }
      );
      res.redirect("/login");
    } else {
      res.render("reset-password", { message: "passwords do not match" });
    }
  } catch (error) {
    console.error(error);
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    } else {
      res.render("user-profile", {
        user,
      });
    }
  } catch (error) {
    console.error("error fetching user profile", error);
  }
};

const editProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const { name, email, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { name, email, phone },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.redirect("/profile");
  } catch (error) {
    console.error("Error updating profile details", error);
  }
};

module.exports = {
  getForgotPassPage,
  forgotEmailValid,
  verifyForgotPassOtp,
  getResetPassPage,
  resendOtp,
  postNewPassword,
  getProfile,
  editProfile,
};
