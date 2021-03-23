import * as functions from 'firebase-functions'
import {firebaseDB,firestoreDB,messaging} from '../common/initFirebase'

const sgMail = require('@sendgrid/mail');
const API_KEY = functions.config().sendgrid.key;
sgMail.setApiKey(API_KEY);

let moment = require('moment');



export const newVisitEvent = functions.database.ref('{accountId}/visits/{visitId}').onCreate(async (snap:any, context:any) => {
	await firebaseDB.ref(context.params.accountId+'/pools/'+snap.val().poolId+'/visits/').push(context.params.visitId).then(
		(reference:any) =>{return reference});

	await firebaseDB.ref(context.params.accountId+'/pools/'+snap.val().poolId+'/numberOfVisits').once("value").then(function(snapshot:any) {
		let numberOfVisits: number = 1;
		if(snapshot.val() !==null){
			numberOfVisits = (snapshot.val())+1;
		}
		return firebaseDB.ref(context.params.accountId+'/pools/'+snap.val().poolId+ '/numberOfVisits').set(numberOfVisits).then(
			(reference:any) =>{return reference});
	})

	await firestoreDB.collection('accounts').doc(context.params.accountId).get().then(async (doc:any)=> {
		console.log('reference', doc.data());
		const company = doc.data();

		let title= "Nouvelle visite effectuee- Tout est OK";
		if(snap.val().generalStatusKO ===true){
			title = "Nouvelle visite effectuee - Nouvelle intervention necessaire, " + company.nameSecondaryVisit +" passera ";
		}

		const payload = {
			notification: {
				title: title,
				body: 'Realisee a '+ moment(snap.val().dateTime).format('DD/MM/YYYY, h:mm:ss a'),
				icon: company.configuration.logoPictureForNotifUrl,
				time_to_live:"600"
			}
		};

		await sendPushNotif(snap.val().customerUid,context.params.accountId,payload).then(
			(reference:any) =>{return reference});

		await firebaseDB.ref(context.params.accountId+'/customers/'+snap.val().customerUid).once("value").then(function(snapshotCustomer:any) {
			console.log("snapshotCustomer :", snapshotCustomer.val())

			const payloadAdmin = {
				notification: {
					title:  'Client : ' + snapshotCustomer.val().firstName + " " +snapshotCustomer.val().lastName ,
					body: 'Realisee a '+ moment(snap.val().dateTime).format('DD/MM/YYYY, h:mm:ss a'),
					icon: company.configuration.logoPictureForNotifUrl,
					time_to_live:"600"
				}
			};
			return firebaseDB.ref(context.params.accountId+'/employees').orderByChild("pushNotifAllVisitSubscription").equalTo(true).once("value").then(async function(snapshot:any) {
				snapshot.forEach(async function(childSnapshot:any) {
					console.log("pushNotifAllVisitSubscription:", childSnapshot.val());
					const adminUid = childSnapshot.key;
					await sendPushNotif(adminUid,context.params.accountId,payloadAdmin).then(
						(reference:any) =>{return reference});
				})
			})

		});
		
		return payload;

	});
	return "OK"
});

async function sendPushNotif(uid:string,accountId:string,payload:any){
	console.log("sendPushNotif",uid,accountId, payload)
	await firebaseDB.ref(accountId+'/devices/'+uid).once("value").then(function(snapshot:any) {
		snapshot.forEach(function(childSnapshot:any) {
			console.log("sendPushNotif token:", childSnapshot.val().token);
			return messaging.sendToDevice( childSnapshot.val().token, payload);
		})
	});
}

export const subscribeAllNewVisits = functions.https.onCall((data:any, context:any) => {
	return firebaseDB.ref(context.auth.token.accountId+'/employees/'+data.uid+'/pushNotifAllVisitSubscription').set(data.status).then(function(snapshot:any) {
		return snapshot
	})

});


export const addVisit = functions.https.onCall( (data:any, context:any) => {
	console.log(JSON.stringify(data), context.auth.token.accountId);
	return firebaseDB.ref(context.auth.token.accountId+'/visits').push(data).then(async (reference:any) => {
		const visit = {'visitId':reference.key, data:data};
		console.log(data);

		await firebaseDB.ref(context.auth.token.accountId+'/pools/'+visit.data.poolId+ '/lastVisitDate').set(visit.data.dateTime);
		await updatePool(visit,context.auth.token.accountId);
		console.log("visit log trace 2", visit);

		await firestoreDB.collection('accounts').doc(context.auth.token.accountId).get().then((doc:any) => {
			console.log('addVisit >> reference', doc.data());
			const account = doc.data();
			if(account.configuration.emailConfiguration.sendEmailAfterVisit ===true){
				console.log("account.configuration.sendEmailAfterVisit ", account.configuration.sendEmailAfterVisit );
				return sendEmailAfterVisit(visit.data.generalStatusKO,visit,context.auth.token.accountId);
			}
			else{
				return "KO"
			}
			console.log('visit : ', visit);

		})
		return { visit:visit};
	});
});

