const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required:true },
  password: { type: String, required: true },
  role:{
    type:String,
    enum:["user", "admin"],
    default:"user"
  },
  isVerified:{type:Boolean, default:false},
  verificationToken:{type: String, default:null},
  signInCode:{type: String, default: null},
  signInCodeExpiry:{type: Date, default: null},
  resetPasswordToken:{type: String, default: null},
  resetPasswordExpiry:{type: Date, default: null},

});

module.exports = mongoose.model("User", UserSchema);