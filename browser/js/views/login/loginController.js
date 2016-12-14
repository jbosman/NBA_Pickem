app.controller('LoginCtrl', function ($scope, LoginFactory, CookieFactory) {
    $scope.login = {};
    $scope.error = null;
    $scope.isLoginState = () => {return true;}

    function sendLoginNow(loginInfo){

        $scope.error = null;
        LoginFactory.sendLogin(loginInfo)
        .catch( () => { $scope.error = 'Invalid login credentials.' })
    }

    function guestLogin(){
        sendLoginNow({ email: 'joey@joey.com', password: 'joey'})
    }

    $scope.sendLogin = sendLoginNow;
    $scope.guestLogin = guestLogin;

    if ( CookieFactory.isCookie() ){
		sendLoginNow( CookieFactory.getCookie() );
    }

});
