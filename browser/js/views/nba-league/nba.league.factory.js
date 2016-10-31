app.factory('NBA_League_Factory', function($http, $log){

	let nbaTeamInfo = [];

	// For now just making an IIFE will make more
	// performant later
	(function getNBATeamInfo(){
		return $http.get('api/nba-teams/wins/2016')
	    .then( response => {
			nbaTeamInfo = response.data;
	    })
	    .catch($log)
	})()

	return {
		getNBATeamInfo: () => nbaTeamInfo,
	}

});
