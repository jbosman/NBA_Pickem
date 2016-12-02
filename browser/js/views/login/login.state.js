app.config(function($stateProvider){

	$stateProvider.state('login', {
		url: '/login',
		templateUrl: 'js/views/login/login.html',
		controller: 'LoginCtrl'
	})
});
