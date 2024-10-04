const Wallet = require("../../models/walletSchema");
const Order = require("../../models/orderSchema");

const getWalletPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId });
      await wallet.save();
    }
    const totalTransactions = wallet.transactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    wallet.transactions.sort((a, b) => b.date - a.date);

    const paginatedTransactions = wallet.transactions.slice(
      startIndex,
      endIndex
    );
    wallet.transactions = paginatedTransactions;

    res.render("wallet", {
      wallet,
      transactions: paginatedTransactions,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ messaage: "Internal server error" });
  }
};

const addMoney = async (req, res) => {
  try {
    const userId = req.session.user;
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId });
    }
    wallet.balance += parseFloat(amount);
    wallet.transactions.push({
      type: "CREDIT",
      amount: parseFloat(amount),
      description: "Money added to wallet",
    });

    await wallet.save();

    res.status(200).json({
      message: "Money added successfully",
      newBalance: wallet.balance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ messaage: "Internal server error" });
  }
};
const withdrawMoney = async (req, res) => {
  try {
    const userId = req.session.user;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    wallet.balance -= parseFloat(amount);
    wallet.transactions.push({
      type: "DEBIT",
      amount: parseFloat(amount),
      description: "Money withdrawn from wallet",
    });

    await wallet.save();

    res.status(200).json({
      message: "Money withdrawn successfully",
      newBalance: wallet.balance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const useWalletForOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { orderId } = req.body;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance < order.finalAmount) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    wallet.balance -= order.finalAmount;
    wallet.transactions.push({
      type: "DEBIT",
      amount: order.finalAmount,
      description: `Payment for order ${orderId}`,
    });

    await wallet.save();

    order.paymentMethod = "Wallet";
    order.status = "Paid";
    await order.save();

    res.redirect("/orders");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getWalletPage,
  addMoney,
  withdrawMoney,
  useWalletForOrder,
};
