import * as admin from "firebase-admin"
admin.initializeApp();

export const firestoreDB = admin.firestore()
export const firebaseDB = admin.database()
export const auth = admin.auth()
export const messaging = admin.messaging()
export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;