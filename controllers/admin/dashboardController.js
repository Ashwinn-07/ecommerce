const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const width = 800;
const height = 400;

const chartCallBack = (ChartJS) => {
  ChartJS.defaults.font.family =
    "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
  ChartJS.defaults.responsive = true;
  ChartJS.defaults.maintainAspectRatio = false;
};

const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width,
  height,
  chartCallBack,
  plugins: {
    globalRegistration: true,
  },
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
          fill: true,
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 2,
          pointBackgroundColor: "rgba(54, 162, 235, 1)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "rgba(54, 162, 235, 1)",
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2,
          tension: 0.4,
          shadowColor: "rgba(0, 0, 0, 0.1)",
          shadowBlur: 10,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
          labels: {
            font: {
              family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
              size: 14,
              weight: "bold",
            },
            padding: 20,
            usePointStyle: true,
            pointStyle: "circle",
          },
        },
        title: {
          display: true,
          text: "Sales Performance",
          font: {
            family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
            size: 20,
            weight: "bold",
          },
          padding: {
            top: 10,
            bottom: 30,
          },
          color: "#333",
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
              size: 12,
            },
            padding: 10,
            color: "#333",
          },
          border: {
            color: "#333",
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
            lineWidth: 1,
          },
          ticks: {
            font: {
              family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
              size: 12,
            },
            padding: 10,
            color: "#333",
            callback: function (value) {
              return value.toLocaleString();
            },
          },
          border: {
            color: "#333",
          },
        },
      },
      interaction: {
        intersect: false,
        mode: "index",
      },
      animation: {
        duration: 1000,
        easing: "easeInOutQuart",
      },
      layout: {
        padding: {
          left: 10,
          right: 20,
          top: 20,
          bottom: 10,
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

    const { orders: reportData, summary } = await generateReportData(
      reportType,
      startDate,
      endDate
    );

    req.session.reportData = reportData;
    req.session.summary = summary;

    const chartUrl = await generateChartImage(
      reportData.labels,
      reportData.salesData
    );

    res.render("dashboard", {
      reportData,
      summary,
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
    const summary = req.session.summary;

    if (type === "pdf") {
      await generatePdf(res, reportData, summary);
    } else if (type === "excel") {
      await generateExcel(res, reportData, summary);
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
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $lookup: {
        from: "products",
        localField: "orderedItems.product",
        foreignField: "_id",
        as: "productDetails",
      },
    },
    {
      $project: {
        orderId: 1,
        userName: "$user.name",
        orderedItems: {
          $map: {
            input: "$orderedItems",
            as: "item",
            in: {
              productName: {
                $arrayElemAt: [
                  "$productDetails.productName",
                  { $indexOfArray: ["$productDetails._id", "$$item.product"] },
                ],
              },
              quantity: "$$item.quantity",
            },
          },
        },
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
    orderId: order.orderId.substring(0, 6),
    userName: order.userName,
    orderedItems: order.orderedItems
      .map((item) => `${item.productName} x ${item.quantity}`)
      .join(", "),
    totalPrice: order.totalPrice,
    finalAmount: order.finalAmount,
    discount: order.discount,
    status: order.status,
    paymentMethod: order.paymentMethod,
    createdOn: order.createdOn,
  }));

  const summary = {
    totalOrders: orders.length,
    totalSales: orders.reduce((sum, order) => sum + order.finalAmount, 0),
    totalDiscount: orders.reduce((sum, order) => sum + order.discount, 0),
  };

  return { orders, summary };
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
          fill: true,
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 2,
          pointBackgroundColor: "rgba(54, 162, 235, 1)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "rgba(54, 162, 235, 1)",
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
          labels: {
            font: {
              size: 12,
              weight: "bold",
            },
            usePointStyle: true,
            pointStyle: "circle",
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
            lineWidth: 1,
          },
          ticks: {
            callback: function (value) {
              return "₹" + value.toLocaleString();
            },
          },
        },
      },
      interaction: {
        intersect: false,
        mode: "index",
      },
    },
  };

  const image = await chartJSNodeCanvas.renderToBuffer(configuration);
  return `data:image/png;base64,${image.toString("base64")}`;
}

