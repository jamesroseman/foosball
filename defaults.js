var DEFAULT_RATING = 1200

function defaultPlayer(ldap) {
  return {
    "games": {
      "losses": 0,
      "total": 0,
      "wins": 0
    },
    "gamesDef": {
      "losses": 0,
      "wins": 0
    },
    "gamesOff": {
      "losses": 0,
      "wins": 0
    },
    "ldap": ldap,
    "rating": DEFAULT_RATING
  }
}

module.exports.defaultPlayer = defaultPlayer;
