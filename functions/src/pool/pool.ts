import * as functions from 'firebase-functions'
import {firebaseDB,firestoreDB} from '../common/initFirebase'


export const addSwimmingPool = functions.https.onCall((data:any, context:any) => {
	return firestoreDB.collection('accounts').doc(context.auth.token.accountId).get().then((doc:any) => {
		console.log('reference', doc.data());
		const company = doc.data();
		console.log(company);
		if(company.plan ==='free' && company.numberOfSwimmingPools >= 5){
			throw new functions.https.HttpsError('invalid-argument', 'free_plan');
		}
		else{
			return firebaseDB.ref(context.auth.token.accountId+'/pools').push(data).then((reference:any) => {
				return { swimmingPool: data};
			})
		}
	})

});
export const updateSwimmingPool = functions.https.onCall((data:any, context:any) => {
	console.log(data);
	return firebaseDB.ref(context.auth.token.accountId+'/pools/'+data.poolId).set(data.value).then((reference:any) => {
		return reference
	})
});

export const newSwimmingPoolEvent = functions.database.ref('{accountId}/pools/{poolId}').onCreate( (snap:any, context:any) => {
	console.log("newSwimmingPoolEvent");
	const accountId=  context.params.accountId;
	return firebaseDB.ref(accountId+'/pools').once("value").then(function(snapshot:any) {
		return firestoreDB.collection('accounts').doc(context.params.accountId).update({'numberOfSwimmingPools':snapshot.numChildren()}).then(
			(reference:any) => {return reference})
	})

});
export const deleteSwimmingPoolEvent = functions.database.ref('{accountId}/pools/{poolId}').onDelete( (snap:any, context:any) => {
	const accountId=  context.params.accountId;
	console.log("deleteSwimmingPoolEvent");
	return firebaseDB.ref(accountId+'/pools').once("value").then(function(snapshot:any) {
		return firestoreDB.collection('accounts').doc(context.params.accountId).update({'numberOfSwimmingPools':snapshot.numChildren()}).then(
			(reference:any) => {return reference})
	})
});
