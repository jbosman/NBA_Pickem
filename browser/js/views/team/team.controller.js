app.controller( 'TeamCtrl', ($scope, TeamFactory) => {

	TeamFactory.getTeams()
	.then(nbaTeams => {
		$scope.nbaTeams = nbaTeams
	})

})