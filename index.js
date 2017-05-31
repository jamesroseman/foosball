var express = require('express');
var app = express();
var pg = require('pg');
var firebase = require('firebase');
var bodyParser = require('body-parser');
var elo = require('./elo');
var defaults = require('./defaults');

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
      // If they haven't played their placements, don't display
      var player = playersDb[ldaps[i]];
      if (playersDb[ldaps[i]].games.total < 9) {
        playersDb[ldaps[i]] = defaults.defaultPlayer(ldaps[i]);
        playersDb[ldaps[i]].rating = 0;
        playersDb[ldaps[i]].games.total = player.games.total;
      }
      players.push(playersDb[ldaps[i]]);
    }
    response.render('pages/index', { page: "home", players: players, ldaps: ldaps });
  });
});

app.get('/stats/:ldap', function(request, response) {
  var ldap = request.params.ldap;
  var games = [];
  var totals = {
    wins: 0,
    losses: 0,
    avgPoints: {
      scored: 0,
      allowed: 0
    },
    points: {
      scored: 0,
      allowed: 0
    },
    off: 0,
    def: 0
  }
  database.ref("gamelog").once("value").then(function (snapshot) {
    var gamelog = snapshot.val();
    var timestamps = Object.keys(gamelog);
    for (var i=0; i<timestamps.length; i++) {
      var game = gamelog[timestamps[i]];
      if (game.winOff.ldap == ldap ||
          game.winDef.ldap == ldap ||
          game.losOff.ldap == ldap ||
          game.losDef.ldap == ldap)
      {
        gamelog[timestamps[i]].date = new Date(parseInt(timestamps[i]));
        games.push(gamelog[timestamps[i]]);

        if (game.winOff.ldap == ldap) {
          totals.off++;
          totals.points.scored += parseInt(gamelog[timestamps[i]].winGoals);
        } else if (game.losOff.ldap == ldap) {
          totals.off++;
          totals.points.scored += parseInt(gamelog[timestamps[i]].losGoals);
        } else if (game.winDef.ldap == ldap) {
          totals.def++;
          totals.points.allowed += parseInt(gamelog[timestamps[i]].losGoals);
        } else if (game.losDef.ldap == ldap) {
          totals.def++;
          totals.points.allowed += parseInt(gamelog[timestamps[i]].winGoals);
        }
      }
    }
    database.ref("players").orderByChild("ldap").equalTo(ldap).once("value").then(function (playerSnapshot) {
      var player = playerSnapshot.val()[ldap];
      totals.wins = player.games.wins;
      totals.losses = player.games.losses;
      totals.avgPoints.scored = totals.points.scored / totals.off;
      totals.avgPoints.allowed = totals.points.allowed / totals.def;
      response.render('pages/stats', { page: "stats", games: games, totals: totals });
    });
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
  // TODO: form validation
  if (request.body.winOffLdap == request.body.losOffLdap ||
      request.body.winOffLdap == request.body.losDefLdap ||
      request.body.winDefLdap == request.body.losOffLdap ||
      request.body.winDefLdap == request.body.losDefLdap
    ) {
        response.redirect('/addGame');
        return;
      }
  var ldaps = [request.body.winOffLdap, request.body.winDefLdap, request.body.losOffLdap, request.body.losDefLdap];
  // Filter out repeats (in case of 1v1)
  ldaps = ldaps.filter(function(elem, index, self) {
    return index == self.indexOf(elem);
  });

  database.ref("players").once("value").then(function (snapshot) {
    var playersDb = snapshot.val();
    var newPlayersDb = playersDb;
    var winOff = playersDb[request.body.winOffLdap];
    var winDef = playersDb[request.body.winDefLdap];
    var losOff = playersDb[request.body.losOffLdap];
    var losDef = playersDb[request.body.losDefLdap];
    var ratings = elo.calcAllRatingsFromPlayers(winOff, winDef, losOff, losDef);

    // Capture old and new elo
    var winOffPre = playersDb[winOff.ldap].rating;
    var winDefPre = playersDb[winDef.ldap].rating;
    var losOffPre = playersDb[losOff.ldap].rating;
    var losDefPre = playersDb[losDef.ldap].rating;

    newPlayersDb[winOff.ldap].games.total = playersDb[winOff.ldap].games.total+1;
    newPlayersDb[winOff.ldap].games.wins = playersDb[winOff.ldap].games.wins+1;
    newPlayersDb[winOff.ldap].gamesOff.wins = playersDb[winOff.ldap].gamesOff.wins+1;
    newPlayersDb[winOff.ldap].rating = ratings[winOff.ldap];

    if (winOff != winDef) {
      newPlayersDb[winDef.ldap].games.total = playersDb[winDef.ldap].games.total+1;
      newPlayersDb[winDef.ldap].games.wins = playersDb[winDef.ldap].games.wins+1;
    }
    newPlayersDb[winDef.ldap].gamesDef.wins = playersDb[winDef.ldap].gamesDef.wins+1;
    newPlayersDb[winDef.ldap].rating = ratings[winDef.ldap];

    newPlayersDb[losOff.ldap].games.total = playersDb[losOff.ldap].games.total+1;
    newPlayersDb[losOff.ldap].games.losses = playersDb[losOff.ldap].games.losses+1;
    newPlayersDb[losOff.ldap].gamesOff.losses = playersDb[losOff.ldap].gamesOff.losses+1;
    newPlayersDb[losOff.ldap].rating = ratings[losOff.ldap];

    if (losOff != losDef) {
      newPlayersDb[losDef.ldap].games.total = playersDb[losDef.ldap].games.total+1;
      newPlayersDb[losDef.ldap].games.losses = playersDb[losDef.ldap].games.losses+1;
    }
    newPlayersDb[losDef.ldap].gamesDef.losses = playersDb[losDef.ldap].gamesDef.losses+1;
    newPlayersDb[losDef.ldap].rating = ratings[losDef.ldap];


    // Write data to DB
    for(var i=0; i<ldaps.length; i++) {
      database.ref("players/" + ldaps[i]).set(newPlayersDb[ldaps[i]]);
    }
    database.ref("gamelog/" + Date.now()).set({
      "winGoals": request.body.winGoals,
      "winOff": {
        "ldap": winOff.ldap,
        "preRating": winOffPre,
        "postRating": ratings[winOff.ldap],
      },
      "winDef": {
        "ldap": winDef.ldap,
        "preRating": winDefPre,
        "postRating": ratings[winDef.ldap],
      },
      "losGoals": request.body.losGoals,
      "losOff": {
        "ldap": losOff.ldap,
        "preRating": losOffPre,
        "postRating": ratings[losOff.ldap],
      },
      "losDef": {
        "ldap": losDef.ldap,
        "preRating": losDefPre,
        "postRating": ratings[losDef.ldap],
      },
    });
    response.redirect('/');
  });
});

app.get('/addUser', function(request, response) {
  response.render('pages/addUser', { page: "addUser" });
});

app.post('/addUser', function(request, response) {
  database.ref("players").once("value").then(function (snapshot) {
    var ldap = request.body.ldap;
    var ldaps = Object.keys(snapshot.val());
    if (!request.body.ldap || ldaps.indexOf(ldap) > -1) {
      response.redirect('/addUser');
      return;
    }
    database.ref("players/" + ldap).set(defaults.defaultPlayer(ldap));
    response.redirect('/');
  });
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
