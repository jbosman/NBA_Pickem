app.directive( 'nbaTeamRepeat', function() {
	return {
		restrict: 'E',
		templateUrl: 'js/directives/nba-team/nba-team.html',
		scope: {
			nbateams: '='
		}
	}
});

