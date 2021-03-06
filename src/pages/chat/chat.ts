import { 
  Component,
  ViewChild
  } from '@angular/core';

import { DatePipe } from '@angular/common';

import { 
  IonicPage, 
  NavController, 
  LoadingController,
  Loading,
  NavParams,
  ModalController,
  Modal,
  ToastController,
  AlertController,
  Platform
} from 'ionic-angular';

import { Subscription } from 'rxjs';

import { Keyboard } from '@ionic-native/keyboard';

import { TranslateService } from "@ngx-translate/core";

import { ChatEditPage } from '../chat-edit/chat-edit';
import { ProfilePage } from '../profile/profile';

import { AppStateProvider } from "../../providers/app-state/app-state";
import { AppPersistenceProvider } from './../../providers/app-persistence/app-persistence';

import { ApiProvider, Chat, Message } from '../../providers/api/api';

/**
 * The Page where all the Chat Stuff happens.
 *
 * See https://angular-meteor.com/tutorials/whatsapp2/ionic/messages-page 
 * for some inspiration for the UI if needed.
 * 
 */

@IonicPage()
@Component({
  selector: 'page-chat',
  templateUrl: 'chat.html',
})
export class ChatPage {

  showInfoHeader:boolean = false;
  showEnterMessageFooter:boolean = false;
  showFootRoom:boolean = false;

  // scroll panel with massages on
  @ViewChild('messagescroll') messagescroll:any;

  // chat data
  chat:Chat = null;
  messages: Array<Message> = [];
  messageInput:string = "";

  loading:boolean = true;
  loadingSpinner : Loading = null;

  keyboardIsOpen:boolean = false;
  isIOS:boolean;

  pageTitel:string = "";

  // platform event subscriptions
  private onPauseSubscription: Subscription;
  private onResumeSubscription: Subscription;
  private onKeyboardShowSubscription: Subscription;
  private onKeyboardHideSubscription: Subscription;

  // to work around a iOS bug
  firstTimeKeyboardiOS:boolean = true;

  constructor(
    private navCtrl: NavController, 
    private api: ApiProvider,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private state: AppStateProvider,
    private modalCtrl: ModalController,
    private persistence: AppPersistenceProvider,
    private navParams: NavParams,
    private alertCtrl: AlertController,
    private keyboard: Keyboard,
    private platform: Platform,
    private translate: TranslateService
  ) {

    // browser needs some extra space on the panel
    this.showFootRoom = !state.isRunningOnRealDevice();
    this.chat = this.navParams.get("chat") as Chat;


    // set some default vaules that get filled later
    if (this.chat) this.chat.subscribed = false;

    // flag for fixing some iOS quirks
    this.isIOS = this.state.isIOS();
    if (!this.isIOS) this.firstTimeKeyboardiOS = false;

  }

  /*
    EVENTS
  */

