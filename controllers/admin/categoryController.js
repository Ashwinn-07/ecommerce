const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const { updateCartPrices } = require("../user/cartController");
const { STATUS_CODES, MESSAGES } = require("../../utils/constants");

const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const categoryData = await Category.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);
    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
    });
  } catch (error) {
    console.error("An error occured", error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR_LOWER });
  }
};

const addCategory = async (req, res) => {
  const { name, description } = req.body;

  if (!name || !description) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({ error: MESSAGES.ERROR.REQUIRED_FIELDS });
  }

  try {
    const lowercaseName = name.toLowerCase();
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${lowercaseName}$`, "i") },
    });
    if (existingCategory) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ error: MESSAGES.ERROR.CATEGORY_EXISTS });
    }
    const newCategory = new Category({
      name,
      description,
    });
    await newCategory.save();
    return res.json({ message: MESSAGES.SUCCESS.CATEGORY_ADDED });
  } catch (error) {
    return res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ error: MESSAGES.ERROR.SERVER_ERROR });
  }
};

const addCategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ status: false, message: MESSAGES.ERROR.CATEGORY_NOT_FOUND });
    }
    const products = await Product.find({ category: category._id });
    const hasProductOffer = products.some(
      (product) => product.productOffer > percentage
    );
    if (hasProductOffer) {
      return res.json({
        status: false,
        message: MESSAGES.ERROR.PRODUCT_OFFER_EXISTS,
      });
    }
    await Category.updateOne(
      { _id: categoryId },
      { $set: { categoryOffer: percentage } }
    );

    for (const product of products) {
      product.productOffer = 0;
      product.salePrice = product.regularPrice;
      await product.save();
    }
    const carts = await Cart.find({
      "items.productId": { $in: products.map((p) => p._id) },
    });
    for (let cart of carts) {
      await updateCartPrices(cart.userId);
    }
    res.json({ status: true });
  } catch (error) {
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ status: false, message: MESSAGES.ERROR.SERVER_ERROR });
  }
};

const removeCategoryOffer = async (req, res) => {
  try {
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ status: false, message: MESSAGES.ERROR.CATEGORY_NOT_FOUND });
    }
    const percentage = category.categoryOffer;
    const products = await Product.find({ category: category._id });

    if (products.length > 0) {
      for (const product of products) {
        product.salePrice += Math.floor(
          product.regularPrice * (percentage / 100)
        );
        product.productOffer = 0;
        await product.save();
      }

      const carts = await Cart.find({
        "items.productId": { $in: products.map((p) => p._id) },
      });
      for (let cart of carts) {
        await updateCartPrices(cart.userId);
      }
    }
    category.categoryOffer = 0;
    await category.save();
    res.json({ status: true, message: MESSAGES.SUCCESS.OFFER_REMOVED });
  } catch (error) {
    console.error("Error removing category offer:", error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ status: false, message: MESSAGES.ERROR.SERVER_ERROR_CAPS });
  }
};

const getListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.redirect("/admin/category");
  } catch (error) {
    console.error("an error occured", error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR_LOWER });
  }
};

const getUnlistCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.redirect("/admin/category");
  } catch (error) {
    console.error("an error occured", error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR_LOWER });
  }
};

const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const category = await Category.findOne({ _id: id });
    res.render("edit-category", { category: category });
  } catch (error) {
    console.error("an error occured", error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR_LOWER });
  }
};

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { categoryName, description } = req.body;
    const lowercaseName = categoryName.toLowerCase();
    const existingCategory = await Category.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${lowercaseName}$`, "i") },
    });
    if (existingCategory) {
      return res.render("edit-category", {
        category: { _id: id, name: categoryName, description },
        error: MESSAGES.ERROR.CATEGORY_EXISTS_EDIT,
      });
    }

    const updateCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: categoryName,
        description: description,
      },
      { new: true }
    );
    if (updateCategory) {
      return res.redirect("/admin/category");
    } else {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ error: MESSAGES.ERROR.CATEGORY_NOT_FOUND_EDIT });
    }
  } catch (error) {
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ error: MESSAGES.ERROR.SERVER_ERROR });
  }
};

module.exports = {
  categoryInfo,
  addCategory,
  addCategoryOffer,
  removeCategoryOffer,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory,
};
