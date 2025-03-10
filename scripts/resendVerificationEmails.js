const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User"); // Adjust the path to your User model
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB... Finding unverified users");

    // Find users who are not verified
    const unverifiedUsers = await User.find({ isVerified: false });

    if (unverifiedUsers.length === 0) {
      console.log("No unverified users found.");
      mongoose.connection.close();
      return;
    }

    // Configure email transporter
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Loop through unverified users and send emails
    for (let user of unverifiedUsers) {
      let verificationToken = user.verificationToken;

      // If the user has no verification token, generate a new one
      if (!verificationToken) {
        verificationToken = crypto.randomBytes(32).toString("hex");
        user.verificationToken = verificationToken;
        await user.save();
      }

      const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

      try {
        await transporter.sendMail({
          to: user.email,
          subject: "Reminder: Verify Your Email to Login",
          html: `
            <h3>Hello ${user.name},</h3>
            <p>We noticed that you haven’t verified your email yet. Please complete your verification so you can log in without issues.</p>
            <p><strong>Click the button below to verify:</strong></p>
            <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; color: white; background: #007BFF; text-decoration: none; border-radius: 5px;">Verify Email</a>
            <p>If you don’t see this email in your inbox, please check your spam folder.</p>
            <p>If you already verified your email, you can ignore this message.</p>
            <p>Need help? Contact support.</p>
            <p>Thank you!</p>
          `,
        });

        console.log(`Verification email resent to ${user.email}`);
      } catch (error) {
        console.error(`Failed to send email to ${user.email}`, error);
      }
    }

    console.log("Reminder emails sent to all unverified users.");
    mongoose.connection.close();
  })
  .catch(err => console.error("Error sending verification emails:", err));