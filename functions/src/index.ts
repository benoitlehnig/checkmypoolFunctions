// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const API_KEY = functions.config().sendgrid.key;
sgMail.setApiKey(API_KEY);

let generator = require('generate-password');
let moment = require('moment');
require('moment/locale/fr');
moment.locale('fr');

admin.initializeApp();

exports.sendUserCreationEmail = functions.https.onCall((data:any, context:any) => {
	console.log("sendUserCreationEmail", data, context.auth.token.accountId);
	const password = generator.generate({
		length: 6,
		numbers: true
	});
	const link= "https://piscinet-79e4a.web.app/login";
	const accountId = context.auth.token.accountId;
	console.log("accountId : ", accountId);


	admin.auth().getUser(data.customer.userRecordUid).then(function(userRecord:any) {
		// See the UserRecord reference doc for the contents of userRecord.
		console.log('Successfully fetched user data test:', userRecord.toJSON(),accountId);

		admin.auth().updateUser(data.customer.userRecordUid, {password: password}).then(
			function(userRecord2:any){
				console.log("updateUser done ", userRecord2);
			});

		admin.firestore().collection('accounts').doc(accountId).get().then((doc:any)=> {
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
			return null;
		});
	})
	.catch(function(error:any) {
		console.log('Error fetching user data:', error);
	});

});

exports.addCustomer = functions.https.onCall((data:any, context:any) => {
	console.log("add customer context.auth.token.accountId: ", context.auth.token.accountId);
	return admin.database().ref(context.auth.token.accountId+'/customers').push(data).then((reference:any) => {
		return { key: reference.key, customer: data};
	});
});
exports.activateCustomer = functions.https.onCall((data:any, context:any) => {
	console.log("activateCustomer context.auth.token.accountId: ", context.auth.token.accountId);
	console.log("activateCustomer data ", data);
	const password = generator.generate({
		length: 6,
		numbers: true
	});

	return admin.auth().createUser({
		email: data.customer.email,
		emailVerified: false,
		password: password,
		displayName: data.customer.firstName +' '+data.customer.lastName,
		disabled: false	})
	.then(function(userRecord:any) {
		admin.auth().setCustomUserClaims( userRecord.uid, {admin: false, customer:true, employee:false, accountId:context.auth.token.accountId});
		console.log(userRecord);
		return admin.database().ref(context.auth.token.accountId+'/customers/'+data.uid+'/userRecordUid').set(userRecord.uid).then((reference:any) => {
			console.log("ref, " ,userRecord.uid)
			return { key: userRecord.uid, customer: data};
		})
	})
	.catch(function(error:any) {
		console.log('Error fetching user data:', error);
		if(error.code === 'auth/email-already-exists'){
			return admin.auth().getUserByEmail(data.customer.email).then(function(userRecord:any) {
				admin.auth().setCustomUserClaims( userRecord.uid, {admin: false, customer:true, employee:false, accountId:context.auth.token.accountId}).then(() => {
					// The new custom claims will propagate to the user's ID token the
					// next time a new one is issued.
				});
				return admin.database().ref(context.auth.token.accountId+'/customers'+data.uid+'/userRecordUid').set(userRecord.uid).then((reference:any) => {
					return { key: userRecord.uid, customer: data};
				})
			})
		}
	});
});


exports.updateCustomer = functions.https.onCall((data:any, context:any) => {
	console.log("updateCustomer data : ", data);
	console.log("updateCustomer context: ", context);
	console.log("addCustomer context.auth.token.admin: ", context.auth.token.admin);

	return admin.database().ref(context.auth.token.accountId+'/customers/'+data.uid).set(data.value).then((reference:any) => {
		return { key: data.uid, customer: data.value};
	})
});

