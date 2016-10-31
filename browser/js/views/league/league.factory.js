app.factory('LeagueFactory', function($http, $stateParams){

	function getLeagueTeams(){
		return $http.get('/api/league/' + $stateParams.id + '/teams' )
		.then( response => {
			console.log(response.data)
			return response.data;
		})
	}

	return {
		getLeagueTeams: getLeagueTeams,

	}

});
