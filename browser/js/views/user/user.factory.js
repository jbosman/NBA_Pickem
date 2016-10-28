app.factory( 'UserFactory', function($http, Session, $log){

	let userTeams = [];
	let selectedLeague = undefined;

	function initUserFactory(){
		return $http.get('api/team/user/' + Session.user.id )
		.then( response => { userTeams = response.data })
		.catch($log)
	}

	return {
		initUserFactory: initUserFactory,
		getUserTeams: () => userTeams,
	}

});
