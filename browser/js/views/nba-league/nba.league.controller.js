app.controller( 'NBA_Ctrl', function( $scope, NBA_League_Factory, $log){

	$scope.tab = { nbaStandings: 'active' }

	$scope.nbaTeamsInfo = NBA_League_Factory.getNBATeamInfo;


});