exports.deleteCustomer = functions.https.onCall((data:any, context:any) => {
	console.log(data);
	return admin.database().ref(context.auth.token.accountId+'/customers/'+data.uid).remove().then(function() {
		console.log("starting deleting pools, : ", data.uid)
		admin.database().ref(context.auth.token.accountId+"/pools").orderByChild("customerUid").equalTo(data.uid).on("value", function(snapshot:any) {
			snapshot.forEach(function(snap:any) {
				admin.database().ref(context.auth.token.accountId+'/pools/'+ snap.key).remove()
				admin.database().ref(context.auth.token.accountId+'/statistics/'+ snap.key).remove()
			});
		});
		admin.database().ref(context.auth.token.accountId+"/visits").orderByChild(context.auth.token.accountId+"/customerUid").equalTo(data.uid).on("value", function(snapshot:any) {
			snapshot.forEach(function(snap:any) {
				admin.database().ref(context.auth.token.accountId+'/visits/'+ snap.key).remove()
			});

		});
		if(data.customer.userRecordUid){
			admin.auth().deleteUser(data.customer.userRecordUid).then(function() {
				console.log('Successfully deleted user');
				return {data};
			})
			.catch(function(error:string) {
				console.log('Error deleting user:', error);
			});
		}
		
	})
});


exports.addEmployee = functions.https.onCall((data:any, context:any) => {
	const password = generator.generate({
		length: 6,
		numbers: true
	});
	console.log("addEmployee, ", password);
	return admin.auth().createUser({
		email: data.email,
		emailVerified: false,
		password: password,
		displayName: data.firstName +' '+data.lastName,
		disabled: false	})
	.then(function(userRecord:any) {
		admin.auth().setCustomUserClaims( userRecord.uid, {admin: false, customer:false, employee:true,accountId:context.auth.token.accountId}).then(() => {
			// The new custom claims will propagate to the user's ID token the
			// next time a new one is issued.
		});
		return admin.database().ref(context.auth.token.accountId+'/employees').child(userRecord.uid).set(data).then((reference:any) => {
			return { key: userRecord.uid, employee: data};
		})
	})
});

exports.updateEmployee = functions.https.onCall((data:any, context:any) => {
	console.log(data);
	return admin.database().ref(context.auth.token.accountId+'/employees/'+data.uid).set(data.value).then((reference:any) => {
		return { key: data.uid, employee: data.value};
	})
});

exports.deleteEmployee = functions.https.onCall((data:any, context:any) => {
	console.log(data);
	return admin.database().ref(context.auth.token.accountId+'/employees/'+data).remove().then(function() {		

		admin.auth().deleteUser(data).then(function() {
			console.log('Successfully deleted user');
			return {data};
		})
		.catch(function(error:string) {
			console.log('Error deleting user:', error);
		});

	})
});
exports.addSwimmingPool = functions.https.onCall((data:any, context:any) => {
	return admin.firestore().collection('accounts').doc(context.auth.token.accountId).get().then((doc:any) => {
		console.log('reference', doc.data());
		const company = doc.data();
		console.log(company);
		if(company.plan ==='free' && company.numberOfSwimmingPools >= 5){
			throw new functions.https.HttpsError('invalid-argument', 'free_plan');
		}
		else{
			return admin.database().ref(context.auth.token.accountId+'/pools').push(data).then((reference:any) => {
				return { swimmingPool: data};
			})
		}
	})

});
exports.updateSwimmingPool = functions.https.onCall((data:any, context:any) => {
	console.log(data);
	return admin.database().ref(context.auth.token.accountId+'/pools/'+data.poolId).set(data.value).then((reference:any) => {
		console.log(reference)
	})
});

