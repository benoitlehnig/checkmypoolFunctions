import * as functions from 'firebase-functions'
import {firebaseDB} from '../common/initFirebase'

export const addMessage = functions.https.onCall((data:any, context:any) => {
	console.log("addContactRequest ", data)
	return firebaseDB.ref(context.auth.token.accountId+'/messages/'+ context.auth.uid).push(data).then((reference:any) => {
		return { message: data};
	});
});


export const newMessageEvent = functions.database.ref('{accountId}/messages/{customerId}/{messageId}/').onCreate( (snap:any, context:any) => {
	const accountId=  context.params.accountId;
	const customerId=  context.params.customerId;
	const message = snap.val();
	if(message.reason === 0){
		return firebaseDB.ref(accountId+'/customers/').orderByChild("userRecordUid").equalTo(customerId).once("value").then(function(snapshot:any) {
			console.log(" customer found :", snapshot.val(), snapshot.key );
			snapshot.forEach(function(snapshotChildren:any) {
				return firebaseDB.ref(accountId+'/customers/'+snapshotChildren.key +'/nextComeBack').set(snap.val()).then((reference:any) => {
					console.log(reference)
				})
			})
		})
	}
	else{
		throw new functions.https.HttpsError("unknown", "error : ");

	}
});