const loadHomepage = async (req, res) => {
  try {
    console.log("rendering home");
    return res.render("home");
  } catch (error) {
    console.log("homepage not found");
    res.status(500).send("server error");
  }
};

module.exports = {
  loadHomepage,
};
