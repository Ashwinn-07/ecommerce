const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const orderlistController = require("../controllers/admin/orderlistController");
const couponController = require("../controllers/admin/couponController");
const brandController = require("../controllers/admin/brandContoller");
const dashboardController = require("../controllers/admin/dashboardController");
const { userAuth, adminAuth } = require("../middlewares/auth");
const multer = require("multer");
const storage = require("../helpers/multer");
const uploads = multer({ storage: storage });

router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth, dashboardController.getDashboardData);
router.get("/logout", adminController.logout);

router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerUnblocked);

router.get("/brands", adminAuth, brandController.getBrandPage);
router.post(
  "/addBrand",
  adminAuth,
  uploads.single("image"),
  brandController.addBrand
);
router.get("/blockBrand", adminAuth, brandController.blockBrand);
router.get("/unBlockBrand", adminAuth, brandController.unBlockBrand);
router.get("/deleteBrand", adminAuth, brandController.deleteBrand);

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
router.post(
  "/orderList/:orderId/approve-return",
  adminAuth,
  orderlistController.approveReturn
);
router.post(
  "/orderList/:orderId/cancel-return",
  adminAuth,
  orderlistController.cancelReturnRequest
);

router.get("/order/:orderId", orderlistController.getOrderDetails);
router.post(
  "/order/:orderId/item/:itemId/cancel",
  orderlistController.cancelOrderItem
);
router.post(
  "/order/:orderId/item/:itemId/status",
  orderlistController.updateOrderItemStatus
);
router.post(
  "/order/:orderId/item/:itemId/approve-return",
  orderlistController.approveItemReturn
);
router.post(
  "/order/:orderId/item/:itemId/reject-return",
  orderlistController.rejectItemReturn
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

router.post("/generate-sales-report", dashboardController.generateSalesReport);
router.get("/download-report", dashboardController.downloadReport);

module.exports = router;
