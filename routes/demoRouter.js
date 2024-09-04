const express = require("express");
const router = express.Router();
const DemoUser = require("../models/demoUser");

router.post("/demoUser", async (req, res) => {
  try {
    const demoUser = await DemoUser.findOne({ email: "demouser@example.com" });

    if (!demoUser) {
      return res.status(404).json({ error: "user not found" });
    }

    req.session.userId = demoUser._id;
    req.session.role = demoUser.role;

    res.json({ message: "Logged in as demo user" });
  } catch (error) {
    console.error(error);
  }
});

router.post("/demoAdmin", async (req, res) => {
  try {
    const demoAdmin = await DemoUser.findOne({
      email: "demoadmin@example.com",
    });

    if (!demoAdmin) {
      return res.status(404).json({ error: "admin not found" });
    }
    req.session.userId = demoAdmin._id;
    req.session.role = demoAdmin.role;

    res.json({ message: "Logged in as demo admin" });
  } catch (error) {
    console.error(error);
  }
});

module.exports = router;
