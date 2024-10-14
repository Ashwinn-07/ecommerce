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
  let groupBy, dateProject;

  switch (period) {
    case "yearly":
      groupBy = { $year: "$createdOn" };
      dateProject = { $toString: "$_id" };
      break;
    case "monthly":
      groupBy = {
        year: { $year: "$createdOn" },
        month: { $month: "$createdOn" },
      };
      dateProject = {
        $concat: [
          { $toString: "$_id.year" },
          "-",
          {
            $cond: [
              { $lt: ["$_id.month", 10] },
              { $concat: ["0", { $toString: "$_id.month" }] },
              { $toString: "$_id.month" },
            ],
          },
        ],
      };
      break;
    case "weekly":
      groupBy = {
        year: { $year: "$createdOn" },
        week: { $week: "$createdOn" },
      };
      dateProject = {
        $concat: [
          { $toString: "$_id.year" },
          "-W",
          {
            $cond: [
              { $lt: ["$_id.week", 10] },
              { $concat: ["0", { $toString: "$_id.week" }] },
              { $toString: "$_id.week" },
            ],
          },
        ],
      };
      break;
    default:
      throw new Error("Invalid period");
  }

  const salesData = await Order.aggregate([
    {
      $match: {
        createdOn: { $lte: new Date() },
      },
    },
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
        date: dateProject,
        sales: 1,
      },
    },
  ]);

  if (period === "monthly") {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const months = Array.from({ length: currentMonth }, (_, i) => i + 1);
    const missingMonths = months.filter((month) => {
      const existingMonth = salesData.find((data) =>
        data.date.includes(`${currentYear}-${month}`)
      );
      return !existingMonth;
    });
    missingMonths.forEach((month) => {
      salesData.push({
        date: `${currentYear}-${month.toString().padStart(2, "0")}`,
        sales: 0,
      });
    });
  } else if (period === "yearly") {
    const currentYear = new Date().getFullYear();
    const years = Array.from(
      { length: currentYear - 2010 },
      (_, i) => i + 2010
    );
    const missingYears = years.filter((year) => {
      const existingYear = salesData.find((data) =>
        data.date.includes(`${year}`)
      );
      return !existingYear;
    });
    missingYears.forEach((year) => {
      salesData.push({
        date: `${year}`,
        sales: 0,
      });
    });
  }
  salesData.sort((a, b) => new Date(a.date) - new Date(b.date));

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

    req.session.reportData = reportData;

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
    const reportData = req.session.reportData;

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
      $project: {
        _id: 1,
        userId: 1,
        orderedItems: 1,
        totalPrice: 1,
        finalAmount: 1,
        discount: 1,
        status: 1,
        paymentMethod: 1,
        createdOn: 1,
      },
    },
  ]);

  const orders = result.map((order) => ({
    orderId: order._id,
    userId: order.userId,
    orderedItems: order.orderedItems,
    totalPrice: order.totalPrice,
    finalAmount: order.finalAmount,
    discount: order.discount,
    status: order.status,
    paymentMethod: order.paymentMethod,
    createdOn: order.createdOn,
  }));

  return orders;
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
  const doc = new PDFDocument({ margin: 50, size: "A4", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=sales_report.pdf");

  doc.pipe(res);

  const truncate = (text, length) => {
    return text.length > length ? text.substring(0, length - 3) + "..." : text;
  };

  doc.fontSize(18).text("Sales Report", { align: "center" });
  doc.moveDown();

  const table = {
    headers: [
      "Order ID",
      "User ID",
      "Total Price",
      "Final Amount",
      "Discount",
      "Status",
      "Payment",
      "Created On",
    ],
    rows: reportData.map((order) => [
      truncate(order.orderId.toString(), 8),
      truncate(order.userId.toString(), 8),
      order.totalPrice.toFixed(2),
      order.finalAmount.toFixed(2),
      order.discount.toFixed(2),
      truncate(order.status, 10),
      truncate(order.paymentMethod, 10),
      new Date(order.createdOn).toLocaleDateString(),
    ]),
  };

  const tableTop = 100;
  const tableLeft = 50;
  const columnWidths = [70, 70, 80, 80, 70, 80, 80, 90];

  doc.font("Helvetica-Bold").fontSize(12);
  table.headers.forEach((header, i) => {
    doc.text(
      header,
      tableLeft + columnWidths.slice(0, i).reduce((sum, w) => sum + w, 0),
      tableTop,
      {
        width: columnWidths[i],
        align: "left",
      }
    );
  });

  doc.font("Helvetica").fontSize(10);
  table.rows.forEach((row, rowIndex) => {
    const rowTop = tableTop + 25 + rowIndex * 20;
    row.forEach((cell, columnIndex) => {
      doc.text(
        cell.toString(),
        tableLeft +
          columnWidths.slice(0, columnIndex).reduce((sum, w) => sum + w, 0),
        rowTop,
        {
          width: columnWidths[columnIndex],
          align: columnIndex > 1 && columnIndex < 5 ? "right" : "left",
        }
      );
    });
  });

  table.rows.forEach((row, rowIndex) => {
    const rowTop = tableTop + 25 + rowIndex * 20;
    doc
      .rect(
        tableLeft,
        rowTop,
        columnWidths.reduce((sum, w) => sum + w, 0),
        20
      )
      .stroke();
  });

  doc.end();
}

async function generateExcel(res, reportData) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sales Report");

  worksheet.columns = [
    { header: "Order ID", key: "orderId", width: 15 },
    { header: "User ID", key: "userId", width: 15 },
    { header: "Total Price", key: "totalPrice", width: 12 },
    { header: "Final Amount", key: "finalAmount", width: 12 },
    { header: "Discount", key: "discount", width: 10 },
    { header: "Status", key: "status", width: 15 },
    { header: "Payment Method", key: "paymentMethod", width: 15 },
    { header: "Created On", key: "createdOn", width: 20 },
  ];

  reportData.forEach((order) => {
    worksheet.addRow({
      orderId: order.orderId,
      userId: order.userId,
      totalPrice: order.totalPrice,
      finalAmount: order.finalAmount,
      discount: order.discount,
      status: order.status,
      paymentMethod: order.paymentMethod,
      createdOn: new Date(order.createdOn),
    });
  });

  worksheet.getColumn("createdOn").numFmt = "yyyy-mm-dd hh:mm:ss";

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