exports.newSwimmingPoolEvent = functions.database.ref('{accountId}/pools/{poolId}').onCreate( (snap:any, context:any) => {
	console.log("newSwimmingPoolEvent");
	const accountId=  context.params.accountId;
	return admin.database().ref(accountId+'/pools').once("value").then(function(snapshot:any) {
		console.log("newSwimmingPoolEvent, ",snapshot.numChildren() );

		return admin.firestore().collection('accounts').doc(context.params.accountId).update({'numberOfSwimmingPools':snapshot.numChildren()})
	})

});
exports.deleteSwimmingPoolEvent = functions.database.ref('{accountId}/pools/{poolId}').onDelete( (snap:any, context:any) => {
	const accountId=  context.params.accountId;
	console.log("deleteSwimmingPoolEvent");
	return admin.database().ref(accountId+'/pools').once("value").then(function(snapshot:any) {
		console.log("deleteSwimmingPoolEvent, ",snapshot.numChildren() );
		return admin.firestore().collection('accounts').doc(context.params.accountId).update({'numberOfSwimmingPools':snapshot.numChildren()})
	})
});



exports.newVisitEvent = functions.database.ref('{accountId}/visits/{visitId}')
.onCreate( (snap:any, context:any) => {

	admin.database().ref(context.params.accountId+'/pools/'+snap.val().poolId+'/visits/').push(context.params.visitId);

	admin.database().ref(context.params.accountId+'/pools/'+snap.val().poolId+'/numberOfVisits').once("value").then(function(snapshot:any) {
		let numberOfVisits: number = 1;
		if(snapshot.val() !==null){
			numberOfVisits = (snapshot.val())+1;
		}
		admin.database().ref(context.params.accountId+'/pools/'+snap.val().poolId+ '/numberOfVisits').set(numberOfVisits);
	})

	admin.firestore().collection('accounts').doc(context.params.accountId).get().then((doc:any)=> {
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

		sendPushNotif(snap.val().customerUid,context.params.accountId,payload);

		admin.database().ref(context.params.accountId+'/customers/'+snap.val().customerUid).once("value").then(function(snapshotCustomer:any) {
			console.log("snapshotCustomer :", snapshotCustomer.val())

			const payloadAdmin = {
				notification: {
					title:  'Client : ' + snapshotCustomer.val().firstName + " " +snapshotCustomer.val().lastName ,
					body: 'Realisee a '+ moment(snap.val().dateTime).format('DD/MM/YYYY, h:mm:ss a'),
					icon: company.configuration.logoPictureForNotifUrl,
					time_to_live:"600"
				}
			};
			admin.database().ref(context.params.accountId+'/employees').orderByChild("pushNotifAllVisitSubscription").equalTo(true).once("value").then(function(snapshot:any) {
				snapshot.forEach(function(childSnapshot:any) {
					console.log("pushNotifAllVisitSubscription:", childSnapshot.val());
					const adminUid = childSnapshot.key;
					sendPushNotif(adminUid,context.params.accountId,payloadAdmin);
				})
			})

		});
		
		return payload;

	});
	return "OK"
});

function sendPushNotif(uid:string,accountId:string,payload:any){
	console.log("sendPushNotif",uid,accountId, payload)
	admin.database().ref(accountId+'/devices/'+uid).once("value").then(function(snapshot:any) {
		snapshot.forEach(function(childSnapshot:any) {
			console.log("sendPushNotif token:", childSnapshot.val().token);
			admin.messaging().sendToDevice( childSnapshot.val().token, payload);
		})
	});
}

exports.subscribeAllNewVisits = functions.https.onCall((data:any, context:any) => {
	return admin.database().ref(context.auth.token.accountId+'/employees/'+data.uid+'/pushNotifAllVisitSubscription').set(data.status).then(function(snapshot:any) {
		return snapshot
	})

});


exports.addVisit = functions.https.onCall((data:any, context:any) => {
	console.log(data);
	return admin.database().ref(context.auth.token.accountId+'/visits').push(data).then((reference:any) => {
		const visit = {'visitId':reference.key, data:data};

		admin.database().ref(context.auth.token.accountId+'/pools/'+visit.data.poolId+ '/lastVisitDate').set(visit.data.dateTime);
		updatePool(visit,context.auth.token.accountId);
		console.log("visit log trace 2", visit);

		admin.firestore().collection('accounts').doc(context.auth.token.accountId).get().then((doc:any) => {
			console.log('addVisit >> reference', doc.data());
			const account = doc.data();
			if(account.configuration.emailConfiguration.sendEmailAfterVisit ===true){
				console.log("account.configuration.sendEmailAfterVisit ", account.configuration.sendEmailAfterVisit );
				sendEmailAfterVisit(visit.data.generalStatusKO,visit,context.auth.token.accountId);
			}
			console.log('visit : ', visit);

		})
		return { visit:visit};
	});
});

