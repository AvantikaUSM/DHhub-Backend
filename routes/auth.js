const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const User = require("../models/User");
const {isAuthenticated, isAdmin}= require("../middleware/authMiddleware");
const crypto =require("crypto");

const router = express.Router();
const nodemailer = require("nodemailer");
//  Generate JWT Token
const generateToken = (user) => {
  return jwt.sign({ _id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};
const transporter = nodemailer.createTransport({
  service:"Gmail",
  auth:{
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
const passwordRegex=/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}$/;
//  User Registration
router.post("/signup", async (req, res) => {
  try {
    console.log("signup request received", req.body);

    const { name, email, password, role } = req.body;
    if(!name || !email || !password){
        return res.status(400).json({error: "all fields are required"});
    }
    if(!passwordRegex.test(password)){
        return res.status(400).json({error:"Password must be atleast 8 characters, include 1 uppercase, 1 lowercase, 1 number, and 1 special character."});
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken =  crypto.randomBytes(32).toString("hex");
    const isAdmin=(await User.countDocuments())===0;

    // Set user role (Default to "user" unless explicitly specified)
    const newUser = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      isVerified:false,
      verificationToken,
      role: isAdmin ? "admin" : "user", 
    });

    await newUser.save();
    const verificationLink =`${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
    await transporter.sendMail({
      to:email,
      subject:"Email Verification",
      html:`<h3>Click the link below to verify your email:</h3><a href="${verificationLink}">Verify Email</a>`,
    });
  

    res.status(201).json({ message: "User registered successfully. Please check your email for verification." });
  } catch (error) {
    console.error("signup failed", error);
    res.status(500).json({ error: "Registration failed" });
  }
});
router.get("/verify-email", async(req, res)=>{
  
  try{
    const {token} = req.query;
    const user = await User.findOne({verificationToken:token});
    if(!user){ 
      
      return res.status(400).json({error:"Invalid or expired token"});
    }
    user.verificationToken = null;
    user.isVerified = true;
 
    await user.save();
    return res.json({message:"email verified sucessfully. You can now login."});
  } catch(error){
    console.error("Email verification failed", error);
    res.status(500).json({error:"Verification failed"});
  }
});
//  User Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) 
      {
        return res.status(400).json({ error: "Invalid email or password" });
      }

    if(!user.isVerified)
      {
         return res.status(400).json({error:"Please verify your email before logging in."});
      }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid email or password" });

    // Generate JWT token
    const token = generateToken(user);

    res.json({ message: "Logged in successfully", token, user });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

//  Get Current User Info
router.get("/me", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Error fetching user info" });
  }
});

//  User Logout (Clears JWT in frontend)
router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.json({ message: "Logged out successfully" });
  });
});
// Promote User to Admin (Admins Only)
router.patch("/promote/:userId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
  
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
  
      user.role = "admin";
      await user.save();
  
      res.status(200).json({ message: "User promoted to admin", user });
    } catch (error) {
      res.status(500).json({ error: "Failed to promote user" });
    }
  });
  
  // Fetch All Users (Admins Only)
  router.get("/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await User.find({}, "-password"); // Exclude password from response
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ error: "Error fetching users" });
    }
  });

module.exports = router;