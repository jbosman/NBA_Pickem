app.config( $stateProvider => {
	$stateProvider.state( 'nbaLeague', {
		url: '/nba-standings',
		templateUrl: 'js/views/nba-league/nba.league.html',
		controller: 'NBA_Ctrl'
	})
})
