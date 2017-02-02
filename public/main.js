'use strict';

window.app = angular.module('NBA_Pickem_App', ['preBuilt', 'ui.router']);

app.config(function ($urlRouterProvider, $locationProvider) {
	// This turns off hashbang urls (/#about) and changes it to something normal (/about)
	$locationProvider.html5Mode(true);
	// If we go to a URL that ui-router doesn't have registered, go to the "/" url.
	$urlRouterProvider.otherwise('/login');
	// Trigger page refresh when accessing an OAuth route
	$urlRouterProvider.when('/auth/:provider', function () {
		window.location.reload();
	});
});

// This app.run is for listening to errors broadcasted by ui-router, usually originating from resolves
app.run(function ($rootScope) {
	$rootScope.$on('$stateChangeError', function (event, toState, toParams, fromState, fromParams, thrownError) {
		console.info('The following error was thrown by ui-router while transitioning to state "' + toState.name + '". The origin of this error is probably a resolve function:');
		console.error(thrownError);
	});
});

// This app.run is for controlling access to specific states.
app.run(function ($rootScope, AuthService, $state) {

	// The given state requires an authenticated user.
	var destinationStateRequiresAuth = function destinationStateRequiresAuth(state) {
		return state.data && state.data.authenticate;
	};

	// $stateChangeStart is an event fired
	// whenever the process of changing a state begins.
	$rootScope.$on('$stateChangeStart', function (event, toState, toParams) {

		if (!destinationStateRequiresAuth(toState)) {
			// The destination state does not require authentication
			// Short circuit with return.
			return;
		}

		if (AuthService.isAuthenticated()) {
			// The user is authenticated.
			// Short circuit with return.
			return;
		}

		// Cancel navigating to new state.
		event.preventDefault();

		AuthService.getLoggedInUser().then(function (user) {
			// If a user is retrieved, then renavigate to the destination
			// (the second time, AuthService.isAuthenticated() will work)
			// otherwise, if no user is logged in, go to "login" state.
			if (user) {
				$state.go(toState.name, toParams);
			} else {
				$state.go('login');
			}
		});
	});
});

(function () {

	'use strict';

	// Hope you didn't forget Angular! Duh-doy.

	if (!window.angular) throw new Error('I can\'t find Angular!');

	var app = angular.module('preBuilt', []);

	// app.factory('Socket', function () {
	//     if (!window.io) throw new Error('socket.io not found!');
	//     return window.io(window.location.origin);
	// });

	// AUTH_EVENTS is used throughout our app to
	// broadcast and listen from and to the $rootScope
	// for important events about authentication flow.
	app.constant('AUTH_EVENTS', {
		loginSuccess: 'auth-login-success',
		loginFailed: 'auth-login-failed',
		logoutSuccess: 'auth-logout-success',
		sessionTimeout: 'auth-session-timeout',
		notAuthenticated: 'auth-not-authenticated',
		notAuthorized: 'auth-not-authorized'
	});

	app.factory('AuthInterceptor', function ($rootScope, $q, AUTH_EVENTS) {
		var statusDict = {
			401: AUTH_EVENTS.notAuthenticated,
			403: AUTH_EVENTS.notAuthorized,
			419: AUTH_EVENTS.sessionTimeout,
			440: AUTH_EVENTS.sessionTimeout
		};
		return {
			responseError: function responseError(response) {
				$rootScope.$broadcast(statusDict[response.status], response);
				return $q.reject(response);
			}
		};
	});

	app.config(function ($httpProvider) {
		$httpProvider.interceptors.push(['$injector', function ($injector) {
			return $injector.get('AuthInterceptor');
		}]);
	});

	app.service('AuthService', function ($http, Session, $rootScope, AUTH_EVENTS, $q) {

		function onSuccessfulLogin(response) {
			var user = response.data.user;
			Session.create(user);
			$rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
			return user;
		}

		// Uses the session factory to see if an
		// authenticated user is currently registered.
		this.isAuthenticated = function () {
			return !!Session.user;
		};

		this.getLoggedInUser = function (fromServer) {

			// If an authenticated session exists, we
			// return the user attached to that session
			// with a promise. This ensures that we can
			// always interface with this method asynchronously.

			// Optionally, if true is given as the fromServer parameter,
			// then this cached value will not be used.

			if (this.isAuthenticated() && fromServer !== true) {
				return $q.when(Session.user);
			}

			// Make request GET /session.
			// If it returns a user, call onSuccessfulLogin with the response.
			// If it returns a 401 response, we catch it and instead resolve to null.
			return $http.get('/session').then(onSuccessfulLogin).catch(function () {
				return null;
			});
		};

		this.login = function (credentials) {
			return $http.post('/login', credentials).then(onSuccessfulLogin).catch(function () {
				return $q.reject({ message: 'Invalid login credentials.' });
			});
		};

		this.logout = function () {
			return $http.get('/logout').then(function () {
				Session.destroy();
				$rootScope.$broadcast(AUTH_EVENTS.logoutSuccess);
			});
		};
	});

	app.service('Session', function ($rootScope, AUTH_EVENTS) {

		var self = this;

		$rootScope.$on(AUTH_EVENTS.notAuthenticated, function () {
			self.destroy();
		});

		$rootScope.$on(AUTH_EVENTS.sessionTimeout, function () {
			self.destroy();
		});

		this.user = null;

		this.create = function (user) {
			this.user = user;
		};

		this.destroy = function () {
			this.user = null;
		};
	});
})();

app.directive('navbar', function () {
	return {
		restrict: 'E',
		templateUrl: 'js/directives/navbar/navbar.html'
	};
});

app.controller('TabMenuController', function ($scope, UserFactory) {
	$scope.teamId = UserFactory.getSelectedTeamID();

	$scope.leagueId = UserFactory.getSelectedLeagueID();
});
app.directive('tabmenu', function () {
	return {
		restrict: 'E',
		templateUrl: 'js/directives/tabMenu/tabMenu.html',
		controller: 'TabMenuController'
	};
});

app.factory('CookieFactory', function () {

	var cookieObj = {};

	function isCookie() {
		if (document.cookie) {
			parseUserInfo();
			return true;
		} else {
			return false;
		}
	}

	function setCookie(loginInfo) {
		cookieObj.email = loginInfo.email;
		cookieObj.password = loginInfo.password;
		document.cookie = 'userInfoJSON=' + JSON.stringify(cookieObj);
		resetCookieExpire();
	}

	function resetCookieExpire() {
		var currentDate = new Date();
		var expireDate = new Date(currentDate.setMonth(currentDate.getMonth() + 6));
		document.cookie = 'expires=' + expireDate.toUTCString();
	}

	function getCookie() {
		return cookieObj;
	}

	function parseUserInfo() {
		var parseInfo = document.cookie.split('=');
		var userInfo = parseInfo[1].split(';')[0];
		cookieObj = JSON.parse(userInfo);
	}

	return {
		isCookie: isCookie,
		setCookie: setCookie,
		getCookie: getCookie
	};
});

app.controller('LeagueCtrl', function ($scope, $http, LeagueFactory, TeamFactory) {

	$scope.tab = { league: 'active' };

	LeagueFactory.getLeagueTeamsFromServer();

	$scope.getLeagueTeams = LeagueFactory.getLeagueTeams;
});

app.factory('LeagueFactory', function ($http, $stateParams, TeamFactory) {

	var leagueTeams = void 0;

	function getLeagueTeamsFromServer() {
		$http.get('/api/league/' + $stateParams.id + '/teams').then(function (response) {
			leagueTeams = response.data;
			console.log(leagueTeams);
		});
	}

	function updateLeagueTeams() {
		leagueTeams.forEach(function (team) {
			team.totalWins = TeamFactory.getTeamTotalWins(team.teams);
		});
	}

	function getLeagueTeams() {
		console.log(leagueTeams);
		updateLeagueTeams();
		return leagueTeams;
	}

	return {
		getLeagueTeamsFromServer: getLeagueTeamsFromServer,
		getLeagueTeams: getLeagueTeams
	};
});

app.config(function ($stateProvider) {
	$stateProvider.state('league', {
		url: '/league/:id',
		templateUrl: 'js/views/league/league.html',
		controller: 'LeagueCtrl'
	});
});

app.config(function ($stateProvider) {

	$stateProvider.state('login', {
		url: '/login',
		templateUrl: 'js/views/login/login.html',
		controller: 'LoginCtrl'
	});
});

