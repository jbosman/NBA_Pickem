app.controller('LoginCtrl', function ($scope, LoginFactory, CookieFactory, NBA_League_Factory) {
    $scope.login = {};
    $scope.error = null;
    $scope.isLoginState = () => {return true;}

    NBA_League_Factory.kickOffNBATeamWinGetter(); // Start right when we hit the login page

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
