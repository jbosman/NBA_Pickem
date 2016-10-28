app.config(function($stateProvider){

	$stateProvider.state('login', {
		url: '/login',
		templateUrl: 'js/views/login/login.html',
		controller: 'LoginCtrl'
	})
});

app.controller('LoginCtrl', function ($scope, AuthService, $state, UserFactory) {

    $scope.login = {};
    $scope.error = null;

    $scope.sendLogin = function (loginInfo) {

        $scope.error = null;

        AuthService.login(loginInfo).then( () => UserFactory.initUserFactory() )
        .then( () => { $state.go('user') })
        .catch( () => { $scope.error = 'Invalid login credentials.' });

    };

});

