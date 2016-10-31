app.factory( 'TeamFactory', ( $http, $stateParams, $log) => {

	let teamTotalWins = 0;

	function getTeams(){

		return $http.get('api/team/' + $stateParams.id + '/nba_teams')
		.then( response => {
			teamTotalWins = 0;
			response.data.forEach( team => { teamTotalWins += team.wins })
			return response.data;
		})
		.catch($log)
	}

	return {
		getTeams: getTeams,
		getTeamWinTotal: () => teamTotalWins,
	}

});
