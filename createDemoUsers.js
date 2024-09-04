const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const DemoUser = require("./models/demoUser");
const connectDB = require("./config/db");
require("dotenv").config();

const createDemoUsers = async () => {
  await connectDB();

  const hashedPassword = await bcrypt.hash("demopassword", 10);
  const demoUsers = [
    { email: "demouser@example.com", password: hashedPassword, role: "user" },
    { email: "demoadmin@example.com", password: hashedPassword, role: "admin" },
  ];

  try {
    await DemoUser.insertMany(demoUsers);
    console.log("demo users created");
  } catch (error) {
    console.error("error creating user", error);
  } finally {
    mongoose.disconnect();
  }
};

createDemoUsers();
