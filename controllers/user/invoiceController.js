const Order = require("../../models/orderSchema");
const PDFDocument = require("pdfkit");

function generateInvoice(order, stream) {
  const doc = new PDFDocument();

  doc.pipe(stream);

  doc.fontSize(20).text("Invoice", { align: "center" });
  doc.moveDown();

  doc.fontSize(12).text(`Order ID: ${order._id}`);
  doc.text(`Date: ${order.createdOn.toLocaleDateString()}`);
  doc.moveDown();

  doc.text(`Customer: ${order.userId.name}`);
  doc.text(
    `Address: ${order.address.name}, ${order.address.city}, ${order.address.state}, ${order.address.pincode}`
  );
  doc.moveDown();

  doc.font("Helvetica-Bold");
  doc.text("Product", 50, 200);
  doc.text("Quantity", 200, 200);
  doc.text("Price", 300, 200);
  doc.text("Total", 400, 200);

  let y = 220;
  doc.font("Helvetica");
  order.orderedItems.forEach((item) => {
    doc.text(item.product.productName, 50, y);
    doc.text(item.quantity.toString(), 200, y);
    doc.text(`$${item.price.toFixed(2)}`, 300, y);
    doc.text(`$${(item.quantity * item.price).toFixed(2)}`, 400, y);
    y += 20;
  });

  doc.moveDown();
  doc.font("Helvetica-Bold");
  doc.text(`Subtotal: $${order.totalPrice.toFixed(2)}`, { align: "right" });
  doc.text(`Discount: $${order.discount.toFixed(2)}`, { align: "right" });
  doc.text(`Total: $${order.finalAmount.toFixed(2)}`, { align: "right" });

  doc.end();
}

const getInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("userId", "name")
      .populate("orderedItems.product", "productName");

    if (!order) {
      res.status(404).json({ message: "Order Not Found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${order._id}.pdf`
    );
    generateInvoice(order, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getInvoice,
};
