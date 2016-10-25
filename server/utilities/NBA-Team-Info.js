let http = require('http');
let RequestPromise = require('request-promise');

// ESPN NBA Webscraper for NBA team league info
// Input: 	Desired year of NBA team league information in the format of XXXX
// Output: 	An array of all NBA teams in the following format:
//				{ 	name: 'NBA Team Name', 
//					abbr: 'NBA Team Name Abbreviation', 
//					wins: 'NBA Team Wins for year XXXX ' }
// notes: ESPN only provides info dating back to 2002.

module.exports = year => {

	let host = 'http://www.espn.com';
	let espnPath = 
			year >= (new Date()).getFullYear() || year <= 2002 ?
			'/nba/standings/_/group/league' : 
			'/nba/standings/_/season/' + year + '/group/league';

	return RequestPromise( host + espnPath )
	.then( response => {
		return scrapeESPN_HTML(response);
	})
}

function scrapeESPN_HTML(nbaPage){
	let teamTokenizer = '<span class="team-names">';
	let teamTokens = nbaPage.split(teamTokenizer);
	let nbaTeamsInfo = [];

	for(let i = 1; i < teamTokens.length; i++ ){ // starting at 1 here because the first token is garbage
		nbaTeamsInfo.push(parseTeamInfo( teamTokens[i]) );
	}

	return nbaTeamsInfo;
}

function parseTeamInfo(teamInfoStr){

	let teamInfo = {};
	// Parse team name
	let endOfTeamNameLoc = teamInfoStr.indexOf('</span>');
	teamInfo.name = teamInfoStr.slice(0, endOfTeamNameLoc);

	// Parse abbreviated team name
	let abbrTagStart = '<abbr title="' + teamInfo.name + '">';
	let abbrTagEnd = '</abbr>';
	teamInfo.abbr = teamInfoStr.slice( teamInfoStr.indexOf(abbrTagStart) + abbrTagStart.length, teamInfoStr.indexOf(abbrTagEnd));

	// Parse team wins
	let winsArr = teamInfoStr.split('class="">')
	let wins = winsArr[1].slice(0, winsArr[1].indexOf('</td>'));
	teamInfo.wins = wins;

	return teamInfo;
}
