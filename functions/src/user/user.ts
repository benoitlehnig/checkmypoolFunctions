import * as functions from 'firebase-functions'
import {firestoreDB,auth} from '../common/initFirebase'
const sgMail = require('@sendgrid/mail');
const API_KEY = functions.config().sendgrid.key;
sgMail.setApiKey(API_KEY);

const generator = require('generate-password');

export const setSuperAdminDefaultAccount = functions.https.onCall((data:any, context:any) => {
	console.log("setSuperAdminDefaultAccount, ", context.auth.uid, data); 
	return auth.setCustomUserClaims( context.auth.uid, {admin: true, customer:false, employee:false, superAdmin:true, accountId:data}).then(() => {
		console.log("custom claims done")
	});
});


export const sendUserCreationEmail = functions.https.onCall((data:any, context:any) => {
	console.log("sendUserCreationEmail", data, context.auth.token.accountId);
	const password = generator.generate({
		length: 6,
		numbers: true
	});
	const link= "https://checkmypool.net/login";
	const accountId = context.auth.token.accountId;
	console.log("accountId : ", accountId);


	return auth.getUser(data.customer.userRecordUid).then(function(userRecord:any) {
		// See the UserRecord reference doc for the contents of userRecord.
		console.log('Successfully fetched user data test:', userRecord.toJSON(),accountId);

		return auth.updateUser(data.customer.userRecordUid, {password: password}).then(
			function(userRecord2:any){
				console.log("updateUser done ", userRecord2);
				return "OK"
			});

		return firestoreDB.collection('accounts').doc(accountId).get().then((doc:any)=> {
			console.log('reference', doc.data());
			const company = doc.data();
			const msg={
				"personalizations": [
				{
					"to": [
					{
						"email": data.customer.email,
						"name": data.customer.firstName + " "+ data.customer.lastName
					}
					],
					"dynamic_template_data": {
						"url": link,
						"email": data.customer.email,
						"password": password,
						"accountName": company.name,
						"accountLogo":company.configuration.logoPictureUrl,
						"accountId":context.auth.token.accountId
					},
				}
				],
				"from": company.configuration.emailConfiguration.serverEmail.from,
				"reply_to": company.configuration.emailConfiguration.serverEmail.reply_to,
				"template_id": company.configuration.emailConfiguration.emailTemplates.welcomeCustomer
			}
			console.log("send message");
			sgMail.send(msg);	
			return "OK";
		});
	})
	.catch(function(error:any) {
		console.log('Error fetching user data:', error);
	});

});