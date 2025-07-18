const Brand = require("../../models/brandSchema");
const { STATUS_CODES, MESSAGES } = require("../../utils/constants");

const getBrandPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const brandData = await Brand.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalBrands = await Brand.countDocuments();

    const totalPages = Math.ceil(totalBrands / limit);

    const reverseBrand = brandData.reverse();

    res.render("brands", {
      data: reverseBrand,
      currentPage: page,
      totalPages: totalPages,
      totalBrands: totalBrands,
    });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

const addBrand = async (req, res) => {
  try {
    const brand = req.body.name;
    const brandImage = req.file.filename;

    const newBrand = new Brand({
      brandName: brand,
      brandImage: brandImage,
    });

    await newBrand.save();
    res.redirect("/admin/brands");
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};
const blockBrand = async (req, res) => {
  try {
    const id = req.query.id;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/brands");
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

const unBlockBrand = async (req, res) => {
  try {
    const id = req.query.id;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/brands");
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

const deleteBrand = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: MESSAGES.ERROR.NO_BRAND_FOUND });
    }
    await Brand.deleteOne({ _id: id });
    res.redirect("/admin/brands");
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

module.exports = {
  getBrandPage,
  addBrand,
  blockBrand,
  unBlockBrand,
  deleteBrand,
};
