var firebase = require('firebase');
var elo = require('../elo');

var startingRating = 1200

// Firebase configuration of "from" database
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

var players = {}

function getPlayerOrDefault(ldap) {
  if (!players[ldap]) {
    var newPlayer = {
      games: {
        losses: 0,
        total: 0,
        wins: 0
      },
      gamesDef: {
        losses: 0,
        wins: 0
      },
      gamesOff: {
        losses: 0,
        wins: 0
      },
      ldap: ldap,
      rating: startingRating
    }
    players[ldap] = newPlayer
  }
  return players[ldap]
}

function updatePlayer(ldap, newRating, wasOff, didWin) {
  players[ldap].games.total += 1
  players[ldap].rating = newRating
  if (didWin) {
    players[ldap].games.wins += 1
    if (wasOff) {
      players[ldap].gamesOff.wins += 1
    } else {
      players[ldap].gamesDef.wins += 1
    }
  } else {
    players[ldap].games.losses += 1
    if (wasOff) {
      players[ldap].gamesOff.losses += 1
    } else {
      players[ldap].gamesDef.losses += 1
    }
  }
}

function processGame(game) {
  var updatedGame = game

  var losDef = getPlayerOrDefault(updatedGame.losDef.ldap)
  var losOff = getPlayerOrDefault(updatedGame.losOff.ldap)
  var winDef = getPlayerOrDefault(updatedGame.winDef.ldap)
  var winOff = getPlayerOrDefault(updatedGame.winOff.ldap)

  // update pre-rating
  updatedGame.losDef.preRating = losDef.rating
  updatedGame.losOff.preRating = losOff.rating
  updatedGame.winDef.preRating = winDef.rating
  updatedGame.winOff.preRating = winOff.rating

  // calculate and store post rating
  var newRatings = elo.calcAllRatingsFromPlayers(
    winOff,
    winDef,
    losOff,
    losDef
  )

  // update players db
  updatePlayer(losDef.ldap, newRatings[losDef.ldap], false, false)
  updatePlayer(losOff.ldap, newRatings[losOff.ldap], true, false)
  updatePlayer(winDef.ldap, newRatings[winDef.ldap], false, true)
  updatePlayer(winOff.ldap, newRatings[winOff.ldap], true, true)

  // update post-rating
  updatedGame.losDef.postRating = losDef.rating
  updatedGame.losOff.postRating = losOff.rating
  updatedGame.winDef.postRating = winDef.rating
  updatedGame.winOff.postRating = winOff.rating

  // write the game
  database.ref("updatedGamelog/" + updatedGame.timestamp).set(updatedGame)

  // write the players
  database.ref("updatedPlayers/" + losDef.ldap).set(players[losDef.ldap])
  database.ref("updatedPlayers/" + losOff.ldap).set(players[losOff.ldap])
  database.ref("updatedPlayers/" + winDef.ldap).set(players[winDef.ldap])
  database.ref("updatedPlayers/" + winOff.ldap).set(players[winOff.ldap])
}

database.ref("players").once("value").then(function (snapshot) {
  database.ref("gamelog").once("value").then(function (gameSnapshot) {
    Object.keys(gameSnapshot.val()).forEach(function(timestamp) {
      var game = gameSnapshot.val()[timestamp]
      game.timestamp = timestamp
      processGame(game)
    });
    console.log("PLAYERS")
    console.log(players)
  })
})
