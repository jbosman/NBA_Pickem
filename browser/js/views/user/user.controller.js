app.controller('UserCtrl', function($scope, UserFactory){

	$scope.userTeams = UserFactory.getUserTeams();

});
