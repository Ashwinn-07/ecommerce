const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Brand = require("../../models/brandSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const width = 800;
const height = 400;

const chartCallBack = (ChartJs) => {
  ChartJs.default.responsive = true;
  ChartJs.default.maintainAspectRatio = false;
};

const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width,
  height,
  chartCallBack,
});

const generateChart = async (labels, data) => {
  const configuration = {
    type: "line",

    data: {
      labels: labels,
      datasets: [
        {
          label: "Sales",
          data: data,
          fill: false,
          borderColor: "rgb(75, 192, 192)",
          tension: 0.1,
        },
      ],
    },

    options: {
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  };

  const image = await chartJSNodeCanvas.renderToBuffer(configuration);
  return `data:image/png;base64,${image.toString("base64")}`;
};

const getSalesData = async (period) => {
  let dateFormat, groupBy;

  switch (period) {
    case "yearly":
      dateFormat = "%Y";
      groupBy = { $year: "$createdOn" };
      break;

    case "monthly":
      dateFormat = "%Y-%m";
      groupBy = {
        year: { $year: "$createdOn" },
        month: { $month: "$createdOn" },
      };

      break;

    case "weekly":
      dateFormat = "%Y-W%V";
      groupBy = {
        year: { $year: "$createdOn" },
        week: { $week: "$createdOn" },
      };

      break;

    default:
      throw new Error("Invalid period");
  }
  const salesData = await Order.aggregate([
    {
      $group: {
        _id: groupBy,
        sales: { $sum: "$totalPrice" },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: "$_id",

        sales: 1,
      },
    },
  ]);

  return salesData;
};

const getDashboardData = async (req, res) => {
  try {
    const totalSales = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    const totalOrders = await Order.countDocuments();
    const totalCustomers = await User.countDocuments({ isAdmin: "false" });

    const topProducts = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $group: {
          _id: "$orderedItems.product",
          totalSales: { $sum: "$orderedItems.quantity" },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $project: {
          name: "$productInfo.productName",
          sales: "$totalSales",
        },
      },
    ]);

    const topCategories = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $group: {
          _id: "$categoryInfo._id",
          name: { $first: "$categoryInfo.name" },
          totalSales: { $sum: "$orderedItems.quantity" },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
    ]);
    const topBrands = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "brands",
          localField: "productInfo.brand",
          foreignField: "_id",
          as: "brandInfo",
        },
      },
      { $unwind: "$brandInfo" },
      {
        $group: {
          _id: "$brandInfo._id",
          name: { $first: "$brandInfo.brandName" },
          totalSales: { $sum: "$orderedItems.quantity" },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
    ]);
    const yearlySalesData = await getSalesData("yearly");
    const monthlySalesData = await getSalesData("monthly");
    const weeklySalesData = await getSalesData("weekly");

    const yearlyChartImage = await generateChart(
      yearlySalesData.map((item) => item.date),
      yearlySalesData.map((item) => item.sales)
    );

    const monthlyChartImage = await generateChart(
      monthlySalesData.map((item) => item.date),
      monthlySalesData.map((item) => item.sales)
    );

    const weeklyChartImage = await generateChart(
      weeklySalesData.map((item) => item.date),
      weeklySalesData.map((item) => item.sales)
    );

    res.render("dashboard", {
      totalSales: totalSales[0]?.total || 0,
      totalOrders,
      totalCustomers,
      topProducts,
      topCategories: topCategories.map((category) => ({
        name: category.name,
        sales: category.totalSales,
      })),
      topBrands: topBrands.map((brand) => ({
        name: brand.name,
        sales: brand.totalSales,
      })),
      yearlyChartImage,
      monthlyChartImage,
      weeklyChartImage,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const generateSalesReport = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.body;

    const totalSales = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);
    const totalOrders = await Order.countDocuments();
    const totalCustomers = await User.countDocuments({ isAdmin: "false" });

    const topProducts = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $group: {
          _id: "$orderedItems.product",
          totalSales: { $sum: "$orderedItems.quantity" },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $project: {
          name: "$productInfo.productName",
          sales: "$totalSales",
        },
      },
    ]);

    const topCategories = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $group: {
          _id: "$categoryInfo._id",
          name: { $first: "$categoryInfo.name" },
          totalSales: { $sum: "$orderedItems.quantity" },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
    ]);
    const topBrands = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "brands",
          localField: "productInfo.brand",
          foreignField: "_id",
          as: "brandInfo",
        },
      },
      { $unwind: "$brandInfo" },
      {
        $group: {
          _id: "$brandInfo._id",
          name: { $first: "$brandInfo.brandName" },
          totalSales: { $sum: "$orderedItems.quantity" },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
    ]);
    const yearlySalesData = await getSalesData("yearly");
    const monthlySalesData = await getSalesData("monthly");
    const weeklySalesData = await getSalesData("weekly");

    const yearlyChartImage = await generateChart(
      yearlySalesData.map((item) => item.date),
      yearlySalesData.map((item) => item.sales)
    );

    const monthlyChartImage = await generateChart(
      monthlySalesData.map((item) => item.date),
      monthlySalesData.map((item) => item.sales)
    );

    const weeklyChartImage = await generateChart(
      weeklySalesData.map((item) => item.date),
      weeklySalesData.map((item) => item.sales)
    );

    const reportData = await generateReportData(reportType, startDate, endDate);

    const chartUrl = await generateChartImage(
      reportData.labels,
      reportData.salesData
    );

    res.render("dashboard", {
      reportData,
      chartUrl,
      totalSales: totalSales[0]?.total || 0,
      totalOrders,
      totalCustomers,
      topProducts,
      topCategories: topCategories.map((category) => ({
        name: category.name,
        sales: category.totalSales,
      })),
      topBrands: topBrands.map((brand) => ({
        name: brand.name,
        sales: brand.totalSales,
      })),
      yearlyChartImage,
      monthlyChartImage,
      weeklyChartImage,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const downloadReport = async (req, res) => {
  try {
    const { type } = req.query;
    const reportData = await generateReportData(
      req.session.lastReportType,
      req.session.lastStartDate,
      req.session.lastEndDate
    );

    if (type === "pdf") {
      await generatePdf(res, reportData);
    } else if (type === "excel") {
      await generateExcel(res, reportData);
    } else {
      res.status(400).json({ message: "Invalid download type" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

async function generateReportData(reportType, startDate, endDate) {
  let query = {};
  let groupBy = {};

  switch (reportType) {
    case "daily":
      query = {
        createdOn: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      };
      groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } };
      break;
    case "weekly":
      query = {
        createdOn: { $gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000) },
      };
      groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } };
      break;
    case "monthly":
      query = { createdOn: { $gte: new Date(new Date().setDate(1)) } };
      groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } };
      break;
    case "yearly":
      query = { createdOn: { $gte: new Date(new Date().getFullYear(), 0, 1) } };
      groupBy = { $dateToString: { format: "%Y-%m", date: "$createdOn" } };
      break;
    case "custom":
      query = {
        createdOn: { $gte: new Date(startDate), $lte: new Date(endDate) },
      };
      groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } };
      break;
  }

  const result = await Order.aggregate([
    { $match: query },
    {
      $group: {
        _id: groupBy,
        totalSales: { $sum: "$finalAmount" },
        totalOrders: { $sum: 1 },
        totalDiscount: { $sum: "$discount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const labels = result.map((item) => item._id);
  const salesData = result.map((item) => item.totalSales);
  const totalSales = result.reduce((sum, item) => sum + item.totalSales, 0);
  const totalOrders = result.reduce((sum, item) => sum + item.totalOrders, 0);
  const totalDiscount = result.reduce(
    (sum, item) => sum + item.totalDiscount,
    0
  );

  return {
    labels,
    salesData,
    totalSales,
    totalOrders,
    totalDiscount,
  };
}

async function generateChartImage(labels, salesData) {
  const width = 400;
  const height = 200;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  const configuration = {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Sales",
          data: salesData,
          borderColor: "rgb(75,192,192)",
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  };
  const image = await chartJSNodeCanvas.renderToBuffer(configuration);
  return `data:image/png;base64,${image.toString("base64")}`;
}

async function generatePdf(res, reportData) {
  const doc = new PDFDocument();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=sales_report.pdf");

  doc.pipe(res);
  doc.fontSize(18).text("Sales Report", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Total Sales: ${reportData.totalSales}`);
  doc.text(`Total Orders: ${reportData.totalOrders}`);
  doc.text(`Total Discount: ${reportData.totalDiscount}`);
  const chartImage = await generateChartImage(
    reportData.labels,
    reportData.salesData
  );
  doc.image(chartImage, {
    fit: [500, 300],
    align: "center",
    valign: "center",
  });

  doc.end();
}

async function generateExcel(res, reportData) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sales Report");

  worksheet.addRow(["Date", "Sales"]);
  reportData.labels.forEach((label, index) => {
    worksheet.addRow([label, reportData.salesData[index]]);
  });
  worksheet.addRow(["Total Sales", reportData.totalSales]);
  worksheet.addRow(["Total Orders", reportData.totalOrders]);
  worksheet.addRow(["Total Discount", reportData.totalDiscount]);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=sales_report.xlsx"
  );

  await workbook.xlsx.write(res);
}

module.exports = {
  getDashboardData,
  generateSalesReport,
  downloadReport,
};
