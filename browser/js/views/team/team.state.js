app.config( $stateProvider => {

	$stateProvider.state( 'team', {
		url: 'team/:id',
		templateUrl: 'js/views/team/team.html',
		controller: 'TeamCtrl',
	});

});
