import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { AngularFireModule } from '@angular/fire';
import { AngularFireAuthModule } from '@angular/fire/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDlxLFrPSn02TG8TRQSwT_q4Fx_x7x0y6I",
  authDomain: "piscinet-79e4a.firebaseapp.com",
  databaseURL: "https://piscinet-79e4a.firebaseio.com",
  projectId: "piscinet-79e4a",
  storageBucket: "piscinet-79e4a.appspot.com",
  messagingSenderId: "412940409175",
  appId: "1:412940409175:web:da62771b749df1516d4612",
  measurementId: "G-YELLZ9SMBP"
};

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    AngularFireModule.initializeApp(firebaseConfig),
    AngularFireAuthModule

  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
