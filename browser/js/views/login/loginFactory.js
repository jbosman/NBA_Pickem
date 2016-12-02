app.factory( 'LoginFactory', function( AuthService, $state, UserFactory, CookieFactory ){

    function sendLogin(loginInfo){
        return AuthService.login(loginInfo)
        .then( () => CookieFactory.setCookie(loginInfo))
        .then( () => UserFactory.initUserFactory() )
        .then( () => { $state.go('user') })
    }

    return {
        sendLogin: sendLogin,
    }

});