exports.updateVisit = functions.https.onCall((data:any, context:any) => {
	console.log(data);
	return admin.database().ref(context.auth.token.accountId+'/visits/'+data.visitId).set(data.value).then((reference:any) => {
		console.log(reference)
		const visit = {'visitId':data.visitId, data:data.value};
		updatePool(visit, context.auth.token.accountId);
	})
});
exports.setAdmin = functions.https.onCall((data:any, context:any) => {
	console.log(data);
	admin.auth().setCustomUserClaims( data, {admin: true, customer:false, employee:false,accountId:context.auth.token.accountId}).then(() => {
		admin.database().ref(context.auth.token.accountId+'/employees/'+data+'/admin').set(true).then((reference:any) => {
			console.log("setAdmin true")
		});
	});
});

exports.addDevice = functions.https.onCall((data:any, context:any) => {
	const device = {'token':data.token};
	return admin.database().ref(context.auth.token.accountId+'/devices/'+data.uid).orderByChild("token").equalTo(data.token).once("value").then(function(snapshot:any) {
		console.log(snapshot.val());
		if(snapshot.val() ===null){
			return admin.database().ref(context.auth.token.accountId+'/devices/'+data.uid).push(device).then((reference:any) => {
				return { device: device};
			})
		}
	});
});
exports.removeDevices = functions.https.onCall((data:any, context:any) => {
	const device = {'token':data.token};
	return admin.database().ref(context.auth.token.accountId+'/devices/'+data.uid).orderByChild("token").equalTo(data.token).once("value").then(function(snapshot:any) {
		console.log(snapshot.val());
		if(snapshot.val() ===null){
			return admin.database().ref(context.auth.token.accountId+'/devices/'+data.uid).push(device).then((reference:any) => {
				return { device: device};
			})
		}
	});
});


function updatePool(visit:any, accountId:string){
	console.log("visit accountId", visit,accountId)
	console.log("visit log trace 3", visit);


	if(visit.data.maintenance.curtain ===true){
		console.log("visit.data.maintenance.curtain ===true")
		admin.database().ref(accountId+'/pools/'+visit.data.poolId+ '/lastCurtainCleaningDate').set(visit.data.dateTime);
	}
	if(visit.data.maintenance.TLCleaningRoom ===true){
		console.log("visit.data.maintenanceTLCleaningRoom ===true")
		admin.database().ref(accountId+'/pools/'+visit.data.poolId+ '/lastTLCleaningDate').set(visit.data.dateTime);
	}
	if(visit.data.typeOfVisit === 'maintenance'){
		console.log("visit.data.typeOfVisit ===true")
		admin.database().ref(accountId+'/pools/'+visit.data.poolId+ '/lastMaintenanceDate').set(visit.data.dateTime);

	}
	admin.database().ref(accountId+'/pools/'+visit.data.poolId+ '/lastTechnique').set(visit.data.technique);
	admin.database().ref(accountId+'/pools/'+visit.data.poolId+ '/lastMaintenance').set({sandfilterPressure: visit.data.maintenance.sandfilterPressure } );

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
	admin.database().ref(accountId+'/statistics/'+visit.data.poolId+'/chlore').push(statisticsChlore);
	admin.database().ref(accountId+'/statistics/'+visit.data.poolId+'/PH').push(statisticsPH);
	admin.database().ref(accountId+'/statistics/'+visit.data.poolId+'/temperature').push(statisticsTemperature);
	admin.database().ref(accountId+'/statistics/'+visit.data.poolId+'/TAC').push(statisticsTAC);
}

