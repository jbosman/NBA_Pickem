app.controller( 'TeamCtrl', ($scope, TeamFactory) => {

	$scope.tab = { team: 'active' }

	TeamFactory.getTeams()
	.then(nbaTeams => {
		$scope.nbaTeams = nbaTeams
	})

});
