app.config(function($stateProvider){

	$stateProvider.state('user', {
		url: '/user',
		templateUrl: 'js/views/user/user.html',
		controller: 'UserCtrl'
	})

});
