const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const { STATUS_CODES, MESSAGES } = require("../../utils/constants");
dotenv.config();

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransporter({
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
        res.json({
          success: false,
          message: MESSAGES.ERROR.FAILED_TO_SEND_OTP,
        });
      }
    } else
      [
        res.render("forgot-password", {
          message: MESSAGES.ERROR.USER_NOT_EXISTS,
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
      res.json({ success: false, message: MESSAGES.ERROR.OTP_NOT_MATCH });
    }
  } catch (error) {
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: MESSAGES.ERROR.AN_ERROR_OCCURRED });
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
      res
        .status(STATUS_CODES.OK)
        .json({ success: true, message: MESSAGES.SUCCESS.OTP_SENT });
    }
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: MESSAGES.ERROR.SERVER_ERROR });
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
      res.render("reset-password", {
        message: MESSAGES.ERROR.PASSWORDS_NOT_MATCH,
      });
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
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.USER_NOT_FOUND });
    } else {
      res.render("user-profile", {
        user,
      });
    }
  } catch (error) {
    console.error(MESSAGES.ERROR.ERROR_FETCHING_USER_PROFILE, error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR_LOWER });
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
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.USER_NOT_FOUND });
    }
    res.redirect("/profile");
  } catch (error) {
    console.error(MESSAGES.ERROR.ERROR_UPDATING_PROFILE, error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR_LOWER });
  }
};

const getChangePassword = async (req, res) => {
  try {
    const userId = req.session.user;
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    }
    res.render("change-password", { user });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.render("change-password", {
        errorMessage: MESSAGES.ERROR.ALL_FIELDS_REQUIRED,
      });
    }

    if (newPassword.length < 8) {
      return res.render("change-password", {
        errorMessage: MESSAGES.ERROR.PASSWORD_MIN_LENGTH,
      });
    }
    if (newPassword !== confirmPassword) {
      return res.render("change-password", {
        errorMessage: MESSAGES.ERROR.PASSWORDS_DO_NOT_MATCH,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.render("change-password", {
        errorMessage: MESSAGES.ERROR.USER_NOT_FOUND,
      });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.render("change-password", {
        errorMessage: MESSAGES.ERROR.INCORRECT_CURRENT_PASSWORD,
      });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    return res.render("change-password", {
      successMessage: MESSAGES.SUCCESS.PASSWORD_CHANGED,
    });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
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
  getChangePassword,
  changePassword,
};