  ionViewWillEnter() {

    console.log("ionViewWillEnter ChatPage");
    this.showInfoHeader = (this.chat!=null);

    // register when app gets paused on OS and set into background
    this.onPauseSubscription = this.platform.pause.subscribe(()=>{
      console.log("onPauseSubscription");
      if (this.chat!=null) this.api.closeChatSocket();
    });
    
    // register when app comes back from the OS background
    this.onResumeSubscription = this.platform.resume.subscribe(() => {
      console.log("onResumeSubscription");
      if (this.chat!=null) this.initChatMessages();
    }); 

    // register on mobile keyboard event show
    this.onKeyboardShowSubscription = this.keyboard.onKeyboardShow().subscribe(()=>{
      console.log("Keyboard Show");

      /*
      // fix iOS strange first time keyboard bug
      if (this.firstTimeKeyboardiOS) {
        this.firstTimeKeyboardiOS=false;
        this.keyboard.close();
        return;
      }
      */

      /*
      if (this.isIOS) {
        try {
          console.log("CSS Fix wrong positioned iOS keyboard - ON");
          let ionNavHTMLCollection:any = document.getElementsByTagName("ion-nav"); 
          let ionNavElement:any = Array.prototype.slice.call(ionNavHTMLCollection)[0];
          ionNavElement.classList.add("ion-nav-ios-keyboardopen");
        } catch (e) {}  
      }*/

      this.keyboardIsOpen = true;
      setTimeout(() => {
        if (this.messagescroll) this.messagescroll.scrollToBottom(100);
        this.keyboard.disableScroll(true);
      },300);

    });

    // register on mobile keyboard event show
    this.onKeyboardShowSubscription = this.keyboard.onKeyboardHide().subscribe(()=>{
      console.log("Keyboard Hide");

      /*
      if (this.isIOS) {
        try {
          console.log("CSS Fix wrong positioned iOS keyboard - OFF");
          let ionNavHTMLCollection:any = document.getElementsByTagName("ion-nav"); 
          let ionNavElement:any = Array.prototype.slice.call(ionNavHTMLCollection)[0];
          ionNavElement.classList.remove("ion-nav-ios-keyboardopen");
        } catch (e) {}  
      }
      */

      this.keyboardIsOpen = false;
      this.keyboard.disableScroll(false);
    });

    // init keyboard state
    this.keyboardIsOpen = false;
    this.keyboard.close();

  }

  ionViewDidEnter() {

    console.log("ionViewDidEnter ChatPage");

    if (this.chat==null) {

      /*
        CREATE NEW CHAT
      */

      this.chat = {} as Chat;
      this.chat.name = "";
      this.chat.description = "";
      this.chat.userIsAdmin = true;
      this.showDialogEditChat();

    } else {

      /*
        EXISTING CHAT
      */

      this.showEnterMessageFooter = true;
      this.initChatMessages();

    }
  }

  ionViewWillLeave() {

    console.log("ionViewWillLeave ChatPage");
    this.showEnterMessageFooter = false;

    if (this.chat!=null) {

      // make sure chat socket is closed
      this.api.closeChatSocket();

      // unsubscribe from platform events
      if (this.onResumeSubscription) this.onResumeSubscription.unsubscribe();
      if (this.onPauseSubscription) this.onPauseSubscription.unsubscribe();
      if (this.onKeyboardShowSubscription) this.onKeyboardShowSubscription.unsubscribe();
      if (this.onKeyboardHideSubscription) this.onKeyboardHideSubscription.unsubscribe();

    }

  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad ChatPage');
  }

  // inits a chat
  initChatMessages(): void {

      /*
        GET OLD CHAT MESSAGES FROM API
      */

      this.messages = [];
      this.api.getChatMessages(this.chat, 0).subscribe((messages:Array<Message>)=>{
        this.loading = false;
        messages.forEach( (message:Message) => {
          this.addMessageToChat(message);
        });
        if (messages.length>0) setTimeout(()=>{
          if (this.messagescroll) this.messagescroll.scrollToBottom(500);
        },300);
      }, (error) => {
        this.loading = false;
        alert("TODO: handle error on chat init");
      });

      /*
        RECEIVE NEW CHAT MESSAGE FROM SOCKET
      */

      this.api.initChatSocket(this.chat).subscribe((message:Message)=>{
        this.addMessageToChat(message);
        setTimeout(()=>{
          if (this.messagescroll) this.messagescroll.scrollToBottom(200);
        },100);
      }, (error) => {
        alert("TODO: handle error on chat init");
      });

  }

