const Coupon = require("../../models/couponSchema");
const { STATUS_CODES, MESSAGES } = require("../../utils/constants");

const getCouponManagementPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const searchRegex = new RegExp(search, "i");

    const coupons = await Coupon.find({ name: searchRegex })
      .skip(skip)
      .limit(limit)
      .sort({ createdOn: -1 });

    const totalCoupons = await Coupon.countDocuments({ name: searchRegex });
    const totalPages = Math.ceil(totalCoupons / limit);

    res.render("coupon", {
      coupons,
      currentPage: page,
      totalPages,
      search,
    });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

const addCoupon = async (req, res) => {
  try {
    const { name, offerPrice, minimumPrice, expireOn } = req.body;
    const existingCoupon = await Coupon.findOne({ name });
    if (existingCoupon) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: MESSAGES.ERROR.COUPON_EXISTS });
    }

    const newCoupon = new Coupon({
      name,
      offerPrice,
      minimumPrice,
      expireOn,
      createdOn: new Date(),
    });
    await newCoupon.save();
    res
      .status(STATUS_CODES.CREATED)
      .json({ message: MESSAGES.SUCCESS.COUPON_CREATED, coupon: newCoupon });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

const toggleCouponStatus = async (req, res) => {
  try {
    const { couponId, status } = req.body;
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      { isList: status },
      { new: true }
    );
    if (!updatedCoupon) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ status: false, message: MESSAGES.ERROR.COUPON_NOT_FOUND });
    }
    res.json({
      status: true,
      message: MESSAGES.SUCCESS.COUPON_STATUS_UPDATED,
      coupon: updatedCoupon,
    });
  } catch (error) {
    console.error("Error toggling coupon status:", error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ status: false, message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

const getEditCouponPage = async (req, res) => {
  try {
    const couponId = req.query.id;
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: MESSAGES.ERROR.COUPON_NOT_FOUND });
    }
    res.render("edit-coupon", { coupon });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

const updatedCoupon = async (req, res) => {
  try {
    const { id, name, offerPrice, minimumPrice, expireOn } = req.body;
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      id,
      { name, offerPrice, minimumPrice, expireOn },
      { new: true }
    );
    if (!updatedCoupon) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ error: MESSAGES.ERROR.COUPON_NOT_FOUND });
    }
    res.json({
      message: MESSAGES.SUCCESS.COUPON_UPDATED,
      coupon: updatedCoupon,
    });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.ERROR.INTERNAL_SERVER_ERROR });
  }
};

module.exports = {
  getCouponManagementPage,
  addCoupon,
  toggleCouponStatus,
  getEditCouponPage,
  updatedCoupon,
};
