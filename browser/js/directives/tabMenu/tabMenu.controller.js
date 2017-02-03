app.controller('TabMenuController', function($scope, UserFactory){
	$scope.teamId = UserFactory.getSelectedTeamID();
	$scope.leagueId = UserFactory.getSelectedLeagueID();
});
