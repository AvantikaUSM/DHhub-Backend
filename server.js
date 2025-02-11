const express = require("express");
const session = require("express-session");
const cors = require("cors");
const mongoose = require("mongoose");
const passport = require("passport");
require("dotenv").config();
require("./config/passport")(passport);

const app = express();

//  Allow both Localhost & Production Frontend
const allowedOrigins = [
  "http://localhost:3000",
  "https://www.ms-digital-hub.com",
];

app.use((req, res, next) => {
  console.log("🛠 Incoming request origin:", req.headers.origin);

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    console.log(" CORS allowed for:", origin);
    res.header("Access-Control-Allow-Origin", origin);
  } else {
    console.log(" CORS denied for:", origin);
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// Middleware
app.use(express.json());
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Serve static files (Ensure uploads work in production)
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Session setup (Use MongoStore for production)
const MongoStore = require("connect-mongo");
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { secure: false }, // Change to true if using HTTPS
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/auth", require("./routes/auth"));
app.use("/documents", require("./routes/documentRoutes"));

// Root route
app.get("/", (req, res) => {
  res.send("API is running");
});

// Database Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to Mongodb Atlas");
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, () => console.log(`server running on port ${PORT}`));
  })
  .catch((err) => console.error("Mongodb connection error:", err));