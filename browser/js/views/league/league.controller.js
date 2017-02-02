app.controller( 'LeagueCtrl', function($scope, $http, LeagueFactory, TeamFactory){

	$scope.tab = { league: 'active' }

	LeagueFactory.getLeagueTeamsFromServer();

	$scope.getLeagueTeams = LeagueFactory.getLeagueTeams;

});
