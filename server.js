require("dotenv").config({path:"./.env"});
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const cors = require("cors");


require("./config/passport")(passport);

const app = express();
const fs = require("fs");
const path = require("path");

// Ensure uploads folder exists
const uploadPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
  console.log("✅ 'uploads' folder created successfully!");
}
// Middleware
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use("/uploads", express.static(path.join(__dirname,"uploads")));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/auth", require("./routes/auth"));
app.get("/",(req, res)=>{
    res.send("API is running");
  });
  app.use("/documents",  require("./routes/documentRoutes"));
// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(()  => {console.log("Connected to Mongodb Atlas");
  const PORT = process.env.PORT ||5001;
  app.listen(PORT, ()=> console.log(`server running on port ${PORT}`));
})

  .catch((err) => console.error(err,"Mongodb connection error"));


