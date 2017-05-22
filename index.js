var express = require('express');
var app = express();
var pg = require('pg');
var firebase = require('firebase');
var bodyParser = require('body-parser');
var elo = require('./elo');

//pg.defaults.ssl = true;

// Firebase configuration
var fbConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DB_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
};
firebase.initializeApp(fbConfig);
var database = firebase.database();

app.use(bodyParser.urlencoded({ extended: true }));
app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));
// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  var players = [];
  database.ref("players").once("value").then(function (snapshot) {
    var playersDb = snapshot.val();
    var ldaps = Object.keys(playersDb);
    for (var i=0; i<ldaps.length; i++) {
      players.push(playersDb[ldaps[i]]);
    }
    response.render('pages/index', { page: "home", players: players, ldaps: ldaps });
  });
});

app.get('/addGame', function(request, response) {
  var players = [];
  database.ref("players").once("value").then(function (snapshot) {
    var playersDb = snapshot.val();
    var ldaps = Object.keys(playersDb);
    for (var i=0; i<ldaps.length; i++) {
      players.push(playersDb[ldaps[i]]);
    }
    response.render('pages/addGame', { page: "addGame", ldaps: ldaps });
  });
});

app.post('/addGame', function(request, response) {
  // TODO: Store in DB
  // TODO: form validation
  var newPlayersDb = {};
  var ldaps = [request.body.winOffLdap, request.body.winDefLdap, request.body.losOffLdap, request.body.losDefLdap];
  database.ref("players").once("value").then(function (snapshot) {
    var playersDb = snapshot.val();
    var newPlayersDb = playersDb;
    var winOff = playersDb[request.body.winOffLdap];
    var winDef = playersDb[request.body.winDefLdap];
    var losOff = playersDb[request.body.losOffLdap];
    var losDef = playersDb[request.body.losDefLdap];
    var elos = elo.calcAllElosFromPlayers(winOff, winDef, losOff, losDef);

    // Set new player values
    newPlayersDb[winOff.ldap].games.total = newPlayersDb[winOff.ldap].games+1;
    newPlayersDb[winOff.ldap].games.wins = newPlayersDb[winOff.ldap].games.wins+1;
    newPlayersDb[winOff.ldap].gamesOff.wins = newPlayersDb[winOff.ldap].gamesOff.wins+1;
    newPlayersDb[winOff.ldap].rating = elos[winOff.ldap];

    newPlayersDb[winDef.ldap].games.total = newPlayersDb[winDef.ldap].games+1;
    newPlayersDb[winDef.ldap].games.wins = newPlayersDb[winDef.ldap].games.wins+1;
    newPlayersDb[winDef.ldap].gamesDef.wins = newPlayersDb[winDef.ldap].gamesDef.wins+1;
    newPlayersDb[winDef.ldap].rating = elos[winDef.ldap];

    newPlayersDb[losOff.ldap].games.total = newPlayersDb[losOff.ldap].games+1;
    newPlayersDb[losOff.ldap].games.losses = newPlayersDb[losOff.ldap].games.losses+1;
    newPlayersDb[losOff.ldap].gamesOff.losses = newPlayersDb[losOff.ldap].gamesOff.losses+1;
    newPlayersDb[losOff.ldap].rating = elos[losOff.ldap];

    newPlayersDb[losDef.ldap].games.total = newPlayersDb[losDef.ldap].games+1;
    newPlayersDb[losDef.ldap].games.losses = newPlayersDb[losDef.ldap].games.losses+1;
    newPlayersDb[losDef.ldap].gamesDef.losses = newPlayersDb[losDef.ldap].gamesDef.losses+1;
    newPlayersDb[losDef.ldap].rating = elos[losDef.ldap];

    // Write data to DB
    for(var i=0; i<ldaps.length; i++) {
      database.ref("players/" + ldaps[i]).set(newPlayersDb[ldaps[i]]);
    }
    response.redirect('/');
  });
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
