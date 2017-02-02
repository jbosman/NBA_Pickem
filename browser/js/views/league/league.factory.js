app.factory('LeagueFactory', function($http, $stateParams, TeamFactory){

	let leagueTeams;

	function getLeagueTeamsFromServer(){
		$http.get('/api/league/' + $stateParams.id + '/teams' )
		.then( response => {
			leagueTeams = response.data;
			console.log(leagueTeams)
		})
	}

	function updateLeagueTeams(){
		leagueTeams.forEach( team => {
			team.totalWins = TeamFactory.getTeamTotalWins(team.teams)
		})
	}

	function getLeagueTeams(){
		console.log(leagueTeams)
		updateLeagueTeams();
		return leagueTeams;
	}

	return {
		getLeagueTeamsFromServer: getLeagueTeamsFromServer,
		getLeagueTeams: getLeagueTeams
	}

});
