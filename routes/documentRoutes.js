const express = require("express");
const multer = require("multer");
const Document = require("../models/Document");
const { isAuthenticated } = require("../middleware/authMiddleware"); // Ensure user is logged in
const fs = require("fs");
const path=require("path");

const router = express.Router();
const {exec} = require("child_process");

// Configure Multer for file uploads (store in memory for now)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "uploads/"); // Save files to the uploads folder
    },
    filename: function (req, file, cb) {
      cb(null, `${Date.now()}_${file.originalname}`);
    },
  });
  
  const upload = multer({ storage: storage });
  router.post("/upload", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
  
      const { title, description, category } = req.body;
      const documentId = path.parse(req.file.filename).name; // Extract ID from filename
      const pdfPath = path.join(__dirname, `../uploads/${req.file.filename}`); // Path to uploaded PDF
      const outputDir = path.join(__dirname, `../uploads/${documentId}/pages`); // Pages folder
  
      // Ensure the pages directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`📂 Created directory: ${outputDir}`);
      }
  
      // Command to convert PDF pages into images
      const command = `pdftoppm -png "${pdfPath}" "${outputDir}/page"`;
  
      // Execute the command
      exec(command, async (error, stdout, stderr) => {
        if (error) {
          console.error(" Error converting PDF:", error);
          return res.status(500).json({ error: "Error converting PDF to images" });
        }
        console.log(" PDF pages extracted successfully!");
        console.log(stdout);
  
        // Get extracted page filenames
        const extractedFiles = fs.readdirSync(outputDir)
          .filter(file => file.endsWith(".png"))
          .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)[0]);
            const numB = parseInt(b.match(/\d+/)[0]);
            return numA - numB;
          });
  
        // Format pages to store in DB
        const pagesArray = extractedFiles.map((filename, index) => ({
          pageNumber: index + 1,
          imageUrl: `/uploads/${documentId}/pages/${filename}`,
          status: "not started",
          transcription: "",
          contributors: [],
        }));
  
        // Save document in MongoDB
        const newDocument = new Document({
          documentId,
          title,
          description,
          category,
          fileUrl: `/uploads/${req.file.filename}`,
          uploadedBy: req.user._id, // Ensure user is authenticated
          pages: pagesArray,
        });
  
        await newDocument.save();
        console.log("✅ Document & Pages Saved to DB!", newDocument);
  
        res.status(201).json({ message: "PDF uploaded & pages extracted", document: newDocument });
      });
  
    } catch (error) {
      console.error(" Document upload failed", error);
      res.status(500).json({ error: "Document upload failed" });
    }
  });
  
  /**
   *  2. Fetch Document Pages
   * @route GET /documents/:documentId/pages
   */
  router.get("/:documentId/pages", isAuthenticated, async (req, res) => {
    try {
      const document = await Document.findOne({ documentId: req.params.documentId });
  
      if (!document) return res.status(404).json({ error: "Document not found" });
  
      res.json(document.pages.map(page => ({
        ...page._doc,
        imageUrl: `/uploads/${document.documentId}/pages/page-${page.pageNumber}.png`, //  Send page image URL
      })));
    } catch (error) {
      console.error("Error fetching pages", error);
      res.status(500).json({ error: "Error fetching pages" });
    }
  });

router.get("/:documentId", isAuthenticated, async (req, res) => { 
  try { 
    
    const document= await Document.findOne({documentId: req.params.documentId});
    if (!document)  return  res.status(404).json({ error: "Document not found" }); 
    res.status(200).json(document); 
  } catch (error) 
  { console.error("Error fetching document", error); 
    res.status(500).json({ error: "Error fetching document" }); } }); 