app.controller('LoginCtrl', function ($scope, LoginFactory, CookieFactory, NBA_League_Factory) {
	$scope.login = {};
	$scope.error = null;
	$scope.isLoginState = function () {
		return true;
	};

	NBA_League_Factory.kickOffNBATeamWinGetter(); // Start right when we hit the login page

	function sendLoginNow(loginInfo) {

		$scope.error = null;
		LoginFactory.sendLogin(loginInfo).catch(function () {
			$scope.error = 'Invalid login credentials.';
		});
	}

	function guestLogin() {
		sendLoginNow({ email: 'joey@joey.com', password: 'joey' });
	}

	$scope.sendLogin = sendLoginNow;
	$scope.guestLogin = guestLogin;

	if (CookieFactory.isCookie()) {
		sendLoginNow(CookieFactory.getCookie());
	}
});

app.factory('LoginFactory', function (AuthService, $state, UserFactory, CookieFactory) {

	function sendLogin(loginInfo) {
		return AuthService.login(loginInfo).then(function () {
			return CookieFactory.setCookie(loginInfo);
		}).then(function () {
			return UserFactory.initUserFactory();
		}).then(function () {
			$state.go('user');
		});
	}

	return {
		sendLogin: sendLogin
	};
});

app.controller('NBA_Ctrl', function ($scope, NBA_League_Factory) {

	$scope.tab = { nbaStandings: 'active' };

	$scope.nbaTeamsInfo = NBA_League_Factory.getNBATeamInfo;
});

app.factory('NBA_League_Factory', function ($http, $log) {

	var nbaTeamInfo = [];
	var nbaTeamInfoObj = {};

	function scrapeESPNhtml(nbaPage) {
		var teamTokenizer = '<span class="team-names">';
		var teamTokens = nbaPage.split(teamTokenizer);

		// Clear old data
		nbaTeamInfo = [];
		nbaTeamInfoObj = {};

		// Populate nba team info objects
		for (var i = 1; i < teamTokens.length; i++) {
			// starting at 1 here because the first token is garbage
			nbaTeamInfo.push(parseTeamInfo(teamTokens[i]));
			nbaTeamInfoObj[nbaTeamInfo[i - 1].abbr] = nbaTeamInfo[i - 1].wins;
		}
	}

	function parseTeamInfo(teamInfoStr) {

		var teamInfo = {};
		// Parse team name
		var endOfTeamNameLoc = teamInfoStr.indexOf('</span>');
		teamInfo.name = teamInfoStr.slice(0, endOfTeamNameLoc);

		// Parse abbreviated team name
		var abbrTagStart = '<abbr title="' + teamInfo.name + '">';
		var abbrTagEnd = '</abbr>';
		teamInfo.abbr = teamInfoStr.slice(teamInfoStr.indexOf(abbrTagStart) + abbrTagStart.length, teamInfoStr.indexOf(abbrTagEnd));

		// Parse team wins
		var winsArr = teamInfoStr.split('class="">');
		var wins = winsArr[1].slice(0, winsArr[1].indexOf('</td>'));
		teamInfo.wins = wins;

		return teamInfo;
	}

	// ESPN NBA Webscraper for NBA team league info
	// Input: 	Desired year of NBA team league information in the format of XXXX
	// Output: 	An array of all NBA teams in the following format:
	//				{ 	name: 'NBA Team Name',
	//					abbr: 'NBA Team Name Abbreviation',
	//					wins: 'NBA Team Wins for year XXXX ' }
	// notes: ESPN only provides info dating back to 2002.

	function getNBATeamInfoFromESPN() {

		var year = 2017; // Right now just set to get current year

		var host = 'http://www.espn.com';
		var espnPath = year >= new Date().getFullYear() || year <= 2002 ? '/nba/standings/_/group/league' : '/nba/standings/_/season/' + year + '/group/league';

		$http.get(host + espnPath).then(function (espnNBAPage) {
			scrapeESPNhtml(espnNBAPage.data);
		}).catch(console.error);
	}

	function kickOffNBATeamWinGetter() {
		getNBATeamInfoFromESPN(); // Kick it off right away so we have data to display
		setInterval(getNBATeamInfoFromESPN, 60000); // Then update once a minute
	}

	return {
		getNBATeamInfo: function getNBATeamInfo() {
			return nbaTeamInfo;
		},
		getNBATeamInfoObj: function getNBATeamInfoObj() {
			return nbaTeamInfoObj;
		},
		kickOffNBATeamWinGetter: kickOffNBATeamWinGetter
	};
});

app.config(function ($stateProvider) {
	$stateProvider.state('nbaLeague', {
		url: '/nba-standings',
		templateUrl: 'js/views/nba-league/nba.league.html',
		controller: 'NBA_Ctrl'
	});
});

app.controller('TeamCtrl', function ($scope, TeamFactory) {
	$scope.tab = { team: 'active' };

	// Setup to live update when each ESPN scrape
	TeamFactory.getTeamFromServer();
	$scope.getNBATeams = TeamFactory.getNBATeams;
	$scope.getNBATeamWins = TeamFactory.getNBATeamWins;
	$scope.getTeamTotalWins = TeamFactory.getTeamTotalWins;
});

app.factory('TeamFactory', function ($http, $stateParams, $log, NBA_League_Factory) {

	var NBAteams = [];

	function getTeamFromServer() {

		$http.get('api/team/' + $stateParams.id + '/nba_teams').then(function (response) {
			NBAteams = response.data;
		}).catch($log);
	}

	function updateNBATeams() {
		NBAteams.forEach(function (team) {
			team.wins = getNBATeamWins(team.abbr);
		});
	}

	function getNBATeamWins(abbr) {
		var liveNBATeamInfoObj = NBA_League_Factory.getNBATeamInfoObj();
		return liveNBATeamInfoObj[abbr];
	}

	function getTeamTotalWins(teams) {

		var sum = 0;
		var liveNBATeamInfoObj = NBA_League_Factory.getNBATeamInfoObj();

		teams.forEach(function (team) {
			sum += Number(liveNBATeamInfoObj[team.abbr]);
		});

		return sum;
	}

	// Doing this to allow for sorting the teams by wins
	function getNBATeams() {
		updateNBATeams();
		return NBAteams;
	}

	return {
		getNBATeams: getNBATeams,
		getTeamTotalWins: getTeamTotalWins,
		getTeamFromServer: getTeamFromServer
	};
});

app.config(function ($stateProvider) {

	$stateProvider.state('team', {
		url: '/team/:id',
		templateUrl: 'js/views/team/team.html',
		controller: 'TeamCtrl'
	});
});

app.controller('UserCtrl', function ($scope, UserFactory) {

	$scope.tab = { home: 'active' };

	$scope.userTeams = UserFactory.getUserTeams();

	$scope.selectedTeamID = UserFactory.getSelectedTeamID();

	$scope.selectedLeagueID = UserFactory.getSelectedLeagueID();
});

app.factory('UserFactory', function ($http, Session, $log) {

	var userTeams = [];
	var userSelectedTeamID = undefined;
	var userSelectedLeagueID = undefined;

	function initUserFactory() {
		return $http.get('api/team/user/' + Session.user.id).then(function (response) {
			userTeams = response.data;
			// Intialize these to first team and league to start
			userSelectedTeamID = userTeams[0].id;
			userSelectedLeagueID = userTeams[0].league.id;
		}).catch($log);
	}

	return {
		initUserFactory: initUserFactory,
		getUserTeams: function getUserTeams() {
			return userTeams;
		},
		getSelectedTeamID: function getSelectedTeamID() {
			return userSelectedTeamID;
		},
		getSelectedLeagueID: function getSelectedLeagueID() {
			return userSelectedLeagueID;
		}
	};
});

