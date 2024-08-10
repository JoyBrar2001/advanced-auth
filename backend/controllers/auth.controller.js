const crypto = require("crypto");
const bcryptjs = require("bcryptjs");

const User = require("../Models/user.model");
const generateTokenAndSetCookie = require("../utils/generateTokenAndSetCookie");
const {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendResetSuccessEmail
} = require("../mailtrap/emails");

const signup = async (req, res) => {
  const { email, password, name } = req.body;

  try {
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "All fields (email, password, and name) are required",
      });
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

    generateTokenAndSetCookie(res, user._id)

    sendVerificationEmail(user.email, verificationToken);

    res.status(201).json({
      success: true,
      message: "User Created Successfully",
      user: {
        ...user._doc,
        password: undefined,
      },
    });
  } catch (error) {
    console.log("Error in signup ", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error"
      });
  }
}

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and Password are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid Credentials",
        });
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password);

    if (!isPasswordValid) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid Credentials",
        });
    }

    generateTokenAndSetCookie(res, user._id);

    user.lastLogin = new Date();

    await user.save();

    return res
      .status(200)
      .json({
        success: false,
        message: "Logged in successfully",
        user: {
          ...user._doc,
          password: undefined,
        }
      });
  } catch (error) {
    console.log("Error in Login ", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error"
      });
  }
}

const logout = async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
}

const verifyEmail = async (req, res) => {
  const { code } = req.body;

  try {
    const user = await User.findOne({
      verificationToken: code,
      verificationTokenExpiresAt: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid or expired verification code",
        });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiresAt = undefined;

    await user.save();

    await sendWelcomeEmail(user.email, user.name);

    return res
      .status(200)
      .json({
        success: true,
        message: "Email Verified successfully",
        user: {
          ...user._doc,
          password: undefined,
        },
      });
  } catch (error) {
    console.log("error in verifyEmail ", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error",
      });
  }
}

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Email is required.",
        });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(400)
        .json({
          success: false,
          message: "User not found.",
        });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000;

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiresAt = resetTokenExpiresAt;

    await user.save();

    await sendPasswordResetEmail(user.email, `${process.env.CLIENT_URL}/reset-password/${resetToken}`);

    return res
      .status(200)
      .json({
        success: true,
        message: "Password reset link sent to your email",
      });
  } catch (error) {
    console.log("Error in forgotPassword ", error);

    return res
      .status(400)
      .json({
        success: false,
        message: error.message,
      });
  }
}

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    if (!token || !password) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Token and Password are required.",
        });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiresAt: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid or expired reset token"
        });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiresAt = undefined;

    await user.save();

    await sendResetSuccessEmail(user.email);

    return res
      .status(200)
      .json({
        success: true,
        message: "Password reset successful",
      });
  } catch (error) {
    console.log("Error in resetPassword ", error);

    return res
      .status(400)
      .json({
        success: false,
        message: error.message,
      });
  }
}

const checkAuth = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res
        .status(400)
        .json({
          success: false,
          message: "User not found",
        });
    }

    return res
      .status(200)
      .json({
        success: true,
        user
      });
  } catch (error) {
    console.log("Error in checkAuth ", error);

    return res
      .status(400)
      .json({
        success: false,
        message: error.message,
      });
  }
};

module.exports = {
  signup,
  login,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  checkAuth,
}