const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const orderlistController = require("../controllers/admin/orderlistController");
const couponController = require("../controllers/admin/couponController");
const salesreportController = require("../controllers/admin/salesreportController");
const { userAuth, adminAuth } = require("../middlewares/auth");
const multer = require("multer");
const storage = require("../helpers/multer");
const uploads = multer({ storage: storage });

router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth, adminController.loadDashboard);
router.get("/logout", adminController.logout);

router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerUnblocked);

router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.post(
  "/addCategoryOffer",
  adminAuth,
  categoryController.addCategoryOffer
);
router.post(
  "/removeCategoryOffer",
  adminAuth,
  categoryController.removeCategoryOffer
);

router.get("/listCategory", adminAuth, categoryController.getListCategory);
router.get("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.get("/editCategory", adminAuth, categoryController.getEditCategory);
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);

router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post(
  "/addProducts",
  adminAuth,
  uploads.array("images", 4),
  productController.addProducts
);
router.get("/products", adminAuth, productController.getAllProducts);
router.post("/addProductOffer", adminAuth, productController.addProductOffer);
router.post(
  "/removeProductOffer",
  adminAuth,
  productController.removeProductOffer
);
router.get("/blockProduct", adminAuth, productController.blockProduct);
router.get("/unblockProduct", adminAuth, productController.unblockProduct);
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post(
  "/editProduct/:id",
  adminAuth,
  uploads.array("images", 4),
  productController.editProduct
);
router.post("/deleteImage", adminAuth, productController.deleteSingleImage);

router.get("/orderList", adminAuth, orderlistController.listOrders);
router.post(
  "/orderList/change-status",
  adminAuth,
  orderlistController.changeOrderStatus
);
router.post(
  "/orderList/:orderId/cancel",
  adminAuth,
  orderlistController.cancelOrder
);

router.get("/coupons", adminAuth, couponController.getCouponManagementPage);
router.post("/addCoupon", adminAuth, couponController.addCoupon);
router.post(
  "/toggleCouponStatus",
  adminAuth,
  couponController.toggleCouponStatus
);
router.get("/editCoupon", adminAuth, couponController.getEditCouponPage);
router.post("/updateCoupon", adminAuth, couponController.updatedCoupon);

router.post(
  "/generate-sales-report",
  salesreportController.generateSalesReport
);
router.get("/download-report", salesreportController.downloadReport);
module.exports = router;
