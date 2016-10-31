app.controller( 'TeamCtrl', ($scope, TeamFactory) => {
	$scope.tab = { team: 'active' }

	 TeamFactory.getTeams()
	 .then( teams => {
		$scope.nbaTeams = teams
		$scope.teamTotalWins = TeamFactory.getTeamWinTotal();
	 })

});
