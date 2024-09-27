const Address = require("../../models/addressSchema");

const getAddress = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const userId = req.session.user;
    const userAddress = await Address.findOne({ userId });

    if (!userAddress) {
      return res.render("addresses", {
        userId,
        addresses: [],
        currentPage: 1,
        totalPages: 0,
        totalAddresses: 0,
      });
    }

    const totalAddresses = userAddress.address.length;
    const totalPages = Math.ceil(totalAddresses / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedAddresses = userAddress.address.slice(startIndex, endIndex);
    res.render("addresses", {
      userId,
      addresses: paginatedAddresses,
      currentPage: page,
      totalPages: totalPages,
      totalAddresses: totalAddresses,
    });
  } catch (error) {
    console.error(error);
  }
};

const getAddAddress = (req, res) => {
  res.render("add-address");
};

const addAddress = async (req, res) => {
  try {
    const { addressType, name, city, state, pincode, phone } = req.body;
    const userId = req.session.user;

    let userAddress = await Address.findOne({ userId });

    if (!userAddress) {
      userAddress = new Address({
        userId,
        address: [],
      });
    }
    userAddress.address.push({
      addressType,
      name,
      city,
      state,
      pincode,
      phone,
    });
    await userAddress.save();
    res.redirect("/addresses");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "internal server error" });
  }
};

const getEditAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user;
    const userAddress = await Address.findOne({ userId });
    const addressToEdit = userAddress.address.id(addressId);
    if (addressToEdit) {
      res.render("edit-address", {
        address: addressToEdit,
      });
    } else {
      res.status(404).json({ message: "Address Not Found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "internal server error" });
  }
};

const editAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const { addressType, name, city, state, pincode, phone } = req.body;
    const userId = req.session.user;
    const userAddress = await Address.findOne({ userId });
    if (userAddress) {
      const address = userAddress.address.id(addressId);
      if (address) {
        address.addressType = addressType;
        address.name = name;
        address.city = city;
        address.state = state;
        address.pincode = pincode;
        address.phone = phone;

        await userAddress.save();
        res.redirect("/addresses");
      } else {
        res.status(404).json({ message: "Adress Not Found" });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "internal server error" });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user;
    const userAddress = await Address.findOne({ userId });

    if (userAddress) {
      userAddress.address = userAddress.address.filter(
        (addr) => addr._id.toString() !== addressId
      );
      await userAddress.save();
      res.redirect("/addresses");
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "internal server error" });
  }
};

module.exports = {
  getAddress,
  getAddAddress,
  addAddress,
  getEditAddress,
  editAddress,
  deleteAddress,
};
