import * as functions from 'firebase-functions'
import {firebaseDB,firestoreDB,firebaseStorage} from '../common/initFirebase'


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


export const addPicture = functions.https.onCall((data:any, context:any) => {
	console.log("addPicture>>", JSON.stringify(data));
	return firebaseDB.ref(context.auth.token.accountId+'/pools/'+data.poolId+'/pictures/'+data.picture.filepath).set(data.picture);
});


export const deletePicture = functions.https.onCall((data:any, context:any) => {
	console.log("deletePicture>>", JSON.stringify(data));
	return firebaseDB.ref(context.auth.token.accountId+'/pools/'+data.poolId+'/pictures/'+data.pictureId).remove()
});

export const newPictureUploadEvent = functions.storage.object().onFinalize(async (object) => {
	const filePath = object.name; // File path in the bucket.
	const mediaLink = object.mediaLink; // Number of times metadata has been generated. New objects have a value of 1.
	const selfLink = object.selfLink; // Number of times metadata has been generated. New objects have a value of 1.
	console.log("filePath",filePath,"mediaLink",mediaLink, "selfLink",selfLink);
	if(filePath!==undefined){
		if(filePath.indexOf("_200x200" ) !==-1){
		const bucket = firebaseStorage.bucket();
		const file = bucket.file(filePath);
		return file.getSignedUrl({
			action: 'read',
			expires: '03-09-2491'
		}).then(signedUrls => {
			// signedUrls[0] contains the file's public URL
			console.log("signedUrls",signedUrls)
			const accountId=filePath.split("/")[0];
		const poolId=filePath.split("/")[2];
		const pictureId=filePath.split("/")[4];
		const picture = {
			name:"",
			type:"",
			url:signedUrls[0] ,
			dateTime:object.timeCreated,
			filepath:pictureId
		}

		return firebaseDB.ref(accountId+'/pools/'+poolId+'/pictures/'+pictureId).set(picture);
		});
	}
	}

});
export const deletePictureEvent = functions.database.ref('{accountId}/pools/{poolId}/pictures/{pictureId}').onDelete((data:any, context:any) => {
	//	console.log("onDeletePicture>>", JSON.stringify(data));
	const accountId=  context.params.accountId;
	const poolId=  context.params.poolId;
	const pictureId=  context.params.pictureId;
	const filepath = accountId+'/pools/'+poolId+'/pictures/'+pictureId;
	console.log("deletePictureEvent",accountId,poolId,pictureId,accountId+'/pools/'+poolId+'/pictures/'+pictureId )
	const bucket = firebaseStorage.bucket();
	return bucket.file(filepath).delete()


});


