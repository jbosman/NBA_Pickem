app.factory('NBA_League_Factory', function($http){

	let nbaTeamInfo = [];
	let nbaTeamInfoObj = {};

	function scrapeESPNhtml(nbaPage){
		let teamTokenizer = '<span class="team-names">';
		let teamTokens = nbaPage.split(teamTokenizer);
		// Clear old data
		nbaTeamInfo = [];
		nbaTeamInfoObj = {};
		// Populate nba team info objects
		for (let i = 1; i < teamTokens.length; i++ ){ // starting at 1 here because the first token is garbage
			nbaTeamInfo.push(parseTeamInfo( teamTokens[i]) );
			nbaTeamInfoObj[nbaTeamInfo[ i - 1 ].abbr] = Number(nbaTeamInfo[ i - 1 ].wins);
		}
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
		teamInfo.wins = Number(wins);

		return teamInfo;
	}

	// ESPN NBA Webscraper for NBA team league info
	// Input: 	Desired year of NBA team league information in the format of XXXX
	// Output: 	An array of all NBA teams in the following format:
	//				{ 	name: 'NBA Team Name',
	//					abbr: 'NBA Team Name Abbreviation',
	//					wins: 'NBA Team Wins for year XXXX ' }
	// notes: ESPN only provides info dating back to 2002.

	function getNBATeamInfoFromESPN() {

		let year = 2017; // Right now just set to get current year

		let host = 'http://www.espn.com';
		let espnPath =
			year >= (new Date()).getFullYear() || year <= 2002 ?
			'/nba/standings/_/group/league' :
			'/nba/standings/_/season/' + year + '/group/league';

		$http.get( host + espnPath )
		.then( espnNBAPage => {
			scrapeESPNhtml(espnNBAPage.data)
		})
		.catch(console.error);
	}

	function kickOffNBATeamWinGetter(){
		getNBATeamInfoFromESPN();					// Kick it off right away so we have data to display
		setInterval( getNBATeamInfoFromESPN, 60000); // Then update once a minute
	}

	return {
		getNBATeamInfo: () => nbaTeamInfo,
		getNBATeamInfoObj: () => nbaTeamInfoObj,
		getNBATeamInfoFromESPN: getNBATeamInfoFromESPN,
		kickOffNBATeamWinGetter: kickOffNBATeamWinGetter,
	}

});
