app.controller( 'LeagueCtrl', function($scope, $http, LeagueFactory ){

	$scope.tab = { league: 'active' }

	LeagueFactory.getLeagueTeamsFromServer();

	$scope.getLeagueTeams = LeagueFactory.getLeagueTeams;

});
