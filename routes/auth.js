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

  router.post("/send-signin-code", async(req,res)=>{
    try{
      const {email} = req.body;
      if(!email) return res.status(400).json({error:"Email is required"});
      const user = await User.findOne({email});
      if(!user) return res.status(400).json({error:"Email not registered"});
      const signInCode = crypto.randomInt(100000, 999999).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000);
      user.signInCode = signInCode;
      user.signInCodeExpiry= expiry;
      await user.save();
      await transporter.sendMail({
        to:email,
        subject:"Your Sign-in code",
        html:`<p>Your sign-in code is <strong>${signInCode}</strong>. It expires in 10minutes.</p>`,
      });
      res.json({message:"Sign-in code sent"});
    } catch(error){
      console.error("Error sending sign-in code", error);
      res.status(500).json({error:"Couldnot send sign-in code"});
    }
  });

  router.post("/verify-sign-in-code", async(req, res)=>{
    try{
      const {email, signInCode} = req.body;
      const user = await User.findOne({email});
      if(!user || user.signInCode !== signInCode || new Date()> user.signInCodeExpiry){
        return res.status(400).json({error:"Inavlid or expired code"});
      }
      user.signInCode= null;
      user.signInCodeExpiry= null;
      await user.save();
      const token = jwt.sign({ _id:user._id.toString(),role:user.role}, process.env.JWT_SECRET,{expiresIn:"7d"});
      res.json({message:"Signed in successfully", token, user});
    } catch(error){
      res.status(500).json({error:"Verification failed"});
    }
  });

  router.post("/forgot-password", async(req, res)=>{
    try{
      const {email}= req.body;
      const user = await User.findOne({email});
      if(!user) return res.status(400).json({ error:"Email not registered"});
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpiry = new Date(Date.now() + 20*60*1000);
      await user.save();
      const resetLink =`${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    //  const resetLink =`http://localhost:3000/reset-password?token=${resetToken}`;

      await transporter.sendMail({
        to:email,
        subject:"Reset Your Password",
        html:`<p> Hi ${user.name}, </p>
              <p> Click the link below to reset your password:</p>
              <a href="${resetLink}"> Reset Password</a>
              <p> The link expires in 20 minutes.</p>`,
      });
      res.json({message:"Password reset email sent"});
    } catch(error){
      res.status(500).json({error:"Failed to send reset email"});
    }
  });

  router.post("/reset-password", async(req, res)=>{
    try{
      const {token, newPassword} = req.body;
      const user = await User.findOne({ resetPasswordToken:token});

      if(!user || new Date()>user.resetPasswordExpiry){
        return res.status(400).json({error:"Invalid or expired token"});
      }
      user.password = await bcrypt.hash(newPassword, 10);
      user.resetPasswordToken = null;
      user.resetPasswordExpiry = null;
      await user.save();
      res.json({message:"Password reset successfully"});
    } catch(error){
      res.status(500).json({error:"Password reset failed"});
    }
  });

module.exports = router;