  // takes a message from backend and prepares it for use in app
  addMessageToChat(msg:Message) {
  
    // check if message is from user
    if (msg.parentUser==null) {
      msg.belongsToUser = true;
    } else {
      if (this.persistence.getAppDataCache().userid==msg.parentUser._id) {
        msg.belongsToUser = true;
      } else {
        msg.belongsToUser = false;
      }
    }

    // set avatar image and name
    if (msg.belongsToUser) {
      msg.displayName = this.state.getUserInfo().nickname;
      if ((this.state.getUserInfo().avatar) && (this.state.getUserInfo().avatar.filename)) {
        // user image
        msg.displayImage = this.api.buildImageURL(this.state.getUserInfo().avatar.filename);
      } else {
        // default image
        msg.displayImage = "./assets/imgs/default-user.jpg";
      }
    } else {
      // set for user
      msg.displayName = 'Anonymous';
      msg.displayImage = "./assets/imgs/default-user.jpg";
      if (msg.parentUser!=null) {
        msg.displayName = msg.parentUser.nickname;
        if ((msg.parentUser.avatar) && (msg.parentUser.avatar.filename)) {
          msg.displayImage = this.api.buildImageURL(msg.parentUser.avatar.filename);
        }
      }
    }

    // set date
    let datePipe = new DatePipe(this.state.getActualAppLanguageInfo().locale);
    let messageAge = Date.now() - (msg.date * 1000);
    if ( messageAge > (24 * 60 * 60 * 1000) ) {
      // is older than one day (time + date)
      msg.displayTime = datePipe.transform(new Date(msg.date * 1000), 'fullDate');
    } else {
      // was this day (just time)
      msg.displayTime = datePipe.transform(new Date(msg.date * 1000), 'shortTime');
    }

    // push message to list
    this.messages.push(msg);
  }

  /*
    INTERACTION
  */

    // Pull To Refresh Action
  doRefresh(refresher) {
    
      console.log('Begin async operation', refresher);
  
      setTimeout(() => {
        console.log('Async operation has ended');
        refresher.complete();
      }, 2000);
  }

  showDialogEditChat() : void {

    if (!this.chat.userIsAdmin) {
      console.log("User is not allowed to edit chat.");
      return;
    }

    if ((typeof this.chat._id != "undefined") && (this.chat._id!=null)) {
      console.log("Dont allow edit of Chat for now");
      return;
    } 

    let modal : Modal = this.modalCtrl.create(ChatEditPage, { chat: this.chat });
    modal.onDidDismiss( (data:any) => {

        // user did close dialog by cancel
        if (data==null) {
          if ((typeof this.chat._id == "undefined") || (this.chat._id==null)) {
            // user did not created chat - so go back to main menu
            this.navCtrl.pop();
          }
          return;
        }
  
        if ((typeof data.chat._id == "undefined") || (data.chat._id==null)) {
  
          // user wants chat to be created

          // show loading spinner
          this.loadingSpinner = this.loadingCtrl.create({
            content: ''
          });
          this.loadingSpinner.present().then();

          // make API request
          this.chat.parentNeighbourhood = this.persistence.getAppDataCache().lastFocusGroupId;
          this.chat.context = "moduleGroupChat";
          this.api.createChat(
            data.chat,
            this.persistence.getAppDataCache().userid,
            this.state.getUserInfo().nickname,
            this.state.getUserInfo().avatar ? this.state.getUserInfo().avatar.filename : null
          ).subscribe((chat:Chat)=>{

            // WIN
            this.chat = chat;
            this.showInfoHeader = true;
            this.showEnterMessageFooter = true;

            // hide spinner
            this.loadingSpinner.dismiss().then();
            this.loadingSpinner = null;

            this.initChatMessages();

          }, (error)=>{
            console.log("ERR",error);

            // FAIL
            try {

              let err = JSON.parse(error.error);
              console.log("ERR2",err);

              if (err.errors[0].err.code==11000) {
                this.toastCtrl.create({
                  message: this.translate.instant('CHAT_EXISTS'),
                  cssClass: 'toast-invalid',
                  duration: 5000
                }).present().then(()=>{
                  this.navCtrl.pop();
                });

              } else throw "unkown";
            
            } catch (e) {

              this.toastCtrl.create({
                message: this.translate.instant('CHAT_CREATEFAIL'),
                duration: 3000
              }).present().then(()=>{
                this.navCtrl.pop();
              });

            }

            // hide spinner
            this.loadingSpinner.dismiss().then();
            this.loadingSpinner = null;

          });

  
        } else {
  
            // TODO if editing of chat details get reactivated ...
            // check if user edited existing chat details --> store
            this.toastCtrl.create({
              message: 'TODO: Check if user edited details and store ',
              duration: 3000
            }).present().then();
  
        }

    });
    modal.present().then();

  }

