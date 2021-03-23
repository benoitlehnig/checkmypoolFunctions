import * as functions from 'firebase-functions'
import {firebaseDB,auth} from '../common/initFirebase'

const generator = require('generate-password');


export const addEmployee = functions.https.onCall((data:any, context:any) => {
	const password = generator.generate({
		length: 6,
		numbers: true
	});
	console.log("addEmployee, ", password);
	return auth.createUser({
		email: data.email,
		emailVerified: false,
		password: password,
		displayName: data.firstName +' '+data.lastName,
		disabled: false	})
	.then(async function(userRecord:any) {
		await auth.setCustomUserClaims( userRecord.uid, {admin: false, customer:false, employee:true,accountId:context.auth.token.accountId}).then(() => {
			return "OK"
		});
		return firebaseDB.ref(context.auth.token.accountId+'/employees').child(userRecord.uid).set(data).then((reference:any) => {
			return { key: userRecord.uid, employee: data};
		})
	})
});

export const updateEmployee = functions.https.onCall((data:any, context:any) => {
	console.log(data);
	return firebaseDB.ref(context.auth.token.accountId+'/employees/'+data.uid).set(data.value).then((reference:any) => {
		return { key: data.uid, employee: data.value};
	})
});

export const deleteEmployee = functions.https.onCall((data:any, context:any) => {
	console.log(data);
	return firebaseDB.ref(context.auth.token.accountId+'/employees/'+data).remove().then(async function() {		
		await auth.deleteUser(data).then(function() {
			console.log('Successfully deleted user');
			return {data};
		})
		.catch(function(error:string) {
			console.log('Error deleting user:', error);
		});

	})
});

export const setAdmin = functions.https.onCall((data:any, context:any) => {
	console.log(data);
	return auth.setCustomUserClaims( data, {admin: true, customer:false, employee:false,accountId:context.auth.token.accountId}).then(() => {
		return firebaseDB.ref(context.auth.token.accountId+'/employees/'+data+'/admin').set(true).then((reference:any) => {
			console.log("setAdmin true");
			return reference
		});
	});
});

export const addAdmin = functions.https.onCall((data:any, context:any) => {
	const password = generator.generate({
		length: 6,
		numbers: true
	});
	return auth.createUser({
		email: data.employee.email,
		emailVerified: false,
		password: password,
		displayName: data.employee.firstName +' '+data.employee.lastName,
		disabled: false	})
	.then(async function(userRecord:any) {
		await auth.setCustomUserClaims( userRecord.uid, {admin: false, customer:false, employee:true, accountId:data.accountId}).then(() => {
			console.log("custom claims done")
			// The new custom claims will propagate to the user's ID token the
			// next time a new one is issued.
		});
		return firebaseDB.ref(data.accountId+'/employees').child(userRecord.uid).set(data.employee).then((reference:any) => {
			return { key: userRecord.uid, admin: data.employee};
		})
	})
});


