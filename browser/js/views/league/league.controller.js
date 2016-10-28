app.controller( 'LeagueCtrl', function($scope, $http, LeagueFactory){
	LeagueFactory.getLeagueTeams()
	.then(leagueTeams => { $scope.teams = leagueTeams })
});
