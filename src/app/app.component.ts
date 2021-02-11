import { Component } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { auth } from 'firebase/app';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent {


	constructor(public auth: AngularFireAuth) {
		//todo
	}
	login() {
		this.auth.signInWithPopup(new auth.GoogleAuthProvider());
	}
	logout() {
		this.auth.signOut();
	}
}
