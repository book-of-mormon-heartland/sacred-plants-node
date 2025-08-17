import{ Firestore } from '@google-cloud/firestore';
import admin from 'firebase-admin'
import dotenv from "dotenv";

dotenv.config();
const  GOOGLE_CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH;

var serviceAccountPath = GOOGLE_CREDENTIALS_PATH;
if (serviceAccountPath) {
    const serviceAccount = await import(serviceAccountPath, { with: { type: 'json' }}).then(serviceAccount => {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount.default)
        });
    });
}


export const db = admin.firestore();
db.settings({
  ignoreUndefinedProperties: true, // Optional: useful for preventing errors with undefined values
  databaseId: 'sacredplants', // Uncomment and replace with your actual database ID if
});

export const addUser = ( user: any ) => {
  const docRef = db.collection('users').doc(user.id);
  docRef.set( user );
}