async function generatePdf(res, reportData, summary) {
  const doc = new PDFDocument({ margin: 50, size: "A4", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=sales_report.pdf");

  doc.pipe(res);

  doc.fontSize(24).text("Sales Report", { align: "center" });
  doc.moveDown(2);

  doc.fontSize(16).text("Summary", { underline: true });
  doc.fontSize(12);
  doc.text(`Total Orders: ${summary.totalOrders}`);
  doc.text(`Total Sales: ₹${summary.totalSales.toFixed(2)}`);
  doc.text(`Total Discount: ₹${summary.totalDiscount.toFixed(2)}`);
  doc.moveDown(2);

  const tableTop = doc.y;
  const tableHeaders = [
    "Order ID",
    "User Name",
    "Total Price",
    "Final Amount",
    "Discount",
    "Status",
    "Payment",
    "Date",
  ];
  const columnWidths = [60, 60, 70, 70, 60, 70, 70, 80];

  doc.font("Helvetica-Bold");
  tableHeaders.forEach((header, i) => {
    doc.text(
      header,
      50 + columnWidths.slice(0, i).reduce((sum, w) => sum + w, 0),
      tableTop,
      {
        width: columnWidths[i],
        align: "left",
      }
    );
  });

  doc.font("Helvetica");
  let yPosition = tableTop + 20;

  reportData.forEach((order, index) => {
    if (yPosition + 20 > doc.page.height - 50) {
      doc.addPage();
      yPosition = 50;

      doc.font("Helvetica-Bold");
      tableHeaders.forEach((header, i) => {
        doc.text(
          header,
          50 + columnWidths.slice(0, i).reduce((sum, w) => sum + w, 0),
          yPosition,
          {
            width: columnWidths[i],
            align: "left",
          }
        );
      });
      doc.font("Helvetica");
      yPosition += 20;
    }

    const row = [
      order.orderId,
      order.userName,
      order.totalPrice.toFixed(2),
      order.finalAmount.toFixed(2),
      order.discount.toFixed(2),
      order.status,
      order.paymentMethod,
      new Date(order.createdOn).toLocaleDateString(),
    ];

    row.forEach((cell, i) => {
      doc.text(
        cell.toString(),
        50 + columnWidths.slice(0, i).reduce((sum, w) => sum + w, 0),
        yPosition,
        {
          width: columnWidths[i],
          align: i > 1 && i < 5 ? "right" : "left",
        }
      );
    });

    yPosition += 20;
  });

  doc.end();
}

async function generateExcel(res, reportData, summary) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sales Report");

  worksheet.addRow(["Summary"]);
  worksheet.addRow(["Total Orders", summary.totalOrders]);
  worksheet.addRow(["Total Sales", `₹${summary.totalSales.toFixed(2)}`]);
  worksheet.addRow(["Total Discount", `₹${summary.totalDiscount.toFixed(2)}`]);
  worksheet.addRow([]);

  worksheet.columns = [
    { header: "Order ID", key: "orderId", width: 10 },
    { header: "User Name", key: "userName", width: 20 },
    { header: "Ordered Items", key: "orderedItems", width: 30 },
    { header: "Total Price", key: "totalPrice", width: 12 },
    { header: "Final Amount", key: "finalAmount", width: 12 },
    { header: "Discount", key: "discount", width: 10 },
    { header: "Status", key: "status", width: 15 },
    { header: "Payment Method", key: "paymentMethod", width: 15 },
    { header: "Date", key: "createdOn", width: 20 },
  ];

  reportData.forEach((order) => {
    worksheet.addRow({
      orderId: order.orderId,
      userName: order.userName,
      orderedItems: order.orderedItems,
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