function sendEmailAfterVisit(statusKO:boolean,visit:any,accountId:string){
	const link= "https://piscinet-79e4a.web.app/visits/"+visit.visitId;

	console.log("sendEmailAfterVisit : ", visit.data.customerUid);
	admin.database().ref(accountId+'/customers/'+visit.data.customerUid).once("value").then(
		function(snapshot:any) {
			console.log(snapshot.val());
			admin.firestore().collection('accounts').doc(accountId).get().then((doc:any) => {
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
			});

		})
}


exports.addAccount = functions.https.onCall((data:any, context:any) => {
	console.log("addAccount ",data );
	return admin.firestore().collection("accounts").add(data).then(function(docRef:any){
		return docRef;
	});
});

exports.updateAccount = functions.https.onCall((data:any, context:any) => {
	console.log("updateAccount ",data );
	return admin.firestore().collection("accounts").doc(data.accountId).set(data.value).then(function(docRef:any){
		return 'OK';
	});
});

exports.deleteAccount = functions.https.onCall((data:any, context:any) => {
	console.log("deleteAccount ",data );
});

exports.setSuperAdmin = functions.https.onCall((data:any, context:any) => {
	console.log("setSuperAdmin, ",  context.auth.uid); 
	admin.auth().setCustomUserClaims( context.auth.uid, {admin: true, customer:true, employee:false,superAdmin:true}).then(() => {
		console.log("set super ADmin")
	});

});

exports.addAdmin = functions.https.onCall((data:any, context:any) => {
	const password = generator.generate({
		length: 6,
		numbers: true
	});
	return admin.auth().createUser({
		email: data.employee.email,
		emailVerified: false,
		password: password,
		displayName: data.employee.firstName +' '+data.employee.lastName,
		disabled: false	})
	.then(function(userRecord:any) {
		admin.auth().setCustomUserClaims( userRecord.uid, {admin: false, customer:false, employee:true, accountId:data.accountId}).then(() => {
			console.log("custom claims done")
			// The new custom claims will propagate to the user's ID token the
			// next time a new one is issued.
		});
		return admin.database().ref(data.accountId+'/employees').child(userRecord.uid).set(data.employee).then((reference:any) => {
			return { key: userRecord.uid, admin: data.employee};
		})
	})
});
exports.setSuperAdminDefaultAccount = functions.https.onCall((data:any, context:any) => {
	console.log("setSuperAdminDefaultAccount, ", context.auth.uid, data); 
	admin.auth().setCustomUserClaims( context.auth.uid, {admin: true, customer:false, employee:false, superAdmin:true, accountId:data}).then(() => {
		console.log("custom claims done")
	});
});

exports.newAccountRequest = functions.https.onCall((data:any, context:any) => {
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


exports.addMessage = functions.https.onCall((data:any, context:any) => {
	console.log("addContactRequest ", data)
	return admin.database().ref(context.auth.token.accountId+'/messages/'+ context.auth.uid).push(data).then((reference:any) => {
		console.log("messages: " , data);
		return { message: data};
	});
});


exports.newMessageEvent = functions.database.ref('{accountId}/messages/{customerId}/{messageId}/').onCreate( (snap:any, context:any) => {
	const accountId=  context.params.accountId;
	const customerId=  context.params.customerId;
	const messageId=  context.params.messageId;
	const message = snap.val();
	console.log("context.params: ", context.params);
	console.log("message: ",  accountId, customerId, messageId, snap.val());

	if(message.reason === 0){
		admin.database().ref(accountId+'/customers/').orderByChild("userRecordUid").equalTo(customerId).once("value").then(function(snapshot:any) {
			console.log(" customer found :", snapshot.val(), snapshot.key );
			snapshot.forEach(function(snapshotChildren:any) {
				return admin.database().ref(accountId+'/customers/'+snapshotChildren.key +'/nextComeBack').set(snap.val()).then((reference:any) => {
					console.log(reference)
				})
			})
		})
		
	}
});