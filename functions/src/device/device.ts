import * as functions from 'firebase-functions'
import {firebaseDB} from '../common/initFirebase'

export const addDevice = functions.https.onCall((data:any, context:any) => {
	const device = {'token':data.token};
	return firebaseDB.ref(context.auth.token.accountId+'/devices/'+data.uid).orderByChild("token").equalTo(data.token).once("value").then(function(snapshot:any) {
		console.log(snapshot.val());
		if(snapshot.val() ===null){
			return firebaseDB.ref(context.auth.token.accountId+'/devices/'+data.uid).push(device).then((reference:any) => {
				return { device: device};
			})
		}
		else{
			throw new functions.https.HttpsError("unknown", "error : ");

		}
	});
});
export const removeDevices = functions.https.onCall((data:any, context:any) => {
	const device = {'token':data.token};
	return firebaseDB.ref(context.auth.token.accountId+'/devices/'+data.uid).orderByChild("token").equalTo(data.token).once("value").then(function(snapshot:any) {
		console.log(snapshot.val());
		if(snapshot.val() ===null){
			return firebaseDB.ref(context.auth.token.accountId+'/devices/'+data.uid).push(device).then((reference:any) => {
				return { device: device};
			})
		}
		else{
			throw new functions.https.HttpsError("unknown", "error : ");

		}

	});
});