app.config(function ($stateProvider) {

	$stateProvider.state('user', {
		url: '/user',
		templateUrl: 'js/views/user/user.html',
		controller: 'UserCtrl'
	});
});
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsInByZS1idWlsdC9wcmUtYnVpbHQuanMiLCJkaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuanMiLCJkaXJlY3RpdmVzL3RhYk1lbnUvdGFiTWVudS5jb250cm9sbGVyLmpzIiwiZGlyZWN0aXZlcy90YWJNZW51L3RhYk1lbnUuanMiLCJ2aWV3cy9jb29raWVzL2Nvb2tpZUZhY3RvcnkuanMiLCJ2aWV3cy9sZWFndWUvbGVhZ3VlLmNvbnRyb2xsZXIuanMiLCJ2aWV3cy9sZWFndWUvbGVhZ3VlLmZhY3RvcnkuanMiLCJ2aWV3cy9sZWFndWUvbGVhZ3VlLnN0YXRlLmpzIiwidmlld3MvbG9naW4vbG9naW4uc3RhdGUuanMiLCJ2aWV3cy9sb2dpbi9sb2dpbkNvbnRyb2xsZXIuanMiLCJ2aWV3cy9sb2dpbi9sb2dpbkZhY3RvcnkuanMiLCJ2aWV3cy9uYmEtbGVhZ3VlL25iYS5sZWFndWUuY29udHJvbGxlci5qcyIsInZpZXdzL25iYS1sZWFndWUvbmJhLmxlYWd1ZS5mYWN0b3J5LmpzIiwidmlld3MvbmJhLWxlYWd1ZS9uYmEubGVhZ3VlLnN0YXRlLmpzIiwidmlld3MvdGVhbS90ZWFtLmNvbnRyb2xsZXIuanMiLCJ2aWV3cy90ZWFtL3RlYW0uZmFjdG9yeS5qcyIsInZpZXdzL3RlYW0vdGVhbS5zdGF0ZS5qcyIsInZpZXdzL3VzZXIvdXNlci5jb250cm9sbGVyLmpzIiwidmlld3MvdXNlci91c2VyLmZhY3RvcnkuanMiLCJ2aWV3cy91c2VyL3VzZXIuc3RhdGUuanMiXSwibmFtZXMiOlsid2luZG93IiwiYXBwIiwiYW5ndWxhciIsIm1vZHVsZSIsImNvbmZpZyIsIiR1cmxSb3V0ZXJQcm92aWRlciIsIiRsb2NhdGlvblByb3ZpZGVyIiwiaHRtbDVNb2RlIiwib3RoZXJ3aXNlIiwid2hlbiIsImxvY2F0aW9uIiwicmVsb2FkIiwicnVuIiwiJHJvb3RTY29wZSIsIiRvbiIsImV2ZW50IiwidG9TdGF0ZSIsInRvUGFyYW1zIiwiZnJvbVN0YXRlIiwiZnJvbVBhcmFtcyIsInRocm93bkVycm9yIiwiY29uc29sZSIsImluZm8iLCJuYW1lIiwiZXJyb3IiLCJBdXRoU2VydmljZSIsIiRzdGF0ZSIsImRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGgiLCJzdGF0ZSIsImRhdGEiLCJhdXRoZW50aWNhdGUiLCJpc0F1dGhlbnRpY2F0ZWQiLCJwcmV2ZW50RGVmYXVsdCIsImdldExvZ2dlZEluVXNlciIsInRoZW4iLCJ1c2VyIiwiZ28iLCJFcnJvciIsImNvbnN0YW50IiwibG9naW5TdWNjZXNzIiwibG9naW5GYWlsZWQiLCJsb2dvdXRTdWNjZXNzIiwic2Vzc2lvblRpbWVvdXQiLCJub3RBdXRoZW50aWNhdGVkIiwibm90QXV0aG9yaXplZCIsImZhY3RvcnkiLCIkcSIsIkFVVEhfRVZFTlRTIiwic3RhdHVzRGljdCIsInJlc3BvbnNlRXJyb3IiLCJyZXNwb25zZSIsIiRicm9hZGNhc3QiLCJzdGF0dXMiLCJyZWplY3QiLCIkaHR0cFByb3ZpZGVyIiwiaW50ZXJjZXB0b3JzIiwicHVzaCIsIiRpbmplY3RvciIsImdldCIsInNlcnZpY2UiLCIkaHR0cCIsIlNlc3Npb24iLCJvblN1Y2Nlc3NmdWxMb2dpbiIsImNyZWF0ZSIsImZyb21TZXJ2ZXIiLCJjYXRjaCIsImxvZ2luIiwiY3JlZGVudGlhbHMiLCJwb3N0IiwibWVzc2FnZSIsImxvZ291dCIsImRlc3Ryb3kiLCJzZWxmIiwiZGlyZWN0aXZlIiwicmVzdHJpY3QiLCJ0ZW1wbGF0ZVVybCIsImNvbnRyb2xsZXIiLCIkc2NvcGUiLCJVc2VyRmFjdG9yeSIsInRlYW1JZCIsImdldFNlbGVjdGVkVGVhbUlEIiwibGVhZ3VlSWQiLCJnZXRTZWxlY3RlZExlYWd1ZUlEIiwiY29va2llT2JqIiwiaXNDb29raWUiLCJkb2N1bWVudCIsImNvb2tpZSIsInBhcnNlVXNlckluZm8iLCJzZXRDb29raWUiLCJsb2dpbkluZm8iLCJlbWFpbCIsInBhc3N3b3JkIiwiSlNPTiIsInN0cmluZ2lmeSIsInJlc2V0Q29va2llRXhwaXJlIiwiY3VycmVudERhdGUiLCJEYXRlIiwiZXhwaXJlRGF0ZSIsInNldE1vbnRoIiwiZ2V0TW9udGgiLCJ0b1VUQ1N0cmluZyIsImdldENvb2tpZSIsInBhcnNlSW5mbyIsInNwbGl0IiwidXNlckluZm8iLCJwYXJzZSIsIkxlYWd1ZUZhY3RvcnkiLCJUZWFtRmFjdG9yeSIsInRhYiIsImxlYWd1ZSIsImdldExlYWd1ZVRlYW1zRnJvbVNlcnZlciIsImdldExlYWd1ZVRlYW1zIiwiJHN0YXRlUGFyYW1zIiwibGVhZ3VlVGVhbXMiLCJpZCIsImxvZyIsInVwZGF0ZUxlYWd1ZVRlYW1zIiwiZm9yRWFjaCIsInRlYW0iLCJ0b3RhbFdpbnMiLCJnZXRUZWFtVG90YWxXaW5zIiwidGVhbXMiLCIkc3RhdGVQcm92aWRlciIsInVybCIsIkxvZ2luRmFjdG9yeSIsIkNvb2tpZUZhY3RvcnkiLCJOQkFfTGVhZ3VlX0ZhY3RvcnkiLCJpc0xvZ2luU3RhdGUiLCJraWNrT2ZmTkJBVGVhbVdpbkdldHRlciIsInNlbmRMb2dpbk5vdyIsInNlbmRMb2dpbiIsImd1ZXN0TG9naW4iLCJpbml0VXNlckZhY3RvcnkiLCJuYmFTdGFuZGluZ3MiLCJuYmFUZWFtc0luZm8iLCJnZXROQkFUZWFtSW5mbyIsIiRsb2ciLCJuYmFUZWFtSW5mbyIsIm5iYVRlYW1JbmZvT2JqIiwic2NyYXBlRVNQTmh0bWwiLCJuYmFQYWdlIiwidGVhbVRva2VuaXplciIsInRlYW1Ub2tlbnMiLCJpIiwibGVuZ3RoIiwicGFyc2VUZWFtSW5mbyIsImFiYnIiLCJ3aW5zIiwidGVhbUluZm9TdHIiLCJ0ZWFtSW5mbyIsImVuZE9mVGVhbU5hbWVMb2MiLCJpbmRleE9mIiwic2xpY2UiLCJhYmJyVGFnU3RhcnQiLCJhYmJyVGFnRW5kIiwid2luc0FyciIsImdldE5CQVRlYW1JbmZvRnJvbUVTUE4iLCJ5ZWFyIiwiaG9zdCIsImVzcG5QYXRoIiwiZ2V0RnVsbFllYXIiLCJlc3BuTkJBUGFnZSIsInNldEludGVydmFsIiwiZ2V0TkJBVGVhbUluZm9PYmoiLCJnZXRUZWFtRnJvbVNlcnZlciIsImdldE5CQVRlYW1zIiwiZ2V0TkJBVGVhbVdpbnMiLCJOQkF0ZWFtcyIsInVwZGF0ZU5CQVRlYW1zIiwibGl2ZU5CQVRlYW1JbmZvT2JqIiwic3VtIiwiTnVtYmVyIiwiaG9tZSIsInVzZXJUZWFtcyIsImdldFVzZXJUZWFtcyIsInNlbGVjdGVkVGVhbUlEIiwic2VsZWN0ZWRMZWFndWVJRCIsInVzZXJTZWxlY3RlZFRlYW1JRCIsInVuZGVmaW5lZCIsInVzZXJTZWxlY3RlZExlYWd1ZUlEIl0sIm1hcHBpbmdzIjoiQUFBQTs7QUFDQUEsT0FBQUMsR0FBQSxHQUFBQyxRQUFBQyxNQUFBLENBQUEsZ0JBQUEsRUFBQSxDQUFBLFVBQUEsRUFBQSxXQUFBLENBQUEsQ0FBQTs7QUFFQUYsSUFBQUcsTUFBQSxDQUFBLFVBQUFDLGtCQUFBLEVBQUFDLGlCQUFBLEVBQUE7QUFDQTtBQUNBQSxtQkFBQUMsU0FBQSxDQUFBLElBQUE7QUFDQTtBQUNBRixvQkFBQUcsU0FBQSxDQUFBLFFBQUE7QUFDQTtBQUNBSCxvQkFBQUksSUFBQSxDQUFBLGlCQUFBLEVBQUEsWUFBQTtBQUNBVCxTQUFBVSxRQUFBLENBQUFDLE1BQUE7QUFDQSxFQUZBO0FBR0EsQ0FUQTs7QUFXQTtBQUNBVixJQUFBVyxHQUFBLENBQUEsVUFBQUMsVUFBQSxFQUFBO0FBQ0FBLFlBQUFDLEdBQUEsQ0FBQSxtQkFBQSxFQUFBLFVBQUFDLEtBQUEsRUFBQUMsT0FBQSxFQUFBQyxRQUFBLEVBQUFDLFNBQUEsRUFBQUMsVUFBQSxFQUFBQyxXQUFBLEVBQUE7QUFDQUMsVUFBQUMsSUFBQSxnRkFBQU4sUUFBQU8sSUFBQTtBQUNBRixVQUFBRyxLQUFBLENBQUFKLFdBQUE7QUFDQSxFQUhBO0FBSUEsQ0FMQTs7QUFPQTtBQUNBbkIsSUFBQVcsR0FBQSxDQUFBLFVBQUFDLFVBQUEsRUFBQVksV0FBQSxFQUFBQyxNQUFBLEVBQUE7O0FBRUE7QUFDQSxLQUFBQywrQkFBQSxTQUFBQSw0QkFBQSxDQUFBQyxLQUFBLEVBQUE7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QUFKQSxFQUFBO0FBT0EsQ0F4QkE7O0FDQUFsTCxJQUFBRyxNQUFBLENBQUEsVUFBQXNILGNBQUEsRUFBQTs7QUFFQUEsZ0JBQUE5RixLQUFBLENBQUEsTUFBQSxFQUFBO0FBQ0ErRixPQUFBLE9BREE7QUFFQWhELGVBQUEseUJBRkE7QUFHQUMsY0FBQTtBQUhBLEVBQUE7QUFNQSxDQVJBIiwiZmlsZSI6Im1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG53aW5kb3cuYXBwID0gYW5ndWxhci5tb2R1bGUoJ05CQV9QaWNrZW1fQXBwJywgWydwcmVCdWlsdCcsICd1aS5yb3V0ZXInXSk7XG5cbmFwcC5jb25maWcoZnVuY3Rpb24gKCR1cmxSb3V0ZXJQcm92aWRlciwgJGxvY2F0aW9uUHJvdmlkZXIpIHtcbiAgICAvLyBUaGlzIHR1cm5zIG9mZiBoYXNoYmFuZyB1cmxzICgvI2Fib3V0KSBhbmQgY2hhbmdlcyBpdCB0byBzb21ldGhpbmcgbm9ybWFsICgvYWJvdXQpXG4gICAgJGxvY2F0aW9uUHJvdmlkZXIuaHRtbDVNb2RlKHRydWUpO1xuICAgIC8vIElmIHdlIGdvIHRvIGEgVVJMIHRoYXQgdWktcm91dGVyIGRvZXNuJ3QgaGF2ZSByZWdpc3RlcmVkLCBnbyB0byB0aGUgXCIvXCIgdXJsLlxuICAgICR1cmxSb3V0ZXJQcm92aWRlci5vdGhlcndpc2UoJy9sb2dpbicpO1xuICAgIC8vIFRyaWdnZXIgcGFnZSByZWZyZXNoIHdoZW4gYWNjZXNzaW5nIGFuIE9BdXRoIHJvdXRlXG4gICAgJHVybFJvdXRlclByb3ZpZGVyLndoZW4oJy9hdXRoLzpwcm92aWRlcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xuICAgIH0pO1xufSk7XG5cbi8vIFRoaXMgYXBwLnJ1biBpcyBmb3IgbGlzdGVuaW5nIHRvIGVycm9ycyBicm9hZGNhc3RlZCBieSB1aS1yb3V0ZXIsIHVzdWFsbHkgb3JpZ2luYXRpbmcgZnJvbSByZXNvbHZlc1xuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSkge1xuICAgICRyb290U2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VFcnJvcicsIGZ1bmN0aW9uIChldmVudCwgdG9TdGF0ZSwgdG9QYXJhbXMsIGZyb21TdGF0ZSwgZnJvbVBhcmFtcywgdGhyb3duRXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5pbmZvKGBUaGUgZm9sbG93aW5nIGVycm9yIHdhcyB0aHJvd24gYnkgdWktcm91dGVyIHdoaWxlIHRyYW5zaXRpb25pbmcgdG8gc3RhdGUgXCIke3RvU3RhdGUubmFtZX1cIi4gVGhlIG9yaWdpbiBvZiB0aGlzIGVycm9yIGlzIHByb2JhYmx5IGEgcmVzb2x2ZSBmdW5jdGlvbjpgKTtcbiAgICAgICAgY29uc29sZS5lcnJvcih0aHJvd25FcnJvcik7XG4gICAgfSk7XG59KTtcblxuLy8gVGhpcyBhcHAucnVuIGlzIGZvciBjb250cm9sbGluZyBhY2Nlc3MgdG8gc3BlY2lmaWMgc3RhdGVzLlxuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuXG4gICAgLy8gVGhlIGdpdmVuIHN0YXRlIHJlcXVpcmVzIGFuIGF1dGhlbnRpY2F0ZWQgdXNlci5cbiAgICB2YXIgZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICByZXR1cm4gc3RhdGUuZGF0YSAmJiBzdGF0ZS5kYXRhLmF1dGhlbnRpY2F0ZTtcbiAgICB9O1xuXG4gICAgLy8gJHN0YXRlQ2hhbmdlU3RhcnQgaXMgYW4gZXZlbnQgZmlyZWRcbiAgICAvLyB3aGVuZXZlciB0aGUgcHJvY2VzcyBvZiBjaGFuZ2luZyBhIHN0YXRlIGJlZ2lucy5cbiAgICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlU3RhcnQnLCBmdW5jdGlvbiAoZXZlbnQsIHRvU3RhdGUsIHRvUGFyYW1zKSB7XG5cbiAgICAgICAgaWYgKCFkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoKHRvU3RhdGUpKSB7XG4gICAgICAgICAgICAvLyBUaGUgZGVzdGluYXRpb24gc3RhdGUgZG9lcyBub3QgcmVxdWlyZSBhdXRoZW50aWNhdGlvblxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSkge1xuICAgICAgICAgICAgLy8gVGhlIHVzZXIgaXMgYXV0aGVudGljYXRlZC5cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYW5jZWwgbmF2aWdhdGluZyB0byBuZXcgc3RhdGUuXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgLy8gSWYgYSB1c2VyIGlzIHJldHJpZXZlZCwgdGhlbiByZW5hdmlnYXRlIHRvIHRoZSBkZXN0aW5hdGlvblxuICAgICAgICAgICAgLy8gKHRoZSBzZWNvbmQgdGltZSwgQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkgd2lsbCB3b3JrKVxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlLCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbiwgZ28gdG8gXCJsb2dpblwiIHN0YXRlLlxuICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28odG9TdGF0ZS5uYW1lLCB0b1BhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbygnbG9naW4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9KTtcblxufSk7XG4iLCIoZnVuY3Rpb24gKCkge1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLy8gSG9wZSB5b3UgZGlkbid0IGZvcmdldCBBbmd1bGFyISBEdWgtZG95LlxuICAgIGlmICghd2luZG93LmFuZ3VsYXIpIHRocm93IG5ldyBFcnJvcignSSBjYW5cXCd0IGZpbmQgQW5ndWxhciEnKTtcblxuICAgIHZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgncHJlQnVpbHQnLCBbXSk7XG5cbiAgICAvLyBhcHAuZmFjdG9yeSgnU29ja2V0JywgZnVuY3Rpb24gKCkge1xuICAgIC8vICAgICBpZiAoIXdpbmRvdy5pbykgdGhyb3cgbmV3IEVycm9yKCdzb2NrZXQuaW8gbm90IGZvdW5kIScpO1xuICAgIC8vICAgICByZXR1cm4gd2luZG93LmlvKHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4pO1xuICAgIC8vIH0pO1xuXG4gICAgLy8gQVVUSF9FVkVOVFMgaXMgdXNlZCB0aHJvdWdob3V0IG91ciBhcHAgdG9cbiAgICAvLyBicm9hZGNhc3QgYW5kIGxpc3RlbiBmcm9tIGFuZCB0byB0aGUgJHJvb3RTY29wZVxuICAgIC8vIGZvciBpbXBvcnRhbnQgZXZlbnRzIGFib3V0IGF1dGhlbnRpY2F0aW9uIGZsb3cuXG4gICAgYXBwLmNvbnN0YW50KCdBVVRIX0VWRU5UUycsIHtcbiAgICAgICAgbG9naW5TdWNjZXNzOiAnYXV0aC1sb2dpbi1zdWNjZXNzJyxcbiAgICAgICAgbG9naW5GYWlsZWQ6ICdhdXRoLWxvZ2luLWZhaWxlZCcsXG4gICAgICAgIGxvZ291dFN1Y2Nlc3M6ICdhdXRoLWxvZ291dC1zdWNjZXNzJyxcbiAgICAgICAgc2Vzc2lvblRpbWVvdXQ6ICdhdXRoLXNlc3Npb24tdGltZW91dCcsXG4gICAgICAgIG5vdEF1dGhlbnRpY2F0ZWQ6ICdhdXRoLW5vdC1hdXRoZW50aWNhdGVkJyxcbiAgICAgICAgbm90QXV0aG9yaXplZDogJ2F1dGgtbm90LWF1dGhvcml6ZWQnXG4gICAgfSk7XG5cbiAgICBhcHAuZmFjdG9yeSgnQXV0aEludGVyY2VwdG9yJywgZnVuY3Rpb24gKCRyb290U2NvcGUsICRxLCBBVVRIX0VWRU5UUykge1xuICAgICAgICB2YXIgc3RhdHVzRGljdCA9IHtcbiAgICAgICAgICAgIDQwMTogQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCxcbiAgICAgICAgICAgIDQwMzogQVVUSF9FVkVOVFMubm90QXV0aG9yaXplZCxcbiAgICAgICAgICAgIDQxOTogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsXG4gICAgICAgICAgICA0NDA6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZUVycm9yOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3Qoc3RhdHVzRGljdFtyZXNwb25zZS5zdGF0dXNdLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdChyZXNwb25zZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9KTtcblxuICAgIGFwcC5jb25maWcoZnVuY3Rpb24gKCRodHRwUHJvdmlkZXIpIHtcbiAgICAgICAgJGh0dHBQcm92aWRlci5pbnRlcmNlcHRvcnMucHVzaChbXG4gICAgICAgICAgICAnJGluamVjdG9yJyxcbiAgICAgICAgICAgIGZ1bmN0aW9uICgkaW5qZWN0b3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJGluamVjdG9yLmdldCgnQXV0aEludGVyY2VwdG9yJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIF0pO1xuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ0F1dGhTZXJ2aWNlJywgZnVuY3Rpb24gKCRodHRwLCBTZXNzaW9uLCAkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUywgJHEpIHtcblxuICAgICAgICBmdW5jdGlvbiBvblN1Y2Nlc3NmdWxMb2dpbihyZXNwb25zZSkge1xuICAgICAgICAgICAgdmFyIHVzZXIgPSByZXNwb25zZS5kYXRhLnVzZXI7XG4gICAgICAgICAgICBTZXNzaW9uLmNyZWF0ZSh1c2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MpO1xuICAgICAgICAgICAgcmV0dXJuIHVzZXI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVc2VzIHRoZSBzZXNzaW9uIGZhY3RvcnkgdG8gc2VlIGlmIGFuXG4gICAgICAgIC8vIGF1dGhlbnRpY2F0ZWQgdXNlciBpcyBjdXJyZW50bHkgcmVnaXN0ZXJlZC5cbiAgICAgICAgdGhpcy5pc0F1dGhlbnRpY2F0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gISFTZXNzaW9uLnVzZXI7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5nZXRMb2dnZWRJblVzZXIgPSBmdW5jdGlvbiAoZnJvbVNlcnZlcikge1xuXG4gICAgICAgICAgICAvLyBJZiBhbiBhdXRoZW50aWNhdGVkIHNlc3Npb24gZXhpc3RzLCB3ZVxuICAgICAgICAgICAgLy8gcmV0dXJuIHRoZSB1c2VyIGF0dGFjaGVkIHRvIHRoYXQgc2Vzc2lvblxuICAgICAgICAgICAgLy8gd2l0aCBhIHByb21pc2UuIFRoaXMgZW5zdXJlcyB0aGF0IHdlIGNhblxuICAgICAgICAgICAgLy8gYWx3YXlzIGludGVyZmFjZSB3aXRoIHRoaXMgbWV0aG9kIGFzeW5jaHJvbm91c2x5LlxuXG4gICAgICAgICAgICAvLyBPcHRpb25hbGx5LCBpZiB0cnVlIGlzIGdpdmVuIGFzIHRoZSBmcm9tU2VydmVyIHBhcmFtZXRlcixcbiAgICAgICAgICAgIC8vIHRoZW4gdGhpcyBjYWNoZWQgdmFsdWUgd2lsbCBub3QgYmUgdXNlZC5cblxuICAgICAgICAgICAgaWYgKHRoaXMuaXNBdXRoZW50aWNhdGVkKCkgJiYgZnJvbVNlcnZlciAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAkcS53aGVuKFNlc3Npb24udXNlcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE1ha2UgcmVxdWVzdCBHRVQgL3Nlc3Npb24uXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgdXNlciwgY2FsbCBvblN1Y2Nlc3NmdWxMb2dpbiB3aXRoIHRoZSByZXNwb25zZS5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSA0MDEgcmVzcG9uc2UsIHdlIGNhdGNoIGl0IGFuZCBpbnN0ZWFkIHJlc29sdmUgdG8gbnVsbC5cbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9zZXNzaW9uJykudGhlbihvblN1Y2Nlc3NmdWxMb2dpbikuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxvZ2luID0gZnVuY3Rpb24gKGNyZWRlbnRpYWxzKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAucG9zdCgnL2xvZ2luJywgY3JlZGVudGlhbHMpXG4gICAgICAgICAgICAgICAgLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdCh7IG1lc3NhZ2U6ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLicgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvbG9nb3V0JykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgU2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxuICAgIGFwcC5zZXJ2aWNlKCdTZXNzaW9uJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIEFVVEhfRVZFTlRTKSB7XG5cbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMudXNlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jcmVhdGUgPSBmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgdGhpcy51c2VyID0gdXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnVzZXIgPSBudWxsO1xuICAgICAgICB9O1xuXG4gICAgfSk7XG5cbn0oKSk7XG4iLCJhcHAuZGlyZWN0aXZlKCduYXZiYXInLCBmdW5jdGlvbigpe1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnRScsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuaHRtbCcsXG5cdH1cbn0pO1xuIiwiYXBwLmNvbnRyb2xsZXIoJ1RhYk1lbnVDb250cm9sbGVyJywgZnVuY3Rpb24oJHNjb3BlLCBVc2VyRmFjdG9yeSl7XG5cdCRzY29wZS50ZWFtSWQgPSBVc2VyRmFjdG9yeS5nZXRTZWxlY3RlZFRlYW1JRCgpO1xuXG5cdCRzY29wZS5sZWFndWVJZCA9IFVzZXJGYWN0b3J5LmdldFNlbGVjdGVkTGVhZ3VlSUQoKTtcbn0pOyIsImFwcC5kaXJlY3RpdmUoJ3RhYm1lbnUnLCBmdW5jdGlvbigpe1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnRScsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy9kaXJlY3RpdmVzL3RhYk1lbnUvdGFiTWVudS5odG1sJyxcblx0XHRjb250cm9sbGVyOiAnVGFiTWVudUNvbnRyb2xsZXInXG5cdH1cbn0pO1xuIiwiYXBwLmZhY3RvcnkoICdDb29raWVGYWN0b3J5JywgZnVuY3Rpb24oKXtcblxuXHRsZXQgY29va2llT2JqID0ge307XG5cblx0ZnVuY3Rpb24gaXNDb29raWUoKXtcblx0XHRpZiAoIGRvY3VtZW50LmNvb2tpZSApe1xuXHRcdFx0cGFyc2VVc2VySW5mbygpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHNldENvb2tpZShsb2dpbkluZm8pe1xuXHRcdGNvb2tpZU9iai5lbWFpbCA9IGxvZ2luSW5mby5lbWFpbDtcblx0XHRjb29raWVPYmoucGFzc3dvcmQgPSBsb2dpbkluZm8ucGFzc3dvcmQ7XG5cdFx0ZG9jdW1lbnQuY29va2llID0gJ3VzZXJJbmZvSlNPTj0nICsgSlNPTi5zdHJpbmdpZnkoIGNvb2tpZU9iaiApO1xuXHRcdHJlc2V0Q29va2llRXhwaXJlKCk7XG5cdH1cblxuXHRmdW5jdGlvbiByZXNldENvb2tpZUV4cGlyZSgpe1xuXHRcdGxldCBjdXJyZW50RGF0ZSA9IG5ldyBEYXRlKCk7XG5cdFx0bGV0IGV4cGlyZURhdGUgPSBuZXcgRGF0ZSggY3VycmVudERhdGUuc2V0TW9udGgoIGN1cnJlbnREYXRlLmdldE1vbnRoKCkgKyA2KSk7XG5cdFx0ZG9jdW1lbnQuY29va2llID0gJ2V4cGlyZXM9JyArIGV4cGlyZURhdGUudG9VVENTdHJpbmcoKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldENvb2tpZSgpe1xuXHRcdHJldHVybiBjb29raWVPYmo7XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZVVzZXJJbmZvKCl7XG5cdFx0bGV0IHBhcnNlSW5mbyA9IGRvY3VtZW50LmNvb2tpZS5zcGxpdCgnPScpO1xuXHRcdGxldCB1c2VySW5mbyA9IHBhcnNlSW5mb1sxXS5zcGxpdCgnOycpWzBdO1xuXHRcdGNvb2tpZU9iaiA9IEpTT04ucGFyc2UodXNlckluZm8pO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRpc0Nvb2tpZTogaXNDb29raWUsXG5cdFx0c2V0Q29va2llOiBzZXRDb29raWUsXG5cdFx0Z2V0Q29va2llOiBnZXRDb29raWUsXG5cdH1cblxufSk7XG4iLCJhcHAuY29udHJvbGxlciggJ0xlYWd1ZUN0cmwnLCBmdW5jdGlvbigkc2NvcGUsICRodHRwLCBMZWFndWVGYWN0b3J5LCBUZWFtRmFjdG9yeSl7XG5cblx0JHNjb3BlLnRhYiA9IHsgbGVhZ3VlOiAnYWN0aXZlJyB9XG5cblx0TGVhZ3VlRmFjdG9yeS5nZXRMZWFndWVUZWFtc0Zyb21TZXJ2ZXIoKTtcblxuXHQkc2NvcGUuZ2V0TGVhZ3VlVGVhbXMgPSBMZWFndWVGYWN0b3J5LmdldExlYWd1ZVRlYW1zO1xuXG59KTtcbiIsImFwcC5mYWN0b3J5KCdMZWFndWVGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHAsICRzdGF0ZVBhcmFtcywgVGVhbUZhY3Rvcnkpe1xuXG5cdGxldCBsZWFndWVUZWFtcztcblxuXHRmdW5jdGlvbiBnZXRMZWFndWVUZWFtc0Zyb21TZXJ2ZXIoKXtcblx0XHQkaHR0cC5nZXQoJy9hcGkvbGVhZ3VlLycgKyAkc3RhdGVQYXJhbXMuaWQgKyAnL3RlYW1zJyApXG5cdFx0LnRoZW4oIHJlc3BvbnNlID0+IHtcblx0XHRcdGxlYWd1ZVRlYW1zID0gcmVzcG9uc2UuZGF0YTtcblx0XHRcdGNvbnNvbGUubG9nKGxlYWd1ZVRlYW1zKVxuXHRcdH0pXG5cdH1cblxuXHRmdW5jdGlvbiB1cGRhdGVMZWFndWVUZWFtcygpe1xuXHRcdGxlYWd1ZVRlYW1zLmZvckVhY2goIHRlYW0gPT4ge1xuXHRcdFx0dGVhbS50b3RhbFdpbnMgPSBUZWFtRmFjdG9yeS5nZXRUZWFtVG90YWxXaW5zKHRlYW0udGVhbXMpXG5cdFx0fSlcblx0fVxuXG5cdGZ1bmN0aW9uIGdldExlYWd1ZVRlYW1zKCl7XG5cdFx0Y29uc29sZS5sb2cobGVhZ3VlVGVhbXMpXG5cdFx0dXBkYXRlTGVhZ3VlVGVhbXMoKTtcblx0XHRyZXR1cm4gbGVhZ3VlVGVhbXM7XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGdldExlYWd1ZVRlYW1zRnJvbVNlcnZlcjogZ2V0TGVhZ3VlVGVhbXNGcm9tU2VydmVyLFxuXHRcdGdldExlYWd1ZVRlYW1zOiBnZXRMZWFndWVUZWFtc1xuXHR9XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlcil7XG5cdCRzdGF0ZVByb3ZpZGVyLnN0YXRlKCAnbGVhZ3VlJywge1xuXHRcdHVybDogJy9sZWFndWUvOmlkJyxcblx0XHR0ZW1wbGF0ZVVybDogJ2pzL3ZpZXdzL2xlYWd1ZS9sZWFndWUuaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ0xlYWd1ZUN0cmwnXG5cdH0pXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpe1xuXG5cdCRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdsb2dpbicsIHtcblx0XHR1cmw6ICcvbG9naW4nLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvdmlld3MvbG9naW4vbG9naW4uaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ0xvZ2luQ3RybCdcblx0fSlcbn0pO1xuIiwiYXBwLmNvbnRyb2xsZXIoJ0xvZ2luQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIExvZ2luRmFjdG9yeSwgQ29va2llRmFjdG9yeSwgTkJBX0xlYWd1ZV9GYWN0b3J5KSB7XG4gICAgJHNjb3BlLmxvZ2luID0ge307XG4gICAgJHNjb3BlLmVycm9yID0gbnVsbDtcbiAgICAkc2NvcGUuaXNMb2dpblN0YXRlID0gKCkgPT4ge3JldHVybiB0cnVlO31cblxuICAgIE5CQV9MZWFndWVfRmFjdG9yeS5raWNrT2ZmTkJBVGVhbVdpbkdldHRlcigpOyAvLyBTdGFydCByaWdodCB3aGVuIHdlIGhpdCB0aGUgbG9naW4gcGFnZVxuXG4gICAgZnVuY3Rpb24gc2VuZExvZ2luTm93KGxvZ2luSW5mbyl7XG5cbiAgICAgICAgJHNjb3BlLmVycm9yID0gbnVsbDtcbiAgICAgICAgTG9naW5GYWN0b3J5LnNlbmRMb2dpbihsb2dpbkluZm8pXG4gICAgICAgIC5jYXRjaCggKCkgPT4geyAkc2NvcGUuZXJyb3IgPSAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nIH0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ3Vlc3RMb2dpbigpe1xuICAgICAgICBzZW5kTG9naW5Ob3coeyBlbWFpbDogJ2pvZXlAam9leS5jb20nLCBwYXNzd29yZDogJ2pvZXknfSlcbiAgICB9XG5cbiAgICAkc2NvcGUuc2VuZExvZ2luID0gc2VuZExvZ2luTm93O1xuICAgICRzY29wZS5ndWVzdExvZ2luID0gZ3Vlc3RMb2dpbjtcblxuICAgIGlmICggQ29va2llRmFjdG9yeS5pc0Nvb2tpZSgpICl7XG5cdFx0c2VuZExvZ2luTm93KCBDb29raWVGYWN0b3J5LmdldENvb2tpZSgpICk7XG4gICAgfVxuXG59KTtcbiIsImFwcC5mYWN0b3J5KCAnTG9naW5GYWN0b3J5JywgZnVuY3Rpb24oIEF1dGhTZXJ2aWNlLCAkc3RhdGUsIFVzZXJGYWN0b3J5LCBDb29raWVGYWN0b3J5ICl7XG5cbiAgICBmdW5jdGlvbiBzZW5kTG9naW4obG9naW5JbmZvKXtcbiAgICAgICAgcmV0dXJuIEF1dGhTZXJ2aWNlLmxvZ2luKGxvZ2luSW5mbylcbiAgICAgICAgLnRoZW4oICgpID0+IENvb2tpZUZhY3Rvcnkuc2V0Q29va2llKGxvZ2luSW5mbykpXG4gICAgICAgIC50aGVuKCAoKSA9PiBVc2VyRmFjdG9yeS5pbml0VXNlckZhY3RvcnkoKSApXG4gICAgICAgIC50aGVuKCAoKSA9PiB7ICRzdGF0ZS5nbygndXNlcicpIH0pXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgc2VuZExvZ2luOiBzZW5kTG9naW4sXG4gICAgfVxuXG59KTtcbiIsImFwcC5jb250cm9sbGVyKCAnTkJBX0N0cmwnLCBmdW5jdGlvbiggJHNjb3BlLCBOQkFfTGVhZ3VlX0ZhY3Rvcnkpe1xuXG5cdCRzY29wZS50YWIgPSB7IG5iYVN0YW5kaW5nczogJ2FjdGl2ZScgfVxuXG5cdCRzY29wZS5uYmFUZWFtc0luZm8gPSBOQkFfTGVhZ3VlX0ZhY3RvcnkuZ2V0TkJBVGVhbUluZm87XG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ05CQV9MZWFndWVfRmFjdG9yeScsIGZ1bmN0aW9uKCRodHRwLCAkbG9nKXtcblxuXHRsZXQgbmJhVGVhbUluZm8gPSBbXTtcblx0bGV0IG5iYVRlYW1JbmZvT2JqID0ge307XG5cblx0ZnVuY3Rpb24gc2NyYXBlRVNQTmh0bWwobmJhUGFnZSl7XG5cdFx0bGV0IHRlYW1Ub2tlbml6ZXIgPSAnPHNwYW4gY2xhc3M9XCJ0ZWFtLW5hbWVzXCI+Jztcblx0XHRsZXQgdGVhbVRva2VucyA9IG5iYVBhZ2Uuc3BsaXQodGVhbVRva2VuaXplcik7XG5cblx0XHQvLyBDbGVhciBvbGQgZGF0YVxuXHRcdG5iYVRlYW1JbmZvID0gW107XG5cdFx0bmJhVGVhbUluZm9PYmogPSB7fTtcblx0XG5cdFx0Ly8gUG9wdWxhdGUgbmJhIHRlYW0gaW5mbyBvYmplY3RzXG5cdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCB0ZWFtVG9rZW5zLmxlbmd0aDsgaSsrICl7IC8vIHN0YXJ0aW5nIGF0IDEgaGVyZSBiZWNhdXNlIHRoZSBmaXJzdCB0b2tlbiBpcyBnYXJiYWdlXG5cdFx0XHRuYmFUZWFtSW5mby5wdXNoKHBhcnNlVGVhbUluZm8oIHRlYW1Ub2tlbnNbaV0pICk7XG5cdFx0XHRuYmFUZWFtSW5mb09ialtuYmFUZWFtSW5mb1sgaSAtIDEgXS5hYmJyXSA9IG5iYVRlYW1JbmZvWyBpIC0gMSBdLndpbnM7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gcGFyc2VUZWFtSW5mbyh0ZWFtSW5mb1N0cil7XG5cblx0XHRsZXQgdGVhbUluZm8gPSB7fTtcblx0XHQvLyBQYXJzZSB0ZWFtIG5hbWVcblx0XHRsZXQgZW5kT2ZUZWFtTmFtZUxvYyA9IHRlYW1JbmZvU3RyLmluZGV4T2YoJzwvc3Bhbj4nKTtcblx0XHR0ZWFtSW5mby5uYW1lID0gdGVhbUluZm9TdHIuc2xpY2UoMCwgZW5kT2ZUZWFtTmFtZUxvYyk7XG5cblx0XHQvLyBQYXJzZSBhYmJyZXZpYXRlZCB0ZWFtIG5hbWVcblx0XHRsZXQgYWJiclRhZ1N0YXJ0ID0gJzxhYmJyIHRpdGxlPVwiJyArIHRlYW1JbmZvLm5hbWUgKyAnXCI+Jztcblx0XHRsZXQgYWJiclRhZ0VuZCA9ICc8L2FiYnI+Jztcblx0XHR0ZWFtSW5mby5hYmJyID0gdGVhbUluZm9TdHIuc2xpY2UoIHRlYW1JbmZvU3RyLmluZGV4T2YoYWJiclRhZ1N0YXJ0KSArIGFiYnJUYWdTdGFydC5sZW5ndGgsIHRlYW1JbmZvU3RyLmluZGV4T2YoYWJiclRhZ0VuZCkpO1xuXG5cdFx0Ly8gUGFyc2UgdGVhbSB3aW5zXG5cdFx0bGV0IHdpbnNBcnIgPSB0ZWFtSW5mb1N0ci5zcGxpdCgnY2xhc3M9XCJcIj4nKVxuXHRcdGxldCB3aW5zID0gd2luc0FyclsxXS5zbGljZSgwLCB3aW5zQXJyWzFdLmluZGV4T2YoJzwvdGQ+JykpO1xuXHRcdHRlYW1JbmZvLndpbnMgPSB3aW5zO1xuXG5cdFx0cmV0dXJuIHRlYW1JbmZvO1xuXHR9XG5cblx0Ly8gRVNQTiBOQkEgV2Vic2NyYXBlciBmb3IgTkJBIHRlYW0gbGVhZ3VlIGluZm9cblx0Ly8gSW5wdXQ6IFx0RGVzaXJlZCB5ZWFyIG9mIE5CQSB0ZWFtIGxlYWd1ZSBpbmZvcm1hdGlvbiBpbiB0aGUgZm9ybWF0IG9mIFhYWFhcblx0Ly8gT3V0cHV0OiBcdEFuIGFycmF5IG9mIGFsbCBOQkEgdGVhbXMgaW4gdGhlIGZvbGxvd2luZyBmb3JtYXQ6XG5cdC8vXHRcdFx0XHR7IFx0bmFtZTogJ05CQSBUZWFtIE5hbWUnLFxuXHQvL1x0XHRcdFx0XHRhYmJyOiAnTkJBIFRlYW0gTmFtZSBBYmJyZXZpYXRpb24nLFxuXHQvL1x0XHRcdFx0XHR3aW5zOiAnTkJBIFRlYW0gV2lucyBmb3IgeWVhciBYWFhYICcgfVxuXHQvLyBub3RlczogRVNQTiBvbmx5IHByb3ZpZGVzIGluZm8gZGF0aW5nIGJhY2sgdG8gMjAwMi5cblxuXHRmdW5jdGlvbiBnZXROQkFUZWFtSW5mb0Zyb21FU1BOKCkge1xuXG5cdFx0bGV0IHllYXIgPSAyMDE3OyAvLyBSaWdodCBub3cganVzdCBzZXQgdG8gZ2V0IGN1cnJlbnQgeWVhclxuXG5cdFx0bGV0IGhvc3QgPSAnaHR0cDovL3d3dy5lc3BuLmNvbSc7XG5cdFx0bGV0IGVzcG5QYXRoID1cblx0XHRcdHllYXIgPj0gKG5ldyBEYXRlKCkpLmdldEZ1bGxZZWFyKCkgfHwgeWVhciA8PSAyMDAyID9cblx0XHRcdCcvbmJhL3N0YW5kaW5ncy9fL2dyb3VwL2xlYWd1ZScgOlxuXHRcdFx0Jy9uYmEvc3RhbmRpbmdzL18vc2Vhc29uLycgKyB5ZWFyICsgJy9ncm91cC9sZWFndWUnO1xuXG5cblx0XHQkaHR0cC5nZXQoIGhvc3QgKyBlc3BuUGF0aCApXG5cdFx0LnRoZW4oIGVzcG5OQkFQYWdlID0+IHtcblx0XHRcdHNjcmFwZUVTUE5odG1sKGVzcG5OQkFQYWdlLmRhdGEpXG5cdFx0fSlcblx0XHQuY2F0Y2goY29uc29sZS5lcnJvcik7XG5cdH1cblxuXHRmdW5jdGlvbiBraWNrT2ZmTkJBVGVhbVdpbkdldHRlcigpe1xuXHRcdGdldE5CQVRlYW1JbmZvRnJvbUVTUE4oKTtcdFx0XHRcdFx0Ly8gS2ljayBpdCBvZmYgcmlnaHQgYXdheSBzbyB3ZSBoYXZlIGRhdGEgdG8gZGlzcGxheVxuXHRcdHNldEludGVydmFsKCBnZXROQkFUZWFtSW5mb0Zyb21FU1BOLCA2MDAwMCk7IC8vIFRoZW4gdXBkYXRlIG9uY2UgYSBtaW51dGVcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0Z2V0TkJBVGVhbUluZm86ICgpID0+IG5iYVRlYW1JbmZvLFxuXHRcdGdldE5CQVRlYW1JbmZvT2JqOiAoKSA9PiBuYmFUZWFtSW5mb09iaixcblx0XHRraWNrT2ZmTkJBVGVhbVdpbkdldHRlcjoga2lja09mZk5CQVRlYW1XaW5HZXR0ZXJcblx0fVxuXG59KTtcbiIsImFwcC5jb25maWcoICRzdGF0ZVByb3ZpZGVyID0+IHtcblx0JHN0YXRlUHJvdmlkZXIuc3RhdGUoICduYmFMZWFndWUnLCB7XG5cdFx0dXJsOiAnL25iYS1zdGFuZGluZ3MnLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvdmlld3MvbmJhLWxlYWd1ZS9uYmEubGVhZ3VlLmh0bWwnLFxuXHRcdGNvbnRyb2xsZXI6ICdOQkFfQ3RybCdcblx0fSlcbn0pXG4iLCJhcHAuY29udHJvbGxlciggJ1RlYW1DdHJsJywgKCRzY29wZSwgVGVhbUZhY3RvcnkpID0+IHtcblx0JHNjb3BlLnRhYiA9IHsgdGVhbTogJ2FjdGl2ZScgfVxuXG5cdC8vIFNldHVwIHRvIGxpdmUgdXBkYXRlIHdoZW4gZWFjaCBFU1BOIHNjcmFwZVxuXHRUZWFtRmFjdG9yeS5nZXRUZWFtRnJvbVNlcnZlcigpO1xuXHQkc2NvcGUuZ2V0TkJBVGVhbXMgPSBUZWFtRmFjdG9yeS5nZXROQkFUZWFtcztcblx0JHNjb3BlLmdldE5CQVRlYW1XaW5zID0gVGVhbUZhY3RvcnkuZ2V0TkJBVGVhbVdpbnM7XG5cdCRzY29wZS5nZXRUZWFtVG90YWxXaW5zID0gVGVhbUZhY3RvcnkuZ2V0VGVhbVRvdGFsV2lucztcblxufSk7XG4iLCJhcHAuZmFjdG9yeSggJ1RlYW1GYWN0b3J5JywgKCAkaHR0cCwgJHN0YXRlUGFyYW1zLCAkbG9nLCBOQkFfTGVhZ3VlX0ZhY3RvcnkgKSA9PiB7XG5cblx0bGV0IE5CQXRlYW1zID0gW107XG5cblx0ZnVuY3Rpb24gZ2V0VGVhbUZyb21TZXJ2ZXIoKXtcblxuXHRcdCRodHRwLmdldCgnYXBpL3RlYW0vJyArICRzdGF0ZVBhcmFtcy5pZCArICcvbmJhX3RlYW1zJylcblx0XHQudGhlbiggcmVzcG9uc2UgPT4ge1xuXHRcdFx0TkJBdGVhbXMgPSByZXNwb25zZS5kYXRhO1xuXHRcdH0pXG5cdFx0LmNhdGNoKCRsb2cpXG5cdH1cblxuXHRmdW5jdGlvbiB1cGRhdGVOQkFUZWFtcygpe1xuXHRcdE5CQXRlYW1zLmZvckVhY2goIHRlYW0gPT4ge1xuXHRcdFx0dGVhbS53aW5zID0gZ2V0TkJBVGVhbVdpbnModGVhbS5hYmJyKTtcblx0XHR9KVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0TkJBVGVhbVdpbnMoYWJicil7XG5cdFx0bGV0IGxpdmVOQkFUZWFtSW5mb09iaiA9IE5CQV9MZWFndWVfRmFjdG9yeS5nZXROQkFUZWFtSW5mb09iaigpO1xuXHRcdHJldHVybiBsaXZlTkJBVGVhbUluZm9PYmpbYWJicl07XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRUZWFtVG90YWxXaW5zKHRlYW1zKXtcblx0XHRcblx0XHRsZXQgc3VtID0gMDtcblx0XHRsZXQgbGl2ZU5CQVRlYW1JbmZvT2JqID0gTkJBX0xlYWd1ZV9GYWN0b3J5LmdldE5CQVRlYW1JbmZvT2JqKCk7XG5cblx0XHR0ZWFtcy5mb3JFYWNoKCB0ZWFtID0+IHtcblx0XHRcdHN1bSArPSBOdW1iZXIobGl2ZU5CQVRlYW1JbmZvT2JqW3RlYW0uYWJicl0pO1xuXHRcdH0pXG5cblx0XHRyZXR1cm4gc3VtO1xuXHR9XG5cblx0Ly8gRG9pbmcgdGhpcyB0byBhbGxvdyBmb3Igc29ydGluZyB0aGUgdGVhbXMgYnkgd2luc1xuXHRmdW5jdGlvbiBnZXROQkFUZWFtcygpe1xuXHRcdHVwZGF0ZU5CQVRlYW1zKCk7XG5cdFx0cmV0dXJuIE5CQXRlYW1zO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRnZXROQkFUZWFtczogZ2V0TkJBVGVhbXMsXG5cdFx0Z2V0VGVhbVRvdGFsV2luczogZ2V0VGVhbVRvdGFsV2lucyxcblx0XHRnZXRUZWFtRnJvbVNlcnZlcjogZ2V0VGVhbUZyb21TZXJ2ZXJcblx0fVxuXG59KTtcbiIsImFwcC5jb25maWcoICRzdGF0ZVByb3ZpZGVyID0+IHtcblxuXHQkc3RhdGVQcm92aWRlci5zdGF0ZSggJ3RlYW0nLCB7XG5cdFx0dXJsOiAnL3RlYW0vOmlkJyxcblx0XHR0ZW1wbGF0ZVVybDogJ2pzL3ZpZXdzL3RlYW0vdGVhbS5odG1sJyxcblx0XHRjb250cm9sbGVyOiAnVGVhbUN0cmwnLFxuXHR9KTtcblxufSk7XG4iLCJhcHAuY29udHJvbGxlcignVXNlckN0cmwnLCBmdW5jdGlvbigkc2NvcGUsIFVzZXJGYWN0b3J5KXtcblxuXHQkc2NvcGUudGFiID0geyBob21lOiAnYWN0aXZlJyB9O1xuXG5cdCRzY29wZS51c2VyVGVhbXMgPSBVc2VyRmFjdG9yeS5nZXRVc2VyVGVhbXMoKTtcblxuXHQkc2NvcGUuc2VsZWN0ZWRUZWFtSUQgPSBVc2VyRmFjdG9yeS5nZXRTZWxlY3RlZFRlYW1JRCgpO1xuXG5cdCRzY29wZS5zZWxlY3RlZExlYWd1ZUlEID0gVXNlckZhY3RvcnkuZ2V0U2VsZWN0ZWRMZWFndWVJRCgpO1xuXG59KTtcbiIsImFwcC5mYWN0b3J5KCAnVXNlckZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCwgU2Vzc2lvbiwgJGxvZyl7XG5cblx0bGV0IHVzZXJUZWFtcyA9IFtdO1xuXHRsZXQgdXNlclNlbGVjdGVkVGVhbUlEID0gdW5kZWZpbmVkO1xuXHRsZXQgdXNlclNlbGVjdGVkTGVhZ3VlSUQgPSB1bmRlZmluZWQ7XG5cblx0ZnVuY3Rpb24gaW5pdFVzZXJGYWN0b3J5KCl7XG5cdFx0cmV0dXJuICRodHRwLmdldCgnYXBpL3RlYW0vdXNlci8nICsgU2Vzc2lvbi51c2VyLmlkIClcblx0XHQudGhlbiggcmVzcG9uc2UgPT4ge1xuXHRcdFx0dXNlclRlYW1zID0gcmVzcG9uc2UuZGF0YTtcblx0XHRcdC8vIEludGlhbGl6ZSB0aGVzZSB0byBmaXJzdCB0ZWFtIGFuZCBsZWFndWUgdG8gc3RhcnRcblx0XHRcdHVzZXJTZWxlY3RlZFRlYW1JRCA9IHVzZXJUZWFtc1swXS5pZDtcblx0XHRcdHVzZXJTZWxlY3RlZExlYWd1ZUlEID0gdXNlclRlYW1zWzBdLmxlYWd1ZS5pZDtcblx0XHR9KVxuXHRcdC5jYXRjaCgkbG9nKVxuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRpbml0VXNlckZhY3Rvcnk6IGluaXRVc2VyRmFjdG9yeSxcblx0XHRnZXRVc2VyVGVhbXM6ICgpID0+IHVzZXJUZWFtcyxcblx0XHRnZXRTZWxlY3RlZFRlYW1JRDogKCkgPT4gdXNlclNlbGVjdGVkVGVhbUlELFxuXHRcdGdldFNlbGVjdGVkTGVhZ3VlSUQ6ICgpID0+IHVzZXJTZWxlY3RlZExlYWd1ZUlELFxuXHR9XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlcil7XG5cblx0JHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3VzZXInLCB7XG5cdFx0dXJsOiAnL3VzZXInLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvdmlld3MvdXNlci91c2VyLmh0bWwnLFxuXHRcdGNvbnRyb2xsZXI6ICdVc2VyQ3RybCdcblx0fSlcblxufSk7XG4iXX0=
