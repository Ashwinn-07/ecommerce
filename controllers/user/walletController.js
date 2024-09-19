const Wallet = require("../../models/walletSchema");

const getWalletPage = async (req, res) => {
  try {
    const userId = req.session.user;
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId });
      await wallet.save();
    }

    res.render("wallet", { wallet });
  } catch (error) {
    console.error(error);
    res.status(500).json({ messaage: "Internal server error" });
  }
};

module.exports = {
  getWalletPage,
};
