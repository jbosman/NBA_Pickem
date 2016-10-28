app.factory('LeagueFactory', function($http, $stateParams){

	function getLeagueTeams(){
		return $http.get('/api/league/' + $stateParams.id + '/teams' )
		.then( response => {
			return response.data;
		})
	}

	return {
		getLeagueTeams: getLeagueTeams,

	}

});
