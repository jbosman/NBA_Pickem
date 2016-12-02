app.controller('LoginCtrl', function ($scope, LoginFactory, CookieFactory) {
    $scope.login = {};
    $scope.error = null;
    $scope.isLoginState = () => {return true;}

    function sendLoginNow(loginInfo){

        $scope.error = null;

        LoginFactory.sendLogin(loginInfo)
        .catch( () => { $scope.error = 'Invalid login credentials.' })
    }

    $scope.sendLogin = sendLoginNow

    if ( CookieFactory.isCookie() ){
		console.log( 'cookie found!' );
		console.log( CookieFactory.getCookie() );
		sendLoginNow( CookieFactory.getCookie() );
    }

});