/**
 * 2. Fetch All Documents
 * @route GET /documents
 */
  router.get("/", isAuthenticated, async (req, res) => {
    try {
        const documents = await Document.find().populate("uploadedBy", "name email");
        
        const documentsWithProgress = documents.map((doc) => {
            const totalPages = doc.pages.length;
            const statusCounts = {
                completed: 0,
                "in progress": 0,
                "in review": 0,
                "not started": 0,
            };

            // Count pages based on their status
            doc.pages.forEach(page => {
                statusCounts[page.status] += 1;
            });

            // Calculate percentage of each status
            const progress = {
                completed: ((statusCounts.completed / totalPages) * 100).toFixed(2),
                inProgress: ((statusCounts["in progress"] / totalPages) * 100).toFixed(2),
                inReview: ((statusCounts["in review"] / totalPages) * 100).toFixed(2),
                notStarted: ((statusCounts["not started"] / totalPages) * 100).toFixed(2),
            };

            return { ...doc._doc, progress };
        });

        res.status(200).json(documentsWithProgress);
    } catch (error) {
        res.status(500).json({ error: "Error fetching documents" });
    }
});

/**
 *  3. Submit a Transcription
 * @route POST /documents/:documentId/transcribe
 */
router.post("/:documentId/page/:pageNumber/transcribe", isAuthenticated, async (req, res) => {
  try {
    const { text } = req.body;
    const { documentId, pageNumber}= req.params;
    console.log(`Transcription request: documentId=${documentId}, pageNumber=${pageNumber}, text="${text}"`);
    const document = await Document.findOne({documentId});
    
    if (!document) {
      console.error("document not found");
      return res.status(404).json({ error: "Document not found" });
    }

    const page = document.pages.find(p=> p.pageNumber == pageNumber);
    if(!page){
      console.error(`Page not found: Page ${pageNumber}`);

     return res.status(404).json({error:"page not found"});
    }
    page.transcription=text;
    page.status="in progress";

    if(!page.contributors.includes(req.user._id)){
    page.contributors.push(req.user._id);
    }


    await document.save();
    console.log("Transcription saved successfully");
    res.status(201).json({ message: "Transcription saved" });
  } catch (error) {
    console.error("error saving transcription", error);
    res.status(500).json({ error: "Error submitting transcription" });
  }
});






  router.get("/:documentId/page/:pageNumber", isAuthenticated, async (req, res) => {
    try {
      const document = await Document.findOne({documentId: req.params.documentId});
      if (!document) return res.status(404).json({ error: "Document not found" });
  
      const page = document.pages.find(p => p.pageNumber == req.params.pageNumber);
      if (!page) return res.status(404).json({ error: "Page not found" });
  
      res.json(page);
    } catch (error) {
      console.error("Error fetching page", error);
      res.status(500).json({ error: "Error fetching page" });
    }
  });

  router.get("/categories", isAuthenticated, async(req, res)=>{
    try{
      const categories= await Document.aggregate([
        { $group: {_id:"$category", documents:{$push:"$$ROOT"}}}
      ]);
      res.status(200).json(categories);
    } catch(error){
      console.error("Error fetching categories", error);
      res.status(500).json({error:"Error fetching categories"});
    }
  })
  router.patch("/:documentId/page/:pageNumber/status", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      const { documentId, pageNumber } = req.params;
      console.log(`Received status update : ${status} for document ${documentId}, page ${pageNumber}`);
      const document = await Document.findOne({ documentId: documentId });
  
      if (!document) 
        {
          console.error("document not found");
          return res.status(404).json({ error: "Document not found" });
        }
  
      const page = document.pages.find((p) => p.pageNumber == pageNumber);
      if (!page) {
        console.error(`Page not found: ${pageNumber}`);
        return res.status(404).json({ error: "Page not found" });
      }
  
      page.status = status;
      await document.save();
      console.log(`Page ${pageNumber} status updated to : ${status}`);
  
      res.json({ message: "Page status updated" });
    } catch (error) {
      console.error("Error updating page status", error);
      res.status(500).json({ error: "Error updating page status" });
    }
  });
 
module.exports = router;