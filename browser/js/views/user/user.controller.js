app.controller('UserCtrl', function($scope, UserFactory){

	$scope.tab = { home: 'active' };

	$scope.userTeams = UserFactory.getUserTeams();

	$scope.selectedTeamID = UserFactory.getSelectedTeamID();

	$scope.selectedLeagueID = UserFactory.getSelectedLeagueID();

});
