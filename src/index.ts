import express, { type Request, type Response } from "express";
import dotenv from "dotenv";
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import  { rest }  from "./routes/rest.js";
import  multer  from 'multer';
import path from 'path';
//import exifr from 'exifr';
import ExifReader from 'exifreader';


// configures dotenv to work in your application
dotenv.config();
const app = express();
const PORT = process.env.PORT;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/*
const allowedOrigins = [
  'https://your-mobile-app-webview-domain.com',
  'http://localhost:3001',
  'http://10.0.2.2:3001',
  'http://10.0.2.2:3000',
  'http://localhost:3000',
];
const corsOptions = {
    origin: function (origin: any, callback: any) {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Allow sending cookies and HTTP authentication credentials
    optionsSuccessStatus: 204 // For preflight requests
};

app.use(cors(corsOptions));
*/
app.use(express.urlencoded()); 
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.use("/rest", rest);

// Set up Multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // The directory where files will be stored
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ 
    storage,
    limits: {
        fieldSize: 5 * 1024 * 1024 // 5MB limit for field values
    }
 });

// The upload endpoint
app.post('/upload', upload.single('myFile'), (req: Request, res: Response) => {
    console.log("this is in upload");
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    try {
        const tags = ExifReader.load(req.file.path).then((data) => {
            return res.status(200).json({
                message: 'File uploaded successfully!',
                fileName: data.filename,
                filePath: data.path,
                latitude: data.GPSLatitude?.description,
                longitude: data.GPSLongitude?.description
            });
        })
        .catch((error) => {
            console.error("Error:", error); // This will be executed if the Promise rejects
            JSON.stringify({
                "message": error,
            });
        });
    } catch (error) {
        console.error("Error reading EXIF data:", error);
        JSON.stringify({
            "message": error,
        });
    }
});

app.listen(PORT, () => { 
  console.log("Server running at PORT: ", PORT); 
}).on("error", (error) => {
  // gracefully handle error
  throw new Error(error.message);
});