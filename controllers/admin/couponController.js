const Coupon = require("../../models/couponSchema");

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
    res.status(500).json({ message: "Internal server error" });
  }
};

const addCoupon = async (req, res) => {
  try {
    const { name, offerPrice, minimumPrice, expireOn } = req.body;
    const existingCoupon = await Coupon.findOne({ name });
    if (existingCoupon) {
      return res.status(400).json({ message: "Coupon already exists" });
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
      .status(201)
      .json({ message: "Coupon created successfully", coupon: newCoupon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
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
        .status(404)
        .json({ status: false, message: "Coupon not found" });
    }
    res.json({
      status: true,
      message: "Coupon status updated successfully",
      coupon: updatedCoupon,
    });
  } catch (error) {
    console.error("Error toggling coupon status:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

const getEditCouponPage = async (req, res) => {
  try {
    const couponId = req.query.id;
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    res.render("edit-coupon", { coupon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
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
      return res.status(404).json({ error: "Coupon not found" });
    }
    res.json({ message: "Coupon updated successfully", coupon: updatedCoupon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getCouponManagementPage,
  addCoupon,
  toggleCouponStatus,
  getEditCouponPage,
  updatedCoupon,
};
