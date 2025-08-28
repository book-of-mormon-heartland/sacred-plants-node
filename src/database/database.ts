import{ Firestore, } from '@google-cloud/firestore';
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

export const addOrUpdateUser = async( user: any ) => {
  const docRef = db.collection('users').doc(user.id);
  await docRef.set( user, { merge: true } );
}

export const  getUserLanguage = async( userId: string) => {
  const docRef = db.collection('users').doc(userId);
  try {
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      // The document exists, so get its data
      const userData = docSnap.data();
      return userData?.language || "";
    } else {
      return "";
    }
  } catch (error) {
    console.error("Error getting document:", error);
  }
  return "";
}

export const  saveLanguageToUserProfile = async( userId: string, language: string ) => {
  const docRef = db.collection('users').doc(userId);
  await docRef.update( { language: language } );
}

export const addPlant = async( key: string, plant: any ) => {
  const docRef = db.collection('plants').doc(key);
  await docRef.set( plant );
}


export const getPlant = async ( key: any) => {
  try {
    const snapshot = await db.collection('plants').where("id", "==", key).get();
    if (snapshot.empty) {
      console.log('No matching documents.');
      return [];
    }

    const plants: any = [];
    snapshot.forEach(doc => {
      plants.push({ id: doc.id, ...doc.data() });
    });
    return plants;
  } catch (error) {
    console.error("Got an error:", error);
    return [];
  }
}

