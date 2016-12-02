app.factory( 'CookieFactory', function(){

	let cookieObj = {};

	function isCookie(){
		if ( document.cookie ){
			parseUserInfo();
			return true;
		}
		else {
			return false;
		}
	}

	function setCookie(loginInfo){
		cookieObj.email = loginInfo.email;
		cookieObj.password = loginInfo.password;
		document.cookie = 'userInfoJSON=' + JSON.stringify( cookieObj );
		resetCookieExpire();
	}

	function resetCookieExpire(){
		let currentDate = new Date();
		let expireDate = new Date( currentDate.setMonth( currentDate.getMonth() + 6));
		document.cookie = 'expires=' + expireDate.toUTCString();
	}

	function getCookie(){
		return cookieObj;
	}

	function parseUserInfo(){
		let parseInfo = document.cookie.split('=');
		let userInfo = parseInfo[1].split(';')[0];
		cookieObj = JSON.parse(userInfo);
	}

	return {
		isCookie: isCookie,
		setCookie: setCookie,
		getCookie: getCookie,
	}

});
