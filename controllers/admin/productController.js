const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const { updateCartPrices } = require("../user/cartController");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
    res.render("product-add", {
      cat: category,
      brand: brand,
    });
  } catch (error) {
    console.error("an error occured", error);
    res.status(500).json({ message: "internal server error" });
  }
};

const addProducts = async (req, res) => {
  try {
    const products = req.body;
    const productExists = await Product.findOne({
      productName: products.productName,
    });
    if (!productExists) {
      const images = [];
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const originalImagePath = req.files[i].path;

          const resizedImagePath = path.join(
            "public",
            "uploads",
            "product-images",
            req.files[i].filename
          );
          await sharp(originalImagePath)
            .resize(440, 440, { fit: "cover" })
            .toFile(resizedImagePath);
          images.push(req.files[i].filename);
        }
      }

      const categoryId = await Category.findOne({ name: products.category });
      if (!categoryId) {
        return res.status(400).json("Invalid category name");
      }
      const brandId = await Brand.findOne({ brandName: products.brand });
      if (!brandId) {
        return res.status(400).json("Invalid brand name");
      }

      const newProduct = new Product({
        productName: products.productName,
        description: products.description,
        brand: brandId._id,
        category: categoryId._id,
        regularPrice: products.regularPrice,
        salePrice: products.salePrice,
        createdOn: new Date(),
        quantity: products.quantity,
        size: products.size,
        color: products.color,
        productImage: images,
        status: "Available",
      });

      await newProduct.save();
      return res.redirect("/admin/addProducts");
    } else {
      return res.status(400).json("product already exists");
    }
  } catch (error) {
    console.error("error adding product", error);
    res.status(500).json({ message: "internal server error" });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = req.query.page || 1;
    const limit = 4;

    const productData = await Product.find({
      productName: { $regex: new RegExp(".*" + search + ".*", "i") },
    })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("category")
      .populate("brand")
      .exec();

    const count = await Product.find({
      productName: { $regex: new RegExp(".*" + search + ".*", "i") },
    }).countDocuments();

    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    if (category && brand) {
      res.render("products", {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        brand: brand,
      });
    } else {
      res.status(400).json("cannot fetch products");
    }
  } catch (error) {
    console.error("an error occured", error);
    res.status(500).json({ message: "internal server error" });
  }
};

const blockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/products");
  } catch (error) {
    console.error("an error blocking product", error);
    res.status(500).json({ message: "internal server error" });
  }
};
const unblockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/products");
  } catch (error) {
    console.error("an error unblocking product", error);
    res.status(500).json({ message: "internal server error" });
  }
};

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id });
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({});
    res.render("edit-product", {
      product: product,
      cat: category,
      brand: brand,
    });
  } catch (error) {
    console.error("an error occured", error);
    res.status(500).json({ message: "internal server error" });
  }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findOne({ _id: id });
    const data = req.body;
    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id },
    });
    if (existingProduct) {
      return res.status(400).json({ error: "product already exists" });
    }
    const images = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        images.push(req.files[i].filename);
      }
    }
    const brandId = await Brand.findOne({ brandName: data.brand });
    if (!brandId) {
      return res.status(400).json("Invalid brand name");
    }

    const updateFields = {
      productName: data.productName,
      description: data.description,
      category: product.category,
      brand: brandId._id,
      regularPrice: data.regularPrice,
      salePrice: data.salePrice,
      quantity: data.quantity,
      size: data.size,
      color: data.color,
    };
    if (req.files.length > 0) {
      updateFields.$push = { productImage: { $each: images } };
    }
    await Product.findByIdAndUpdate(id, updateFields, { new: true });
    res.redirect("/admin/products");
  } catch (error) {
    console.error("error editing product", error);
    res.status(500).json({ message: "internal server error" });
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;
    const product = await Product.findByIdAndUpdate(productIdToServer, {
      $pull: { productImage: imageNameToServer },
    });
    const imagePath = path.join(
      "public",
      "uploads",
      "re-image",
      imageNameToServer
    );
    if (fs.existsSync(imagePath)) {
      await fs.unlinkSync(imagePath);
      console.log("image deleted successfully");
    } else {
      console.log("Image not found");
    }
    res.send({ status: true });
  } catch (error) {
    console.error("an error occured", error);
    res.status(500).json({ message: "internal server error" });
  }
};

const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;
    const findProduct = await Product.findOne({ _id: productId });
    const findCategory = await Category.findOne({ _id: findProduct.category });
    if (findCategory.categoryOffer > percentage) {
      return res.josn({
        status: fales,
        message: "This product already has category offer applied",
      });
    }
    findProduct.salePrice =
      findProduct.salePrice -
      Math.floor(findProduct.regularPrice * (percentage / 100));
    findProduct.productOffer = parseInt(percentage);
    await findProduct.save();
    findCategory.categoryOffer = 0;
    await findCategory.save();

    const carts = await Cart.find({ "items.productId": productId });
    for (let cart of carts) {
      await updateCartPrices(cart.userId);
    }
    res.json({ status: true });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    const findProduct = await Product.findOne({ _id: productId });
    const percentage = findProduct.productOffer;
    findProduct.salePrice =
      findProduct.salePrice +
      Math.floor(findProduct.regularPrice * (percentage / 100));
    findProduct.productOffer = 0;
    await findProduct.save();
    const carts = await Cart.find({ "items.productId": productId });
    for (let cart of carts) {
      await updateCartPrices(cart.userId);
    }
    res.json({ status: true });
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  getProductAddPage,
  addProducts,
  getAllProducts,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
  addProductOffer,
  removeProductOffer,
};
