// src/routes/userRoutes.ts
import { type Request, type Response } from "express";
import { Router } from 'express';
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { OAuth2Client } from 'google-auth-library';
import {addUser} from ".././database/database.js";
import  multer  from 'multer';
import path from 'path';
import ExifReader from 'exifreader';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';



const GOOGLE_WEB_CLIENT_ID = '376185747738-cis3bg5c2r3ofrl5n2c3atajtkfrljea.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '376185747738-nscordtp2n63f4n3hqt41olpabdftj8k.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '376185747738-6u0jf0mfh18av8at848b1ft2ff949pac.apps.googleusercontent.com';
const GOOGLE_WEB_CLIENT_SECRET = process.env.GOOGLE_WEB_CLIENT_SECRET;
const GEMINI_AI_KEY=process.env.GEMINI_AI_KEY;

export const rest = Router();
dotenv.config();
const jwtSecret = process.env.JWT_SECRET || "";

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



// Home page route.
rest.get("/", function (req, res) {
    res.send("Rest home page");
});


rest.get("/GET/oauth2callback", (req, res) => {
    console.log("Rest oauth2callback. next is req");
    //console.log(req);
    res.send("Rest oauth2callback.");
});

rest.post('/POST/googlelogin', (req, res) => {

    // retrieve the token
    const token = req.body.token;
    const user = req.body.user;
    
    // validate the token with google.
    const client = new OAuth2Client(GOOGLE_WEB_CLIENT_ID);
    async function verify() {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: [ GOOGLE_WEB_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID ], 
        });
        const payload = ticket.getPayload();
        if(payload==undefined || token==undefined || user==undefined ) {
            return res.json(
                JSON.stringify({
                    "message": "values were undefined",
                    "jwtToken": "",
                    "refreshToken": "",
                }));
        } else {
            const userid = payload['sub'];
            if (payload.sub !== user.id) {
            return res.json(
                JSON.stringify({
                "message": "Error: Token user ID does not match provided user ID",
                "jwtToken": "",
                "refreshToken": "",
                }));
            }
            // Add or update the user.  Same thing here.
            addUser(user);
            // generate the jwt token.
            let jwtToken = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '1h' });
            let refreshToken = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '7d' });
            //no need to store in database.
            //addToken(user.id, jwtToken);
            return res.json(
            JSON.stringify({
                "message": "Success",
                "jwtToken": jwtToken,
                "refreshToken": refreshToken,
            }))
 
        }
    }
    verify().catch((error) => {
        return res.json(
        JSON.stringify({
            "message": error,
            "jwtToken": "",
            "refreshToken": "",
        }));
    });
});

rest.post('/POST/signout', (req, res) => {
    console.log("in signout");
    JSON.stringify({
        "message": "Success",
    });
});

rest.post('/POST/getPlantEntries', (req, res) => {
    //console.log("in getPlantEntries");
    //console.log('All Headers:', req.headers);

        // Access a specific header (case-insensitive)
    const jwtToken = req.headers['Jwt-Token'];
        //console.log("jwtToken: " + jwtToken);

    JSON.stringify({
        "message": "Success",
    });
});



rest.post('/POST/analyzePhotoWithGemini', upload.single('myFile'), async (req: Request, res: Response) => {
    
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    try {
        //const geminiResponse = await analyzePlantImage(req.file.path);
        const apiKey = GEMINI_AI_KEY;
        if (!apiKey) {
            throw new Error('GOOGLE_API_KEY not found. Please set it in your .env file.');
        }
        const ai = new GoogleGenAI({ apiKey });
        const base64ImageFile = fs.readFileSync(req.file.path, {
            encoding: "base64",
        });

        const textPrompt = `
            Analyze the plant in this image. I need a comprehensive report.
            Please provide the following information:
            - Common English Name
            - Technical Latin Name
            - A detailed Description of the plant
            - Human Food Value (if any, be specific)
            - Medicinal Value (if any, describe)
            - Other Practical Uses (if any)

            Format the response in a structured, easy-to-read manner.`;

        const myContents = [
            {
                inlineData: {
                mimeType: "image/jpeg",
                data: base64ImageFile,
                },
            },
            { text: textPrompt },
        ];
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: myContents,
        });
        // Extract the response text
        const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            return res.status(500).json({ error: 'Failed to get a valid response from the Gemini API.' });
        }
        // Send the response back to your React Native app
        return res.status(200).json({ 
            message: "success",
            response: responseText 
        });

   } catch (error) {
        console.error("Error analyzing image with Gemini:", error);
        return res.status(500).json({ message: "Error analyzing image", error: error?.toString() });
   }
    
});


rest.post('/POST/refreshtoken', (req, res) => {
    /*
    const jwtToken = req.headers['authorization'];
    try {
        const payload = jwt.verify(jwtToken, jwtSecret);
        console.log(payload);
        console.log(payload.userId);
        let expiration_timestamp = payload.exp
        let current_timestamp_utc = int(time.time()) 
        console.log("Expiration Timestamp: ", expiration_timestamp);
        console.log("Current Timestamp: ", current_timestamp_utc);

        if (expiration_timestamp <= current_timestamp_utc){
            let newJwtToken = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '1h' });
            return res.json(
            JSON.stringify({
                "message": "Token Refresh.",
                "jwtToken": newJwtToken,
            })
            );
        } else {
            console.log("Token is still valid");
            return res.json(
            JSON.stringify({
                "message": "Token is still valid, no need to refresh.",
                "jwtToken": jwtToken,
            })
            );
        }
    } catch (error) {
        console.error('Error verifying or decoding token:', error.message);
        return res.json(
        JSON.stringify({
            "message": "Error",
            "jwtToken": "",
            "refreshToken": "",
        })
        )
    }
        */
});

const checkToken = (jwtTokenValue: string) => {
    return true;
    /*
    const payload = jwt.verify(jwtTokenValue, jwtSecret);    
    console.log(payload);
    console.log(payload?.userId);
    var expiration_timestamp: number = 0;
    if(payload?.exp != undefined) {
        expiration_timestamp = payload.exp;
    }
    let current_timestamp_utc: number = Date.now();
    console.log("Expiration Timestamp: ", expiration_timestamp);
    console.log("Current Timestamp: ", current_timestamp_utc);

    if (expiration_timestamp <= current_timestamp_utc){
        return true;
    } else {
        return false;
    }
    */
}


//module.exports = rest;