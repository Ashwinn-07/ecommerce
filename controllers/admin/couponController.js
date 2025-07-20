const Coupon = require("../../models/couponSchema");
const { STATUS_CODES, MESSAGES } = require("../../utils/constants");

const validateCouponData = (name, offerPrice, minimumPrice, expireOn) => {
  const errors = [];

  if (!name || name.trim().length === 0) {
    errors.push("Coupon name is required");
  } else if (name.trim().length < 3) {
    errors.push("Coupon name must be at least 3 characters long");
  }

  if (!offerPrice || isNaN(offerPrice) || Number(offerPrice) <= 0) {
    errors.push("Offer price must be a positive number");
  } else if (Number(offerPrice) > 10000) {
    errors.push("Offer price cannot exceed ₹10,000");
  } else if (Number(offerPrice) < 1) {
    errors.push("Offer price must be at least ₹1");
  }

  if (!minimumPrice || isNaN(minimumPrice) || Number(minimumPrice) < 0) {
    errors.push("Minimum price must be a non-negative number");
  } else if (Number(minimumPrice) > 100000) {
    errors.push("Minimum price cannot exceed ₹1,00,000");
  }

  if (Number(offerPrice) >= Number(minimumPrice)) {
    errors.push("Offer price must be less than minimum price");
  }

  if (!expireOn) {
    errors.push("Expiry date is required");
  } else {
    const expireDate = new Date(expireOn);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expireDate <= today) {
      errors.push("Expiry date must be in the future");
    }
  }

  return errors;
};

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

    const validationErrors = validateCouponData(
      name,
      offerPrice,
      minimumPrice,
      expireOn
    );
    if (validationErrors.length > 0) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ error: validationErrors[0] });
    }

    const existingCoupon = await Coupon.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existingCoupon) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ error: "Coupon with this name already exists" });
    }

    const newCoupon = new Coupon({
      name: name.trim(),
      offerPrice: Number(offerPrice),
      minimumPrice: Number(minimumPrice),
      expireOn,
      createdOn: new Date(),
    });

    await newCoupon.save();
    res
      .status(STATUS_CODES.CREATED)
      .json({ message: "Coupon created successfully", coupon: newCoupon });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to create coupon" });
  }
};

const toggleCouponStatus = async (req, res) => {
  try {
    const { couponId, status } = req.body;

    if (!couponId) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ status: false, message: "Coupon ID is required" });
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      { isList: status },
      { new: true }
    );

    if (!updatedCoupon) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ status: false, message: "Coupon not found" });
    }

    res.json({
      status: true,
      message: `Coupon ${status ? "activated" : "deactivated"} successfully`,
      coupon: updatedCoupon,
    });
  } catch (error) {
    console.error("Error toggling coupon status:", error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ status: false, message: "Failed to update coupon status" });
  }
};

const getEditCouponPage = async (req, res) => {
  try {
    const couponId = req.query.id;

    if (!couponId) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: "Coupon ID is required" });
    }

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: "Coupon not found" });
    }

    res.render("edit-coupon", { coupon });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to load coupon" });
  }
};

const updatedCoupon = async (req, res) => {
  try {
    const { id, name, offerPrice, minimumPrice, expireOn } = req.body;

    const validationErrors = validateCouponData(
      name,
      offerPrice,
      minimumPrice,
      expireOn
    );
    if (validationErrors.length > 0) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ error: validationErrors[0] });
    }

    const existingCoupon = await Coupon.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      _id: { $ne: id },
    });

    if (existingCoupon) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ error: "Another coupon with this name already exists" });
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        offerPrice: Number(offerPrice),
        minimumPrice: Number(minimumPrice),
        expireOn,
      },
      { new: true }
    );

    if (!updatedCoupon) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ error: "Coupon not found" });
    }

    res.json({
      message: "Coupon updated successfully",
      coupon: updatedCoupon,
    });
  } catch (error) {
    console.error(error);
    res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to update coupon" });
  }
};

module.exports = {
  getCouponManagementPage,
  addCoupon,
  toggleCouponStatus,
  getEditCouponPage,
  updatedCoupon,
};
