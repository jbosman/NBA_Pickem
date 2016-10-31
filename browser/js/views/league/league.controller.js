app.controller( 'LeagueCtrl', function($scope, $http, LeagueFactory){

	$scope.tab = { league: 'active' }

	LeagueFactory.getLeagueTeams()
	.then(leagueTeams => { $scope.teams = leagueTeams })
});
