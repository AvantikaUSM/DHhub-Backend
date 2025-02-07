require("dotenv").config({path:"./.env"});
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
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
const allowedOrigins=[
  "http://localhost:3000",
  "https://www.ms-digital-hub.com/",
]
app.use(
  cors({
    origin: allowedOrigins,

   
    credentials: true,
    methods: "GET,POST,PUT,DELETE,PATCH,OPTIONS",
    allowedHeaders: "Content-Type,Authorization"
  })
);

// **Middleware**
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname,"uploads")));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
 app.use( 
  session({ 
    secret: process.env.SESSION_SECRET || "your_secret_key", 
    resave: false, 
    saveUninitialized: false, 
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI}), 
      cookie: { 
        secure: true, sameSite:"none" }, 
      }) 
    );

app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if(allowedOrigins.includes(origin)){
  res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});
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


