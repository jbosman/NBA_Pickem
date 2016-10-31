app.factory( 'UserFactory', function($http, Session, $log){

	let userTeams = [];
	let userSelectedTeamID = undefined;
	let userSelectedLeagueID = undefined;

	function initUserFactory(){
		return $http.get('api/team/user/' + Session.user.id )
		.then( response => {
			userTeams = response.data;
			// Intialize these to first team and league to start
			userSelectedTeamID = userTeams[0].id;
			userSelectedLeagueID = userTeams[0].league.id;
		})
		.catch($log)
	}

	return {
		initUserFactory: initUserFactory,
		getUserTeams: () => userTeams,
		getSelectedTeamID: () => userSelectedTeamID,
		getSelectedLeagueID: () => userSelectedLeagueID,
	}

});
