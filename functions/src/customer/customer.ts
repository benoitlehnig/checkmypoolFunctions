import * as functions from 'firebase-functions'
import {firebaseDB,auth} from '../common/initFirebase'

const generator = require('generate-password');

export const addCustomer = functions.https.onCall((data:any, context:any) => {
	console.log("add customer context.auth.token.accountId: ", context.auth.token.accountId);
	return firebaseDB.ref(context.auth.token.accountId+'/customers').push(data).then((reference:any) => {
		return { key: reference.key, customer: data};
	});
});

export const activateCustomer = functions.https.onCall((data:any, context:any) => {
	console.log("activateCustomer context.auth.token.accountId: ", context.auth.token.accountId);
	console.log("activateCustomer data ", data);
	const password = generator.generate({
		length: 6,
		numbers: true
	});

	return auth.createUser({
		email: data.customer.email,
		emailVerified: false,
		password: password,
		displayName: data.customer.firstName +' '+data.customer.lastName,
		disabled: false	})
	.then(async function(userRecord:any) {
		await auth.setCustomUserClaims( userRecord.uid, {admin: false, customer:true, employee:false, accountId:context.auth.token.accountId}).then(
			(claims:any)=>{return "OK"})
		console.log(userRecord);
		return firebaseDB.ref(context.auth.token.accountId+'/customers/'+data.uid+'/userRecordUid').set(userRecord.uid).then((reference:any) => {
			console.log("ref, " ,userRecord.uid)
			return { key: userRecord.uid, customer: data};
		})
	})
	.catch( function(error:any) {
		console.log('Error fetching user data:', error);
		if(error.code === 'auth/email-already-exists'){
			return auth.getUserByEmail(data.customer.email).then( async function(userRecord:any) {
				await auth.setCustomUserClaims( userRecord.uid, {admin: false, customer:true, employee:false, accountId:context.auth.token.accountId}).then(() => {
					// The new custom claims will propagate to the user's ID token the
					// next time a new one is issued.
				});
				return firebaseDB.ref(context.auth.token.accountId+'/customers'+data.uid+'/userRecordUid').set(userRecord.uid).then((reference:any) => {
					return { key: userRecord.uid, customer: data};
				})
			})
		}
		else{
			throw new functions.https.HttpsError("unknown", "error : "+ error);

		}
	});
});


export const updateCustomer = functions.https.onCall((data:any, context:any) => {
	console.log("updateCustomer data : ", data);
	console.log("updateCustomer context: ", context);
	console.log("updateCustomer context.auth.token.admin: ", context.auth.token.admin);

	return firebaseDB.ref(context.auth.token.accountId+'/customers/'+data.uid).set(data.value).then((reference:any) => {
		return { key: data.uid, customer: data.value};
	})
});

export const deleteCustomer = functions.https.onCall((data:any, context:any) => {
	console.log(data);
	return firebaseDB.ref(context.auth.token.accountId+'/customers/'+data.uid).remove().then(async function() {
		console.log("starting deleting pools, : ", data.uid)
		await firebaseDB.ref(context.auth.token.accountId+"/pools").orderByChild("customerUid").equalTo(data.uid).on("value", function(snapshot:any) {
			snapshot.forEach(async function(snap:any) {
				await firebaseDB.ref(context.auth.token.accountId+'/pools/'+ snap.key).remove()
				await firebaseDB.ref(context.auth.token.accountId+'/statistics/'+ snap.key).remove()
			});
		});
		await firebaseDB.ref(context.auth.token.accountId+"/visits").orderByChild(context.auth.token.accountId+"/customerUid").equalTo(data.uid).on("value", function(snapshot:any) {
			snapshot.forEach(async function(snap:any) {
				await firebaseDB.ref(context.auth.token.accountId+'/visits/'+ snap.key).remove()
			});

		});
		if(data.customer.userRecordUid){
			await auth.deleteUser(data.customer.userRecordUid).then(function() {
				console.log('Successfully deleted user');
				return {data};
			})
			.catch(function(error:string) {
				console.log('Error deleting user:', error);
			});
		}
		
	})
});
