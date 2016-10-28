app.factory( 'TeamFactory', ( $http, $stateParams, $log) => {

	function getTeams(){

		return $http.get('api/team/' + $stateParams.id + '/nba_teams')
		.then( response => {
			return response.data;
		})
		.catch($log)
	}

	return {
		getTeams: getTeams,
	}

});