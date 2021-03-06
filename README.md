# Konfetti App

App to build better local communities.

See a preview running here: http://files.rotzoll.de/konfetti/

This repo contains prototype v2 - in fresh development. You find prototype v1 here: https://github.com/rootzoll/konfetti-app

### Get it running locally for development

Start up development backend locally (see README): 
https://github.com/konfetti-app/konfetti-backend

We recommend using NVM to use a fresh NodeJS environment for app development:
https://github.com/creationix/nvm

```bash
$ nvm use
```
(if the displayed version is not install - install it )

And then start the Konfetti app in your browser: 

```bash
$ sudo npm install -g ionic cordova
$ ionic serve
```

Happy development ... more info soon.

### Building the App for iOS and Android 

Still in dev ... but to get Pushnotifications with OneSignal running for iOS on OSX:

```bash
sudo gem install cocoapods
pod repo update
```

see further documentation: https://documentation.onesignal.com/docs/ionic-sdk-setup

Important Note for iOS: Be sure that you open .xcworkspace, not .xcodeproj - that the only way you get the cocoapods things running, otherwise there will be missing libs.

### Managing Multi-Language Translation

The Konfetti app uses the ngx-translate framework as recommended by the IONIC project.
http://ionicframework.com/docs/developer-resources/ng2-translate/
https://github.com/ngx-translate/core

But instead of having single JSON files for the different languages, you just find one big file called 'i18n-data.json' 
in the 'assets/i18n' folder. DO NOT EDIT THIS FILE. The content of the file is an export of a Google Spreadsheet that 
the Konfetti project uses to collaborate with external translators.

You can find the Translation Spreadsheet here: 
[LINK TO BE ADDED LATER]

The export is managed with the following script:
https://github.com/rootzoll/angular-translate-sheet-export

