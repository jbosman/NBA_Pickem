app.config(function($stateProvider){
	$stateProvider.state( 'league', {
		url: '/league',
		templateUrl: 'js/views/league/league.html',
		controller: 'LeagueCtrl'
	})
});

app.controller( 'LeagueCtrl', function($scope, $http, Session){
	$http.get('/api/league/' + Session.user.id )
	.then( response => {
		$scope.league = response.data;
	})
});
