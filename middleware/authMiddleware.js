const jwt = require("jsonwebtoken");

const isAuthenticated = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    console.error("access denied no token provided");
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    console.log("token received", token);
    const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
  
    req.user = {_id:decoded._id, role:decoded.role};
    console.log("user authenticated", req.user);
    next();
  } catch (err) {
    console.error("Invalid token", err);
    res.status(400).json({ error: "Invalid token." });
  }
};

const isAdmin=(req,res, next)=>{
    if(!req.user || req.user.role !=='admin'){
        return res.status(403).json({error:"Access denied. Admins only"});
    }
    next();
}

module.exports = {isAuthenticated, isAdmin};