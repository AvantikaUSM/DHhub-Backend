const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const DocumentSchema = new mongoose.Schema({
  documentId: { type: String, default: uuidv4 }, 
  title: { type: String, required: true },
  description: { type: String, required: true },
  fileUrl: { type: String, required: true }, 
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
  category:{type:String, required:true},
  
  pages: [ { 
    pageNumber: Number,  
    imageUrl: String,
    status: { type: String, enum: ["not started", "in progress", "in review", "completed"], default: "not started", }, 
    transcription: { type: String, default: "" }, 
    contributors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],  
     }, 
  ],
});

module.exports = mongoose.model("Document", DocumentSchema);