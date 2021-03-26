import * as functions from 'firebase-functions'
import {firestoreDB, firebaseDB,auth} from '../common/initFirebase'

const sgMail = require('@sendgrid/mail');
const API_KEY = functions.config().sendgrid.key;
sgMail.setApiKey(API_KEY);
const generator = require('generate-password');

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

export const createSelfAccount = functions.https.onCall((data:any, context:any) => {
	console.log("createSelfAccount ",JSON.stringify(data) );
	return firestoreDB.collection("accounts").add(data.account).then(async function(docRef:any){
		console.log("docRef,", docRef.id);
		await activateAccount(docRef.id, data.admin		)
		return docRef;
	});
});

function activateAccount(accountId:any,data:any){
	console.log("activateAccount ", accountId);
	console.log("activateAccount data ", data);
	const password = generator.generate({
		length: 6,
		numbers: true
	});

	return auth.createUser({
		email: data.email,
		emailVerified: false,
		password: password,
		displayName: data.firstName +' '+data.lastName,
		disabled: false	})
	.then(async function(userRecord:any) {
		await auth.setCustomUserClaims( userRecord.uid, {admin: true, customer:false, employee:true, accountId:accountId}).then(
			(claims:any)=>{return "OK"})
		console.log("userRecord",userRecord.uid,data );
		await firebaseDB.ref(accountId+'/employees/'+userRecord.uid+'/admin').set(true).then((reference:any) => {
			console.log("setAdmin true");
			return reference
		});
		return firebaseDB.ref(accountId+'/employees').child(userRecord.uid).set(data).then((reference:any) => {
			return { key: userRecord.uid, employee: data};
		})
	})
	.catch( function(error:any) {
		console.log('Error fetching user data:', error);
		throw new functions.https.HttpsError("unknown", "error : "+ error);

	});
}



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