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
  SUCCESS: {},
  ERROR: {
    INVALID_CREDENTIALS: "Invalid email or password",
    GENERAL_ERROR: "An error occurred. Please try again later.",
    SESSION_DESTROY_ERROR: "Error destroying session",
    LOGOUT_ERROR: "An error occured",
  },
};

module.exports = {
  STATUS_CODES,
  MESSAGES,
};