export const updateVisit = functions.https.onCall( (data:any, context:any) => {
	console.log(data);
	return firebaseDB.ref(context.auth.token.accountId+'/visits/'+data.visitId).set(data.value).then( async(reference:any) => {
		console.log(reference)
		const visit = {'visitId':data.visitId, data:data.value};
		await updatePool(visit, context.auth.token.accountId);
	})
});

async function  updatePool(visit:any, accountId:string){
	console.log("visit accountId", visit,accountId)
	console.log("visit log trace 3", visit);


	if(visit.data.maintenance.curtain ===true){
		console.log("visit.data.maintenance.curtain ===true")
		await firebaseDB.ref(accountId+'/pools/'+visit.data.poolId+ '/lastCurtainCleaningDate').set(visit.data.dateTime).then(
			(reference:any) =>{return reference});

	}
	if(visit.data.maintenance.TLCleaningRoom ===true){
		console.log("visit.data.maintenanceTLCleaningRoom ===true")
		await firebaseDB.ref(accountId+'/pools/'+visit.data.poolId+ '/lastTLCleaningDate').set(visit.data.dateTime).then(
			(reference:any) =>{return reference});
	}
	if(visit.data.typeOfVisit === 'maintenance'){
		console.log("visit.data.typeOfVisit ===true")
		await firebaseDB.ref(accountId+'/pools/'+visit.data.poolId+ '/lastMaintenanceDate').set(visit.data.dateTime).then(
			(reference:any) =>{return reference});

	}
	await firebaseDB.ref(accountId+'/pools/'+visit.data.poolId+ '/lastTechnique').set(visit.data.technique).then(
			(reference:any) =>{return reference});
	await firebaseDB.ref(accountId+'/pools/'+visit.data.poolId+ '/lastMaintenance').set({sandfilterPressure: visit.data.maintenance.sandfilterPressure } ).then(
			(reference:any) =>{return reference});

	const statisticsChlore= {
		'date': visit.data.dateTime,
		'value':visit.data.technique.chlore
	};
	const statisticsPH= {
		'date': visit.data.dateTime,
		'value':visit.data.technique.PH
	};
	const statisticsTAC= {
		'date': visit.data.dateTime,
		'value':visit.data.technique.TAC
	};
	const statisticsTemperature= {
		'date': visit.data.dateTime,
		'value':visit.data.technique.waterTemperature
	};
	const statisticsWaterMeter= {
		'date': visit.data.dateTime,
		'value':visit.data.technique.waterMeter
	};
	await firebaseDB.ref(accountId+'/statistics/'+visit.data.poolId+'/chlore').push(statisticsChlore).then(
			(reference:any) =>{return reference});
	await firebaseDB.ref(accountId+'/statistics/'+visit.data.poolId+'/PH').push(statisticsPH).then(
			(reference:any) =>{return reference});
	await firebaseDB.ref(accountId+'/statistics/'+visit.data.poolId+'/temperature').push(statisticsTemperature).then(
			(reference:any) =>{return reference});
	await firebaseDB.ref(accountId+'/statistics/'+visit.data.poolId+'/TAC').push(statisticsTAC).then(
			(reference:any) =>{return reference});
	await firebaseDB.ref(accountId+'/statistics/'+visit.data.poolId+'/waterMeter').push(statisticsWaterMeter).then(
			(reference:any) =>{return reference});
}

function sendEmailAfterVisit(statusKO:boolean,visit:any,accountId:string){
	const link= "https://piscinet-79e4a.web.app/visits/"+visit.visitId;

	console.log("sendEmailAfterVisit : ", visit.data.customerUid);
	return firebaseDB.ref(accountId+'/customers/'+visit.data.customerUid).once("value").then(
		function(snapshot:any) {
			console.log(snapshot.val());
			return firestoreDB.collection('accounts').doc(accountId).get().then((doc:any) => {
				console.log('reference', doc.data());
				const company = doc.data();
				let template_id = company.configuration.emailConfiguration.emailTemplates.visitOK
				if(statusKO===true){
					template_id = company.configuration.emailConfiguration.emailTemplates.visitKO
				}

				const msg={
					"personalizations": [
					{
						"to": [
						{
							"email": snapshot.val().email,
							"name": snapshot.val().firstName + " "+ snapshot.val().lastName
						}
						],
						"dynamic_template_data": {
							"url": link,
							"accountName": company.name,
							"accountLogo":company.configuration.logoPictureUrl,
							"accountId":accountId,
							"accountSecondaryVisitName": company.nameSecondaryVisit
						},
						"subject": "Hello, World!"
					}
					],
					"from": company.configuration.emailConfiguration.serverEmail.from,
					"reply_to": company.configuration.emailConfiguration.serverEmail.reply_to,
					"template_id": template_id
				}
				sgMail.send(msg);	
				return "OK"
			});

		})
}
