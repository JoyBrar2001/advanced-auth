const User = require("../Models/user.model");
const bcryptjs = require("bcryptjs");

const signup = async (req, res) => {
  const { email, password, name } = req.body;

  try {
    if (!email || !password || !name) {
      throw new Error("All fields are required");
    }

    const userAlreadyExist = await User.findOne({ email });

    if (userAlreadyExist) {
      return res
        .status(400)
        .json({
          success: false,
          message: "User already exists"
        });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

    const user = new User({
      email,
      password: hashedPassword,
      name,
      verificationToken,
      verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    await user.save();

    
  } catch (error) {
    console.log(error);
  }
}

const login = async (req, res) => {
  res.send("Login Route")
}

const logout = async (req, res) => {
  res.send("Logout Route")
}

module.exports = { signup, login, logout }