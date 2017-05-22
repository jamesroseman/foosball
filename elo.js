function eloFromRating(rating) {
  return Math.pow(10, (rating/400));
}

function ratingFromElo(elo) {
  return 400 * Math.log10(elo);
}

function calcTeamWinExpect(winOffRating, winDefRating, losOffRating, losDefRating){
  var eloWinAvg = (eloFromRating(winOffRating) + eloFromRating(winDefRating)) / 2;
  var eloLosAvg = (eloFromRating(losOffRating) + eloFromRating(losDefRating)) / 2;
  return eloWinAvg / (eloWinAvg + eloLosAvg);
};

function calcKFactor(rating, gamesPlayed) {
  // This allows 9 placement matches that better move Elo
  if (gamesPlayed < 10) {
    return 40;
  // This slows down players the system is confident it's placed well
  } else if (rating < 2100) {
    return 20;
  } else {
    return 10;
  }
}

function calcEloFromTeam(toCalcRating, teammateRating, oppRating1, oppRating2, gamesPlayed, didWin) {
  var winExpectation = calcTeamWinExpect(toCalcRating, teammateRating, oppRating1, oppRating2);
  var score = didWin ? 1 : 0;
  var kFactor = calcKFactor(toCalcRating, gamesPlayed);
  var compElo = eloFromRating(toCalcRating) + kFactor * (score - winExpectation);
  return ratingFromElo(compElo);
}

function calcAllElosFromPlayers(winOff, winDef, losOff, losDef) {
  var elos = {};
  elos[winOff.ldap] = calcEloFromTeam(winOff.rating, winDef.rating, losOff.rating, losDef.rating, winOff.games.total, true);
  elos[winDef.ldap] = calcEloFromTeam(winDef.rating, winOff.rating, losOff.rating, losDef.rating, winDef.games.total, true);
  elos[losOff.ldap] = calcEloFromTeam(losOff.rating, losDef.rating, winOff.rating, winDef.rating, losOff.games.total, false);
  elos[losDef.ldap] = calcEloFromTeam(losDef.rating, losOff.rating, winOff.rating, winDef.rating, losOff.games.total, false);
  return elos;
}

module.exports.calcAllElosFromPlayers = calcAllElosFromPlayers;
