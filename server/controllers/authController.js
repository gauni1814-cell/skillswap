const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const admin = require("../config/firebaseAdmin");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// ------------------ GOOGLE LOGIN ------------------
exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ msg: "ID token is required" });
    }

    // Verify the Google ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    const { email, name, picture } = decodedToken;

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user for first-time login
      user = await User.create({
        name: name || "Google User",
        email,
        photo: picture,
        provider: "google",
        password: null, // No password for Google users
      });
    } else {
      // Update existing user's photo if changed
      if (picture && user.photo !== picture) {
        user.photo = picture;
        await user.save();
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        photo: user.photo,
        provider: user.provider,
      },
    });

  } catch (err) {
    console.error("Google Login Error:", err);
    res.status(500).json({ msg: "Google authentication failed" });
  }
};

// ------------------ SAVE GOOGLE TOKENS ------------------
exports.saveGoogleTokens = async (req, res) => {
  try {
    const { tokens } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    user.googleTokens = tokens;
    await user.save();

    res.json({ success: true, msg: "Google tokens saved successfully" });
  } catch (err) {
    console.error("Save Google Tokens Error:", err);
    res.status(500).json({ msg: "Failed to save Google tokens" });
  }
};

// ------------------ REGISTER ------------------
exports.register = async (req, res) => {
  try {
    const { fullName, name, email, password } = req.body;

    // accept both fullName and name
    const userName = fullName || name;

    if (!userName || !/^[A-Za-z ]+$/.test(userName)) {
      return res.status(400).json({ msg: "Name can only contain letters" });
    }

    // check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10);

    // create user
    await User.create({
      name: userName,
      email,
      password: hashed,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
};

// ------------------ LOGIN ------------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    // Compare password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ msg: "Wrong password" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        photo: user.photo,
      },
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ------------------ GET CURRENT USER ------------------
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json(user);

  } catch (err) {
    console.error("GetMe Error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ------------------ FORGOT PASSWORD ------------------
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ msg: "Email is required" });
    }

    const user = await User.findOne({ email });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({ 
        success: true, 
        msg: "If an account exists with this email, you will receive a password reset link" 
      });
    }

    // Check if user signed up with Google
    if (user.provider === "google") {
      return res.status(400).json({ 
        msg: "This account uses Google sign-in. Please use Google to log in." 
      });
    }

    // Check if email credentials are configured
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    if (!emailUser || !emailPass || emailPass === "your-app-password") {
      // For development: return mock success without sending email
      console.warn("⚠️ Email not configured - password reset unavailable in development mode");
      
      return res.status(200).json({ 
        success: true, 
        msg: "If an account exists with this email, you will receive a password reset link" 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    const resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutes

    user.resetPasswordToken = resetPasswordToken;
    user.resetPasswordExpires = resetPasswordExpires;
    await user.save();

    // Create reset URL
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

    // Create transporter (using Gmail for demo - in production use a proper service)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    const mailOptions = {
      from: '"SkillSwap" <noreply@skillswap.com>',
      to: email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #4F46E5;">Password Reset Request</h2>
          <p>You requested a password reset for your SkillSwap account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(to right, #4F46E5, #6366F1); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">Reset Password</a>
          <p>Or copy this link: <br/> <span style="color: #4F46E5;">${resetUrl}</span></p>
          <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">This link will expire in 30 minutes.</p>
          <p style="color: #6B7280; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      success: true, 
      msg: "Password reset link sent to your email" 
    });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    // Even on error, don't expose details
    res.status(200).json({ 
      success: true, 
      msg: "If an account exists with this email, you will receive a password reset link" 
    });
  }
};

// ------------------ RESET PASSWORD ------------------
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ msg: "Token and new password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters" });
    }

    // Hash the token to compare with stored token
    const resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ msg: "Invalid or expired reset token" });
    }

    // Hash new password
    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ 
      success: true, 
      msg: "Password reset successful. You can now log in with your new password." 
    });

  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ------------------ SEND RESET OTP ------------------
exports.sendResetOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ msg: "Email is required" });
    }

    const user = await User.findOne({ email });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({ 
        success: true, 
        msg: "If an account exists with this email, you will receive an OTP" 
      });
    }

    // Check if user signed up with Google
    if (user.provider === "google") {
      return res.status(400).json({ 
        msg: "This account uses Google sign-in. Please use Google to log in." 
      });
    }

    // Check if email credentials are configured
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    console.log("📧 Email config check:", { emailUser: !!emailUser, emailPass: !!emailPass });
    
    if (!emailUser || !emailPass || emailPass === "your-app-password") {
      // For development: return mock success without sending email
      console.warn("⚠️ Email not configured - returning mock OTP for development");
      
      // Generate 6-digit OTP (for testing without email)
      const otp = "123456"; // Fixed OTP for development
      const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

      user.resetOtp = otp;
      user.resetOtpExpires = otpExpires;
      await user.save();

      console.log("📧 Mock OTP generated:", otp, "for user:", email);
      
      return res.status(200).json({ 
        success: true, 
        msg: "OTP sent to your email (Development mode: use 123456)" 
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.resetOtp = otp;
    user.resetOtpExpires = otpExpires;
    await user.save();

    console.log("📧 Creating transporter for:", emailUser);
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    const mailOptions = {
      from: '"SkillSwap" <noreply@skillswap.com>',
      to: email,
      subject: "Password Reset OTP - SkillSwap",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #4F46E5;">Password Reset OTP</h2>
          <p>You requested a password reset for your SkillSwap account.</p>
          <div style="background: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; color: #6B7280; margin-bottom: 10px;">Your OTP is:</p>
            <p style="font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 8px;">${otp}</p>
          </div>
          <p style="color: #6B7280; font-size: 14px;">This OTP will expire in 10 minutes.</p>
          <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    };

    console.log("📧 Attempting to send email to:", email);
    
    await transporter.sendMail(mailOptions);
    
    console.log("📧 Email sent successfully!");

    res.status(200).json({ 
      success: true, 
      msg: "OTP sent to your email" 
    });

  } catch (err) {
    console.error("Send OTP Error:", err);
    // Return success to prevent email enumeration even on error
    res.status(200).json({ 
      success: true, 
      msg: "If an account exists with this email, you will receive an OTP" 
    });
  }
};

// ------------------ VERIFY RESET OTP ------------------
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ msg: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (user.resetOtp !== otp) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (user.resetOtpExpires < Date.now()) {
      return res.status(400).json({ msg: "OTP has expired" });
    }

    // OTP is valid
    res.status(200).json({ 
      success: true, 
      msg: "OTP verified successfully" 
    });

  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ------------------ RESET PASSWORD WITH OTP ------------------
exports.resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ msg: "Email, OTP and new password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ msg: "Invalid request" });
    }

    if (user.resetOtp !== otp) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (user.resetOtpExpires < Date.now()) {
      return res.status(400).json({ msg: "OTP has expired" });
    }

    // Hash new password
    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    res.status(200).json({ 
      success: true, 
      msg: "Password updated successfully" 
    });

  } catch (err) {
    console.error("Reset Password with OTP Error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

