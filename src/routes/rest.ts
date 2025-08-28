// src/routes/userRoutes.ts
import e, { type Request, type Response } from "express";
import { Router } from 'express';
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { OAuth2Client } from 'google-auth-library';
import { getPlant, addPlant, addOrUpdateUser, getUserLanguage, saveLanguageToUserProfile} from ".././database/database.js";
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

/*
rest.get("/GET/oauth2callback", (req, res) => {
    console.log("Rest oauth2callback. next is req");
    //console.log(req);
    res.send("Rest oauth2callback.");
});
*/

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
            addOrUpdateUser(user);
            let language = await getUserLanguage(user.id);

            // generate the jwt token.
            let jwtToken = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '1h' });
            let refreshToken = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '7d' });
            //no need to store in database.
            //addToken(user.id, jwtToken);
            return res.json(
            JSON.stringify({
                "message": "Success",
                "language": language,
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
    //begin security check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send('Unauthorized: No token provided or malformed.');
    }
    const jwtToken: any = authHeader.split(' ')[1];
    if (!checkToken(jwtToken)) {
        return res.status(401).send('Unauthorized: Token is invalid or expired.');
    }
    // end security check

    //console.log("in getPlantEntries");
    //console.log('All Headers:', req.headers);

    // Access a specific header (case-insensitive)
    //const jwtToken = req.headers['Jwt-Token'];
    //console.log("jwtToken: " + jwtToken);

    JSON.stringify({
        "message": "Success",
    });
});



rest.post('/POST/setLanguage', (req, res) => {
    //console.log("in setLanguage");
    //begin security check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send('Unauthorized: No token provided or malformed.');
    }
    const jwtToken: any = authHeader.split(' ')[1];
    if (!checkToken(jwtToken)) {
        return res.status(401).send('Unauthorized: Token is invalid or expired.');
    }
    // end security check

    const payload = jwt.verify(jwtToken, jwtSecret);    const decodedPayload: any = jwt.verify(jwtToken, jwtSecret);
    const selectedLanguage = req.body.language;
    const userId = decodedPayload.userId;
    saveLanguageToUserProfile(userId, selectedLanguage);

    return res.status(200).json({ 
        message: "Not Yet",
    });
    
});

rest.post('/POST/analyzePhotoWithGemini', upload.single('myFile'), async (req: Request, res: Response) => {

    //begin security check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send('Unauthorized: No token provided or malformed.');
    }
    const jwtToken: any = authHeader.split(' ')[1];
    if (!checkToken(jwtToken)) {
        return res.status(401).send('Unauthorized: Token is invalid or expired.');
    }
    // end security check

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

        const textPrompt1 = `
            Analyze the plant.
            Please only provide the Technical Latin name.  Have it formatted so that 'Technical Latin Name ' is before the name. :
            - Technical Latin Name`;


        const myContents = [
            {
                inlineData: {
                mimeType: "image/jpeg",
                data: base64ImageFile,
                },
            },
            { text: textPrompt1 },
        ];
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: myContents,
        });
        // Extract the response text
        let responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        const regex = /Technical Latin Name: (.*)$/m;
        let databaseKey : any;
        let latinName : any;
        if(responseText != undefined){
            let match: string[] | null = regex.exec(responseText);
            console.log("This is match");
            console.log(match);
            if (match != undefined ) {
                // The captured group is at index 1 of the match array
                latinName = match[1]?.trim();
                databaseKey = latinName?.replace(/^\*+|\*+$/g, '').toLowerCase().replace(/ /g, "-");
                console.log("databaseKey");
                console.log(databaseKey); // Output: Hello World***
            }
        }
        if (!responseText) {
            return res.status(500).json({ error: 'Failed to get a valid response from the Gemini API.' });
        }
        // now we have the technical name used for the key.  We will hit the database and return what is in
        // that database is anything is there.

        let databaseResult : any;
        if(databaseKey!=undefined) {
            databaseResult = await getPlant(databaseKey)
            console.log(databaseResult);
            console.log("databaseResult");

            if(databaseResult.length>0) {
                responseText = databaseResult[0].text;
                return res.status(200).json({
                    message: "success",
                    response: responseText
                });
            } else {
               // its not in the database.  We need to call AI and give them the technical name only with 
               // the same prompt but no image.

                const textPrompt2 = `
                    Analyze the plant with the technical name ${latinName}. I need a comprehensive report.
                    Please provide the following information:
                    - Common English Name
                    - Technical Latin Name
                    - A detailed Description of the plant
                    - Human Food Value (if any, be specific)
                    - Medicinal Value (if any, describe)
                    - Other Practical Uses (if any)

                    Format the response in a structured, easy-to-read manner.`;

                const myContents2 = [ { text: textPrompt2 }, ];
                const myResults2 = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: myContents2,
                });

                let responseText2 = myResults2.candidates?.[0]?.content?.parts?.[0]?.text;
                console.log(responseText2);
                let plant = {
                    id: databaseKey,
                    text: responseText2,
                }
                addPlant(databaseKey, plant);
                return res.status(200).json({ 
                    message: "success",
                    response: responseText2 
                });
            }
        }

        // Send the response back to your React Native app
        //return res.status(200).json({ 
        //    message: "success",
        //    response: responseText 
        //});

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
    const decodedPayload: any = jwt.verify(jwtTokenValue, jwtSecret);
    let expiration_timestamp = decodedPayload.exp;
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    const isExpired = decodedPayload.exp < currentTimeInSeconds;
    
    //console.log("EXP: " + expiration_timestamp);
    /*
    if (isExpired) {
        console.log("Token has expired. 💀");
    } else {
        console.log("Token is still valid. ✅");
    }
    */
    return !isExpired;
}


//module.exports = rest;