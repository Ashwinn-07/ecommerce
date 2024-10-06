const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Review = require("../../models/reviewSchema");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const crypto = require("crypto");
dotenv.config();

const loadHomepage = async (req, res) => {
  try {
    const userId = req.session.user;
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    }
    const products = await Product.find().limit(8);
    res.render("home", { user, products });
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
      text: `your otp is ${otp}`,
      html: `<b>Your OTP : ${otp} </b>`,
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("error sending email", error);
    return false;
  }
}

const signup = async (req, res) => {
  try {
    const { name, email, password, cPassword, referralCode } = req.body;

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

    const newReferralCode = crypto.randomBytes(4).toString("hex");

    req.session.userOtp = otp;
    req.session.userData = {
      name,
      email,
      password,
      referralCode,
      newReferralCode,
    };

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
      const userData = req.session.userData;
      const passwordHash = await securePassword(userData.password);

      let referredBy;
      if (userData.referralCode) {
        const referringUser = await User.findOne({
          referralCode: userData.referralCode,
        });
        if (referringUser) {
          referredBy = referringUser._id;
        }
      }

      const saveUserData = new User({
        name: userData.name,
        email: userData.email,
        password: passwordHash,
        referralCode: userData.newReferralCode,
        referredBy: referredBy,
      });

      await saveUserData.save();
      if (referredBy) {
        await User.findByIdAndUpdate(referredBy, {
          $push: { referredUsers: saveUserData._id },
        });
      }
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

const loadShopPage = async (req, res) => {
  try {
    const userId = req.session.user;
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    }
    const page = req.query.page || 1;
    const limit = 6;
    const sort = req.query.sort || "new_arrivals";
    const categoryFilter = req.query.category;
    const stockFilter = req.query.stock;
    const searchQuery = req.query.search;

    let sortOption = {};
    switch (sort) {
      case "price_low_to_high":
        sortOption = { salePrice: 1 };
        break;
      case "price_high_to_low":
        sortOption = { salePrice: -1 };
        break;
      case "new_arrivals":
        sortOption = { createdAt: -1 };
        break;
      case "a_to_z":
        sortOption = { productName: 1 };
        break;
      case "z_to_a":
        sortOption = { productName: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const query = { isBlocked: false };
    if (categoryFilter) {
      query.category = categoryFilter;
    }
    if (stockFilter) {
      query.quantity = { $gt: 0 };
    }
    if (searchQuery) {
      query.$or = [
        { productName: { $regex: searchQuery, $options: "i" } },
        { description: { $regex: searchQuery, $options: "i" } },
      ];
    }

    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const categories = await Category.find({ isListed: true });
    res.render("shop", {
      products: products,
      currentPage: page,
      itemsPerPage: limit,
      totalResults: count,
      totalPages: Math.ceil(count / limit),
      user,
      sort,
      categoryFilter,
      stockFilter,
      searchQuery,
      categories,
    });
  } catch (error) {
    console.error("error displaying products", error);
    res.status(500).json({ message: "internal server error" });
  }
};

const loadProductDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    }
    const id = req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    const product = await Product.findById(id)
      .populate("category")
      .populate({
        path: "reviews",
        populate: {
          path: "user",
          select: "name",
        },
      });

    const limit = 4;
    const relatedProducts = await Product.find({
      category: product.category._id,
      isBlocked: false,
      _id: { $ne: product._id },
    })
      .limit(limit)
      .populate("category");

    if (!product) {
      res.status(400).json({ message: "product not found" });
    }
    res.render("product-details", {
      product: product,
      relatedProducts: relatedProducts,
      user,
    });
  } catch (error) {
    console.error("error finding product", error);
    res.status(500).json({ message: "internal server error" });
  }
};
const addReview = async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    const userId = req.session.user;

    const newReview = await Review.create({
      user: userId,
      product: productId,
      rating: rating,
      comment: comment,
    });

    await Product.findByIdAndUpdate(productId, {
      $push: { reviews: newReview._id },
      $inc: { reviewCount: 1 },
    });

    const updatedProduct = await Product.findById(productId).populate(
      "reviews"
    );

    const totalRating = updatedProduct.reviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );
    updatedProduct.averageRating = totalRating / updatedProduct.reviews.length;

    await updatedProduct.save();

    res.redirect(`/product/${productId}`);
  } catch (error) {
    console.error("Error adding review", error);
    res.status(500).json({ message: "Internal server error" });
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
  loadShopPage,
  loadProductDetails,
  addReview,
};
