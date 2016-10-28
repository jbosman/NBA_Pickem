app.config(function($stateProvider){
	$stateProvider.state( 'league', {
		url: '/league/:id',
		templateUrl: 'js/views/league/league.html',
		controller: 'LeagueCtrl'
	})
});
