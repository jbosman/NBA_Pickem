app.controller( 'TeamCtrl', ($scope, TeamFactory) => {
	$scope.tab = { team: 'active' }

	// Setup to live update when each ESPN scrape
	TeamFactory.getTeamFromServer();
	$scope.getNBATeams = TeamFactory.getNBATeams;
	$scope.getNBATeamWins = TeamFactory.getNBATeamWins;
	$scope.getTeamTotalWins = TeamFactory.getTeamTotalWins;

});