  sendMessage(): void {

    if (this.messageInput.trim().length==0) {
      return;
    }

    if (!this.state.isMinimalUserInfoSet()) {

      // user needs to set profile namen and photo first
      let modal : Modal = this.modalCtrl.create(ProfilePage, { 
        showAccountLink: false, 
        photoNeeded: false,
        notice: this.translate.instant('CHAT_NEEDNAME'),
      });
      modal.onDidDismiss(data => {
        if (this.state.isMinimalUserInfoSet(false)) {
          this.sendMessage();
        }
      });
      modal.present().then();
      return;
      
    } 

    // subscribe to notifications, so that user gets info about answers
    if (!this.chat.subscribed) {
      this.api.subscribeChat(this.chat._id).subscribe(()=>{
        this.chat.subscribed = true;
      },(error)=>{
        console.log("FAIL subscribeChat: "+error);
      });
    }

    /*
      SEND NEW CHAT MESSAGE OVER SOCKET
    */

    this.api.sendChatSocket(this.messageInput.trim());

    this.messageInput = "";
    if (this.messagescroll) this.messagescroll.scrollToBottom(300);
  }

  buttonDeleteChat() : void {
    let confirm = this.alertCtrl.create({
      title: this.translate.instant('CHAT_DELETETITLE'), 
      message: this.translate.instant('CHAT_DELETEMSG'),
      buttons: [
        {
          text: this.translate.instant('CHAT_DELETENO'),
          handler: () => {
          }
        },
        {
          text: this.translate.instant('CHAT_DELETEYES'),
          handler: () => {
            
              // show loading spinner
              this.loadingSpinner = this.loadingCtrl.create({
                content: ''
              });
              this.loadingSpinner.present().then();

              // delete on backend (sets disabled = true)
              this.api.deleteChat(this.chat).subscribe(()=>{
              
              // WIN

              // hide spinner & leave page
              this.loadingSpinner.dismiss().then();
              this.loadingSpinner = null;
              this.navCtrl.pop();
              
            }, (error) => {
              // FAIL - hide spinner
              this.loadingSpinner.dismiss().then();
              this.loadingSpinner = null;
            });

          }
        }
      ]
    });
    confirm.present();
  }

  buttonSubscribe() : void {

    if (!this.chat.subscribed) {

      // subscribe to notifications
      this.api.subscribeChat(this.chat._id).subscribe(()=>{

        this.chat.subscribed = true;

        this.toastCtrl.create({
          message: this.translate.instant('CHAT_NOTION'),
          cssClass: 'toast',
          duration: 3000
        }).present().then();
  
      },(error)=>{
        console.log("FAIL subscribeChat: "+error);
      });

    } else {

      // unsubscribe from notifications
      this.api.unsubscribeChat(this.chat._id).subscribe(()=>{

        this.chat.subscribed = false;

        this.toastCtrl.create({
          message: this.translate.instant('CHAT_NOTIOFF'),
          cssClass: 'toast',
          duration: 3000
        }).present().then();

      }, (error) => {
        console.log("FAIL unsubscribeChat: "+error);
      });

    }

  }

  focusMessageInput(gotFocus:boolean) : void {
    if (gotFocus) setTimeout(() => {
      if (this.messagescroll) this.messagescroll.scrollToBottom(100);
    },300);
  }

}