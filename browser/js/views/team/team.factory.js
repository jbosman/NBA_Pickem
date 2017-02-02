app.factory( 'TeamFactory', ( $http, $stateParams, $log, NBA_League_Factory ) => {

	let NBAteams = [];

	function getTeamFromServer(){

		$http.get('api/team/' + $stateParams.id + '/nba_teams')
		.then( response => {
			NBAteams = response.data;
		})
		.catch($log)
	}

	function updateNBATeams(){
		NBAteams.forEach( team => {
			team.wins = getNBATeamWins(team.abbr);
		})
	}

	function getNBATeamWins(abbr){
		let liveNBATeamInfoObj = NBA_League_Factory.getNBATeamInfoObj();
		return liveNBATeamInfoObj[abbr];
	}

	function getTeamTotalWins(teams){
		
		let sum = 0;
		let liveNBATeamInfoObj = NBA_League_Factory.getNBATeamInfoObj();

		teams.forEach( team => {
			sum += Number(liveNBATeamInfoObj[team.abbr]);
		})

		return sum;
	}

	// Doing this to allow for sorting the teams by wins
	function getNBATeams(){
		updateNBATeams();
		return NBAteams;
	}

	return {
		getNBATeams: getNBATeams,
		getTeamTotalWins: getTeamTotalWins,
		getTeamFromServer: getTeamFromServer
	}

});
