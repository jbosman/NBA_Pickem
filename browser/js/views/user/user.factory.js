app.factory( 'UserFactory', function($http, Session, $log){

	let userTeams = [];
	let userSelectedTeam = undefined;


	function initUserFactory(){
		return $http.get('api/team/user/' + Session.user.id )
		.then( response => {
			userTeams = response.data;
			userSelectedTeam = userTeams[0];
		})
		.catch($log)
	}

	return {
		initUserFactory: initUserFactory,
		getUserTeams: () => userTeams,
		getSelectedTeam: () => userSelectedTeam
	}

});
