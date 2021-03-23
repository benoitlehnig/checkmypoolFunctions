import * as functions from 'firebase-functions'
import {firestoreDB} from '../common/initFirebase'
const sgMail = require('@sendgrid/mail');
const API_KEY = functions.config().sendgrid.key;
sgMail.setApiKey(API_KEY);

export const addAccount = functions.https.onCall((data:any, context:any) => {
	console.log("addAccount ",data );
	return firestoreDB.collection("accounts").add(data).then(function(docRef:any){
		return docRef;
	});
});

export const updateAccount = functions.https.onCall((data:any, context:any) => {
	console.log("updateAccount ",data );
	return firestoreDB.collection("accounts").doc(data.accountId).set(data.value).then(function(docRef:any){
		return 'OK';
	});
});

export const deleteAccount = functions.https.onCall((data:any, context:any) => {
	console.log("deleteAccount ",data );
	return firestoreDB.collection("accounts").doc(data.accountId).delete().then(function(docRef:any){
		return 'OK';
	});
});


export const newAccountRequest = functions.https.onCall((data:any, context:any) => {
	console.log("newAccountRequest, ", data); 
	const msg={
		"personalizations": [
		{
			"to": [
			{
				"email":"contact@checkmypool.net",
				"name":"checkmypool"
			}
			],
			"dynamic_template_data": {
				"data": data
			},
			"subject": "New Request ! "
		}
		],
		"from": "contact@checkmypool.net",
		"reply_to": "contact@checkmypool.net",
		"template_id": "d-6d666f5cd0a1489bbd2e147b6a710d86"
	}
	sgMail.send(msg);	
	return null
});