const Order = require("../../models/orderSchema");
const Chart = require("chart.js");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const generateSalesReport = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.body;

    const reportData = await generateReportData(reportType, startDate, endDate);

    const chartUrl = await generateChartImage(
      reportData.labels,
      reportData.salesData
    );

    res.render("dashboard", { reportData, chartUrl });
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
  generateSalesReport,
  downloadReport,
};
