const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

const MESSAGES = {
  SUCCESS: {
    CATEGORY_ADDED: "Category added successfully",
    OFFER_REMOVED: "offer removed successfully",
    COUPON_CREATED: "Coupon created successfully",
    COUPON_STATUS_UPDATED: "Coupon status updated successfully",
    COUPON_UPDATED: "Coupon updated successfully",
  },
  ERROR: {
    INVALID_CREDENTIALS: "Invalid email or password",
    GENERAL_ERROR: "An error occurred. Please try again later.",
    SESSION_DESTROY_ERROR: "Error destroying session",
    LOGOUT_ERROR: "An error occured",
    INTERNAL_SERVER_ERROR: "Internal server error",
    NO_BRAND_FOUND: "no brand found",
    INTERNAL_SERVER_ERROR_LOWER: "internal server error",
    REQUIRED_FIELDS: "name and description are required",
    CATEGORY_EXISTS: "Category already exists",
    SERVER_ERROR: "server error",
    CATEGORY_NOT_FOUND: "category not found",
    PRODUCT_OFFER_EXISTS:
      "products within this category already has product offer",
    SERVER_ERROR_CAPS: "Server error",
    CATEGORY_NOT_FOUND_EDIT: "category not found",
    CATEGORY_EXISTS_EDIT: "Category exists, please choose another name",
    COUPON_EXISTS: "Coupon already exists",
    COUPON_NOT_FOUND: "Coupon not found",
    ADDRESS_NOT_FOUND: "Address Not Found",
  },
};

module.exports = {
  STATUS_CODES,
  MESSAGES,
};
