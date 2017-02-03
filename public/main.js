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

app.directive('nbaTeamRepeat', function () {
	return {
		restrict: 'E',
		templateUrl: 'js/directives/nba-team/nba-team.html',
		scope: {
			nbateams: '='
		}
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

app.controller('LeagueCtrl', function ($scope, $http, LeagueFactory) {

	$scope.tab = { league: 'active' };

	LeagueFactory.getLeagueTeamsFromServer();

	$scope.getLeagueTeams = LeagueFactory.getLeagueTeams;
});

app.factory('LeagueFactory', function ($http, $stateParams, TeamFactory) {

	var leagueTeams = [];

	function getLeagueTeamsFromServer() {
		$http.get('/api/league/' + $stateParams.id + '/teams').then(function (response) {
			leagueTeams = response.data;
		});
	}

	function updateLeagueTeams() {
		leagueTeams.forEach(function (team) {
			team.totalWins = TeamFactory.getTeamTotalWins(team.teams);
		});
	}

	function getLeagueTeams() {
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

app.factory('NBA_League_Factory', function ($http) {

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
			nbaTeamInfoObj[nbaTeamInfo[i - 1].abbr] = Number(nbaTeamInfo[i - 1].wins);
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
		teamInfo.wins = Number(wins);

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

		var host = 'https://www.espn.com';
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsInByZS1idWlsdC9wcmUtYnVpbHQuanMiLCJkaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuanMiLCJkaXJlY3RpdmVzL25iYS10ZWFtL25iYS10ZWFtLmpzIiwiZGlyZWN0aXZlcy90YWJNZW51L3RhYk1lbnUuY29udHJvbGxlci5qcyIsImRpcmVjdGl2ZXMvdGFiTWVudS90YWJNZW51LmpzIiwidmlld3MvY29va2llcy9jb29raWVGYWN0b3J5LmpzIiwidmlld3MvbGVhZ3VlL2xlYWd1ZS5jb250cm9sbGVyLmpzIiwidmlld3MvbGVhZ3VlL2xlYWd1ZS5mYWN0b3J5LmpzIiwidmlld3MvbGVhZ3VlL2xlYWd1ZS5zdGF0ZS5qcyIsInZpZXdzL2xvZ2luL2xvZ2luLnN0YXRlLmpzIiwidmlld3MvbG9naW4vbG9naW5Db250cm9sbGVyLmpzIiwidmlld3MvbG9naW4vbG9naW5GYWN0b3J5LmpzIiwidmlld3MvbmJhLWxlYWd1ZS9uYmEubGVhZ3VlLmNvbnRyb2xsZXIuanMiLCJ2aWV3cy9uYmEtbGVhZ3VlL25iYS5sZWFndWUuZmFjdG9yeS5qcyIsInZpZXdzL25iYS1sZWFndWUvbmJhLmxlYWd1ZS5zdGF0ZS5qcyIsInZpZXdzL3RlYW0vdGVhbS5jb250cm9sbGVyLmpzIiwidmlld3MvdGVhbS90ZWFtLmZhY3RvcnkuanMiLCJ2aWV3cy90ZWFtL3RlYW0uc3RhdGUuanMiLCJ2aWV3cy91c2VyL3VzZXIuY29udHJvbGxlci5qcyIsInZpZXdzL3VzZXIvdXNlci5mYWN0b3J5LmpzIiwidmlld3MvdXNlci91c2VyLnN0YXRlLmpzIl0sIm5hbWVzIjpbIndpbmRvdyIsImFwcCIsImFuZ3VsYXIiLCJtb2R1bGUiLCJjb25maWciLCIkdXJsUm91dGVyUHJvdmlkZXIiLCIkbG9jYXRpb25Qcm92aWRlciIsImh0bWw1TW9kZSIsIm90aGVyd2lzZSIsIndoZW4iLCJsb2NhdGlvbiIsInJlbG9hZCIsInJ1biIsIiRyb290U2NvcGUiLCIkb24iLCJldmVudCIsInRvU3RhdGUiLCJ0b1BhcmFtcyIsImZyb21TdGF0ZSIsImZyb21QYXJhbXMiLCJ0aHJvd25FcnJvciIsImNvbnNvbGUiLCJpbmZvIiwibmFtZSIsImVycm9yIiwiQXV0aFNlcnZpY2UiLCIkc3RhdGUiLCJkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoIiwic3RhdGUiLCJkYXRhIiwiYXV0aGVudGljYXRlIiwiaXNBdXRoZW50aWNhdGVkIiwicHJldmVudERlZmF1bHQiLCJnZXRMb2dnZWRJblVzZXIiLCJ0aGVuIiwidXNlciIsImdvIiwiRXJyb3IiLCJjb25zdGFudCIsImxvZ2luU3VjY2VzcyIsImxvZ2luRmFpbGVkIiwibG9nb3V0U3VjY2VzcyIsInNlc3Npb25UaW1lb3V0Iiwibm90QXV0aGVudGljYXRlZCIsIm5vdEF1dGhvcml6ZWQiLCJmYWN0b3J5IiwiJHEiLCJBVVRIX0VWRU5UUyIsInN0YXR1c0RpY3QiLCJyZXNwb25zZUVycm9yIiwicmVzcG9uc2UiLCIkYnJvYWRjYXN0Iiwic3RhdHVzIiwicmVqZWN0IiwiJGh0dHBQcm92aWRlciIsImludGVyY2VwdG9ycyIsInB1c2giLCIkaW5qZWN0b3IiLCJnZXQiLCJzZXJ2aWNlIiwiJGh0dHAiLCJTZXNzaW9uIiwib25TdWNjZXNzZnVsTG9naW4iLCJjcmVhdGUiLCJmcm9tU2VydmVyIiwiY2F0Y2giLCJsb2dpbiIsImNyZWRlbnRpYWxzIiwicG9zdCIsIm1lc3NhZ2UiLCJsb2dvdXQiLCJkZXN0cm95Iiwic2VsZiIsImRpcmVjdGl2ZSIsInJlc3RyaWN0IiwidGVtcGxhdGVVcmwiLCJzY29wZSIsIm5iYXRlYW1zIiwiY29udHJvbGxlciIsIiRzY29wZSIsIlVzZXJGYWN0b3J5IiwidGVhbUlkIiwiZ2V0U2VsZWN0ZWRUZWFtSUQiLCJsZWFndWVJZCIsImdldFNlbGVjdGVkTGVhZ3VlSUQiLCJjb29raWVPYmoiLCJpc0Nvb2tpZSIsImRvY3VtZW50IiwiY29va2llIiwicGFyc2VVc2VySW5mbyIsInNldENvb2tpZSIsImxvZ2luSW5mbyIsImVtYWlsIiwicGFzc3dvcmQiLCJKU09OIiwic3RyaW5naWZ5IiwicmVzZXRDb29raWVFeHBpcmUiLCJjdXJyZW50RGF0ZSIsIkRhdGUiLCJleHBpcmVEYXRlIiwic2V0TW9udGgiLCJnZXRNb250aCIsInRvVVRDU3RyaW5nIiwiZ2V0Q29va2llIiwicGFyc2VJbmZvIiwic3BsaXQiLCJ1c2VySW5mbyIsInBhcnNlIiwiTGVhZ3VlRmFjdG9yeSIsInRhYiIsImxlYWd1ZSIsImdldExlYWd1ZVRlYW1zRnJvbVNlcnZlciIsImdldExlYWd1ZVRlYW1zIiwiJHN0YXRlUGFyYW1zIiwiVGVhbUZhY3RvcnkiLCJsZWFndWVUZWFtcyIsImlkIiwidXBkYXRlTGVhZ3VlVGVhbXMiLCJmb3JFYWNoIiwidGVhbSIsInRvdGFsV2lucyIsImdldFRlYW1Ub3RhbFdpbnMiLCJ0ZWFtcyIsIiRzdGF0ZVByb3ZpZGVyIiwidXJsIiwiTG9naW5GYWN0b3J5IiwiQ29va2llRmFjdG9yeSIsIk5CQV9MZWFndWVfRmFjdG9yeSIsImlzTG9naW5TdGF0ZSIsImtpY2tPZmZOQkFUZWFtV2luR2V0dGVyIiwic2VuZExvZ2luTm93Iiwic2VuZExvZ2luIiwiZ3Vlc3RMb2dpbiIsImluaXRVc2VyRmFjdG9yeSIsIm5iYVN0YW5kaW5ncyIsIm5iYVRlYW1zSW5mbyIsImdldE5CQVRlYW1JbmZvIiwibmJhVGVhbUluZm8iLCJuYmFUZWFtSW5mb09iaiIsInNjcmFwZUVTUE5odG1sIiwibmJhUGFnZSIsInRlYW1Ub2tlbml6ZXIiLCJ0ZWFtVG9rZW5zIiwiaSIsImxlbmd0aCIsInBhcnNlVGVhbUluZm8iLCJhYmJyIiwiTnVtYmVyIiwid2lucyIsInRlYW1JbmZvU3RyIiwidGVhbUluZm8iLCJlbmRPZlRlYW1OYW1lTG9jIiwiaW5kZXhPZiIsInNsaWNlIiwiYWJiclRhZ1N0YXJ0IiwiYWJiclRhZ0VuZCIsIndpbnNBcnIiLCJnZXROQkFUZWFtSW5mb0Zyb21FU1BOIiwieWVhciIsImhvc3QiLCJlc3BuUGF0aCIsImdldEZ1bGxZZWFyIiwiZXNwbk5CQVBhZ2UiLCJzZXRJbnRlcnZhbCIsImdldE5CQVRlYW1JbmZvT2JqIiwiZ2V0VGVhbUZyb21TZXJ2ZXIiLCJnZXROQkFUZWFtcyIsImdldE5CQVRlYW1XaW5zIiwiJGxvZyIsIk5CQXRlYW1zIiwidXBkYXRlTkJBVGVhbXMiLCJsaXZlTkJBVGVhbUluZm9PYmoiLCJzdW0iLCJob21lIiwidXNlclRlYW1zIiwiZ2V0VXNlclRlYW1zIiwic2VsZWN0ZWRUZWFtSUQiLCJzZWxlY3RlZExlYWd1ZUlEIiwidXNlclNlbGVjdGVkVGVhbUlEIiwidW5kZWZpbmVkIiwidXNlclNlbGVjdGVkTGVhZ3VlSUQiXSwibWFwcGluZ3MiOiJBQUFBOztBQUNBQSxPQUFBQyxHQUFBLEdBQUFDLFFBQUFDLE1BQUEsQ0FBQSxnQkFBQSxFQUFBLENBQUEsVUFBQSxFQUFBLFdBQUEsQ0FBQSxDQUFBOztBQUVBRixJQUFBRyxNQUFBLENBQUEsVUFBQUMsa0JBQUEsRUFBQUMsaUJBQUEsRUFBQTtBQUNBO0FBQ0FBLG1CQUFBQyxTQUFBLENBQUEsSUFBQTtBQUNBO0FBQ0FGLG9CQUFBRyxTQUFBLENBQUEsUUFBQTtBQUNBO0FBQ0FILG9CQUFBSSxJQUFBLENBQUEsaUJBQUEsRUFBQSxZQUFBO0FBQ0FULFNBQUFVLFFBQUEsQ0FBQUMsTUFBQTtBQUNBLEVBRkE7QUFHQSxDQVRBOztBQVdBO0FBQ0FWLElBQUFXLEdBQUEsQ0FBQSxVQUFBQyxVQUFBLEVBQUE7QUFDQUEsWUFBQUMsR0FBQSxDQUFBLG1CQUFBLEVBQUEsVUFBQUMsS0FBQSxFQUFBQyxPQUFBLEVBQUFDLFFBQUEsRUFBQUMsU0FBQSxFQUFBQyxVQUFBLEVBQUFDLFdBQUEsRUFBQTtBQUNBQyxVQUFBQyxJQUFBLGdGQUFBTixRQUFBTyxJQUFBO0FBQ0FGLFVBQUFHLEtBQUEsQ0FBQUosV0FBQTtBQUNBLEVBSEE7QUFJQSxDQUxBOztBQU9BO0FBQ0FuQixJQUFBVyxHQUFBLENBQUEsVUFBQUMsVUFBQSxFQUFBWSxXQUFBLEVBQUFDLE1BQUEsRUFBQTs7QUFF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QSxlQURBO0FBRUEwQyxnQkFBQTtBQUFBLFVBQUFELFNBQUE7QUFBQSxHQUZBO0FBR0E1RixxQkFBQTtBQUFBLFVBQUFnRyxrQkFBQTtBQUFBLEdBSEE7QUFJQTlGLHVCQUFBO0FBQUEsVUFBQWdHLG9CQUFBO0FBQUE7QUFKQSxFQUFBO0FBT0EsQ0F4QkE7O0FDQUFuTCxJQUFBRyxNQUFBLENBQUEsVUFBQXVILGNBQUEsRUFBQTs7QUFFQUEsZ0JBQUEvRixLQUFBLENBQUEsTUFBQSxFQUFBO0FBQ0FnRyxPQUFBLE9BREE7QUFFQWpELGVBQUEseUJBRkE7QUFHQUcsY0FBQTtBQUhBLEVBQUE7QUFNQSxDQVJBIiwiZmlsZSI6Im1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG53aW5kb3cuYXBwID0gYW5ndWxhci5tb2R1bGUoJ05CQV9QaWNrZW1fQXBwJywgWydwcmVCdWlsdCcsICd1aS5yb3V0ZXInXSk7XG5cbmFwcC5jb25maWcoZnVuY3Rpb24gKCR1cmxSb3V0ZXJQcm92aWRlciwgJGxvY2F0aW9uUHJvdmlkZXIpIHtcbiAgICAvLyBUaGlzIHR1cm5zIG9mZiBoYXNoYmFuZyB1cmxzICgvI2Fib3V0KSBhbmQgY2hhbmdlcyBpdCB0byBzb21ldGhpbmcgbm9ybWFsICgvYWJvdXQpXG4gICAgJGxvY2F0aW9uUHJvdmlkZXIuaHRtbDVNb2RlKHRydWUpO1xuICAgIC8vIElmIHdlIGdvIHRvIGEgVVJMIHRoYXQgdWktcm91dGVyIGRvZXNuJ3QgaGF2ZSByZWdpc3RlcmVkLCBnbyB0byB0aGUgXCIvXCIgdXJsLlxuICAgICR1cmxSb3V0ZXJQcm92aWRlci5vdGhlcndpc2UoJy9sb2dpbicpO1xuICAgIC8vIFRyaWdnZXIgcGFnZSByZWZyZXNoIHdoZW4gYWNjZXNzaW5nIGFuIE9BdXRoIHJvdXRlXG4gICAgJHVybFJvdXRlclByb3ZpZGVyLndoZW4oJy9hdXRoLzpwcm92aWRlcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xuICAgIH0pO1xufSk7XG5cbi8vIFRoaXMgYXBwLnJ1biBpcyBmb3IgbGlzdGVuaW5nIHRvIGVycm9ycyBicm9hZGNhc3RlZCBieSB1aS1yb3V0ZXIsIHVzdWFsbHkgb3JpZ2luYXRpbmcgZnJvbSByZXNvbHZlc1xuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSkge1xuICAgICRyb290U2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VFcnJvcicsIGZ1bmN0aW9uIChldmVudCwgdG9TdGF0ZSwgdG9QYXJhbXMsIGZyb21TdGF0ZSwgZnJvbVBhcmFtcywgdGhyb3duRXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5pbmZvKGBUaGUgZm9sbG93aW5nIGVycm9yIHdhcyB0aHJvd24gYnkgdWktcm91dGVyIHdoaWxlIHRyYW5zaXRpb25pbmcgdG8gc3RhdGUgXCIke3RvU3RhdGUubmFtZX1cIi4gVGhlIG9yaWdpbiBvZiB0aGlzIGVycm9yIGlzIHByb2JhYmx5IGEgcmVzb2x2ZSBmdW5jdGlvbjpgKTtcbiAgICAgICAgY29uc29sZS5lcnJvcih0aHJvd25FcnJvcik7XG4gICAgfSk7XG59KTtcblxuLy8gVGhpcyBhcHAucnVuIGlzIGZvciBjb250cm9sbGluZyBhY2Nlc3MgdG8gc3BlY2lmaWMgc3RhdGVzLlxuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuXG4gICAgLy8gVGhlIGdpdmVuIHN0YXRlIHJlcXVpcmVzIGFuIGF1dGhlbnRpY2F0ZWQgdXNlci5cbiAgICB2YXIgZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICByZXR1cm4gc3RhdGUuZGF0YSAmJiBzdGF0ZS5kYXRhLmF1dGhlbnRpY2F0ZTtcbiAgICB9O1xuXG4gICAgLy8gJHN0YXRlQ2hhbmdlU3RhcnQgaXMgYW4gZXZlbnQgZmlyZWRcbiAgICAvLyB3aGVuZXZlciB0aGUgcHJvY2VzcyBvZiBjaGFuZ2luZyBhIHN0YXRlIGJlZ2lucy5cbiAgICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlU3RhcnQnLCBmdW5jdGlvbiAoZXZlbnQsIHRvU3RhdGUsIHRvUGFyYW1zKSB7XG5cbiAgICAgICAgaWYgKCFkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoKHRvU3RhdGUpKSB7XG4gICAgICAgICAgICAvLyBUaGUgZGVzdGluYXRpb24gc3RhdGUgZG9lcyBub3QgcmVxdWlyZSBhdXRoZW50aWNhdGlvblxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSkge1xuICAgICAgICAgICAgLy8gVGhlIHVzZXIgaXMgYXV0aGVudGljYXRlZC5cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYW5jZWwgbmF2aWdhdGluZyB0byBuZXcgc3RhdGUuXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgLy8gSWYgYSB1c2VyIGlzIHJldHJpZXZlZCwgdGhlbiByZW5hdmlnYXRlIHRvIHRoZSBkZXN0aW5hdGlvblxuICAgICAgICAgICAgLy8gKHRoZSBzZWNvbmQgdGltZSwgQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkgd2lsbCB3b3JrKVxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlLCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbiwgZ28gdG8gXCJsb2dpblwiIHN0YXRlLlxuICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28odG9TdGF0ZS5uYW1lLCB0b1BhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbygnbG9naW4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9KTtcblxufSk7XG4iLCIoZnVuY3Rpb24gKCkge1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLy8gSG9wZSB5b3UgZGlkbid0IGZvcmdldCBBbmd1bGFyISBEdWgtZG95LlxuICAgIGlmICghd2luZG93LmFuZ3VsYXIpIHRocm93IG5ldyBFcnJvcignSSBjYW5cXCd0IGZpbmQgQW5ndWxhciEnKTtcblxuICAgIHZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgncHJlQnVpbHQnLCBbXSk7XG5cbiAgICAvLyBhcHAuZmFjdG9yeSgnU29ja2V0JywgZnVuY3Rpb24gKCkge1xuICAgIC8vICAgICBpZiAoIXdpbmRvdy5pbykgdGhyb3cgbmV3IEVycm9yKCdzb2NrZXQuaW8gbm90IGZvdW5kIScpO1xuICAgIC8vICAgICByZXR1cm4gd2luZG93LmlvKHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4pO1xuICAgIC8vIH0pO1xuXG4gICAgLy8gQVVUSF9FVkVOVFMgaXMgdXNlZCB0aHJvdWdob3V0IG91ciBhcHAgdG9cbiAgICAvLyBicm9hZGNhc3QgYW5kIGxpc3RlbiBmcm9tIGFuZCB0byB0aGUgJHJvb3RTY29wZVxuICAgIC8vIGZvciBpbXBvcnRhbnQgZXZlbnRzIGFib3V0IGF1dGhlbnRpY2F0aW9uIGZsb3cuXG4gICAgYXBwLmNvbnN0YW50KCdBVVRIX0VWRU5UUycsIHtcbiAgICAgICAgbG9naW5TdWNjZXNzOiAnYXV0aC1sb2dpbi1zdWNjZXNzJyxcbiAgICAgICAgbG9naW5GYWlsZWQ6ICdhdXRoLWxvZ2luLWZhaWxlZCcsXG4gICAgICAgIGxvZ291dFN1Y2Nlc3M6ICdhdXRoLWxvZ291dC1zdWNjZXNzJyxcbiAgICAgICAgc2Vzc2lvblRpbWVvdXQ6ICdhdXRoLXNlc3Npb24tdGltZW91dCcsXG4gICAgICAgIG5vdEF1dGhlbnRpY2F0ZWQ6ICdhdXRoLW5vdC1hdXRoZW50aWNhdGVkJyxcbiAgICAgICAgbm90QXV0aG9yaXplZDogJ2F1dGgtbm90LWF1dGhvcml6ZWQnXG4gICAgfSk7XG5cbiAgICBhcHAuZmFjdG9yeSgnQXV0aEludGVyY2VwdG9yJywgZnVuY3Rpb24gKCRyb290U2NvcGUsICRxLCBBVVRIX0VWRU5UUykge1xuICAgICAgICB2YXIgc3RhdHVzRGljdCA9IHtcbiAgICAgICAgICAgIDQwMTogQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCxcbiAgICAgICAgICAgIDQwMzogQVVUSF9FVkVOVFMubm90QXV0aG9yaXplZCxcbiAgICAgICAgICAgIDQxOTogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsXG4gICAgICAgICAgICA0NDA6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZUVycm9yOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3Qoc3RhdHVzRGljdFtyZXNwb25zZS5zdGF0dXNdLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdChyZXNwb25zZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9KTtcblxuICAgIGFwcC5jb25maWcoZnVuY3Rpb24gKCRodHRwUHJvdmlkZXIpIHtcbiAgICAgICAgJGh0dHBQcm92aWRlci5pbnRlcmNlcHRvcnMucHVzaChbXG4gICAgICAgICAgICAnJGluamVjdG9yJyxcbiAgICAgICAgICAgIGZ1bmN0aW9uICgkaW5qZWN0b3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJGluamVjdG9yLmdldCgnQXV0aEludGVyY2VwdG9yJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIF0pO1xuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ0F1dGhTZXJ2aWNlJywgZnVuY3Rpb24gKCRodHRwLCBTZXNzaW9uLCAkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUywgJHEpIHtcblxuICAgICAgICBmdW5jdGlvbiBvblN1Y2Nlc3NmdWxMb2dpbihyZXNwb25zZSkge1xuICAgICAgICAgICAgdmFyIHVzZXIgPSByZXNwb25zZS5kYXRhLnVzZXI7XG4gICAgICAgICAgICBTZXNzaW9uLmNyZWF0ZSh1c2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MpO1xuICAgICAgICAgICAgcmV0dXJuIHVzZXI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVc2VzIHRoZSBzZXNzaW9uIGZhY3RvcnkgdG8gc2VlIGlmIGFuXG4gICAgICAgIC8vIGF1dGhlbnRpY2F0ZWQgdXNlciBpcyBjdXJyZW50bHkgcmVnaXN0ZXJlZC5cbiAgICAgICAgdGhpcy5pc0F1dGhlbnRpY2F0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gISFTZXNzaW9uLnVzZXI7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5nZXRMb2dnZWRJblVzZXIgPSBmdW5jdGlvbiAoZnJvbVNlcnZlcikge1xuXG4gICAgICAgICAgICAvLyBJZiBhbiBhdXRoZW50aWNhdGVkIHNlc3Npb24gZXhpc3RzLCB3ZVxuICAgICAgICAgICAgLy8gcmV0dXJuIHRoZSB1c2VyIGF0dGFjaGVkIHRvIHRoYXQgc2Vzc2lvblxuICAgICAgICAgICAgLy8gd2l0aCBhIHByb21pc2UuIFRoaXMgZW5zdXJlcyB0aGF0IHdlIGNhblxuICAgICAgICAgICAgLy8gYWx3YXlzIGludGVyZmFjZSB3aXRoIHRoaXMgbWV0aG9kIGFzeW5jaHJvbm91c2x5LlxuXG4gICAgICAgICAgICAvLyBPcHRpb25hbGx5LCBpZiB0cnVlIGlzIGdpdmVuIGFzIHRoZSBmcm9tU2VydmVyIHBhcmFtZXRlcixcbiAgICAgICAgICAgIC8vIHRoZW4gdGhpcyBjYWNoZWQgdmFsdWUgd2lsbCBub3QgYmUgdXNlZC5cblxuICAgICAgICAgICAgaWYgKHRoaXMuaXNBdXRoZW50aWNhdGVkKCkgJiYgZnJvbVNlcnZlciAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAkcS53aGVuKFNlc3Npb24udXNlcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE1ha2UgcmVxdWVzdCBHRVQgL3Nlc3Npb24uXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgdXNlciwgY2FsbCBvblN1Y2Nlc3NmdWxMb2dpbiB3aXRoIHRoZSByZXNwb25zZS5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSA0MDEgcmVzcG9uc2UsIHdlIGNhdGNoIGl0IGFuZCBpbnN0ZWFkIHJlc29sdmUgdG8gbnVsbC5cbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9zZXNzaW9uJykudGhlbihvblN1Y2Nlc3NmdWxMb2dpbikuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxvZ2luID0gZnVuY3Rpb24gKGNyZWRlbnRpYWxzKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAucG9zdCgnL2xvZ2luJywgY3JlZGVudGlhbHMpXG4gICAgICAgICAgICAgICAgLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdCh7IG1lc3NhZ2U6ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLicgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvbG9nb3V0JykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgU2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxuICAgIGFwcC5zZXJ2aWNlKCdTZXNzaW9uJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIEFVVEhfRVZFTlRTKSB7XG5cbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMudXNlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jcmVhdGUgPSBmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgdGhpcy51c2VyID0gdXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnVzZXIgPSBudWxsO1xuICAgICAgICB9O1xuXG4gICAgfSk7XG5cbn0oKSk7XG4iLCJhcHAuZGlyZWN0aXZlKCduYXZiYXInLCBmdW5jdGlvbigpe1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnRScsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuaHRtbCcsXG5cdH1cbn0pO1xuIiwiYXBwLmRpcmVjdGl2ZSggJ25iYVRlYW1SZXBlYXQnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0UnLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvZGlyZWN0aXZlcy9uYmEtdGVhbS9uYmEtdGVhbS5odG1sJyxcblx0XHRzY29wZToge1xuXHRcdFx0bmJhdGVhbXM6ICc9J1xuXHRcdH1cblx0fVxufSk7XG5cbiIsImFwcC5jb250cm9sbGVyKCdUYWJNZW51Q29udHJvbGxlcicsIGZ1bmN0aW9uKCRzY29wZSwgVXNlckZhY3Rvcnkpe1xuXHQkc2NvcGUudGVhbUlkID0gVXNlckZhY3RvcnkuZ2V0U2VsZWN0ZWRUZWFtSUQoKTtcblx0JHNjb3BlLmxlYWd1ZUlkID0gVXNlckZhY3RvcnkuZ2V0U2VsZWN0ZWRMZWFndWVJRCgpO1xufSk7XG4iLCJhcHAuZGlyZWN0aXZlKCd0YWJtZW51JywgZnVuY3Rpb24oKXtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0UnLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvZGlyZWN0aXZlcy90YWJNZW51L3RhYk1lbnUuaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ1RhYk1lbnVDb250cm9sbGVyJ1xuXHR9XG59KTtcbiIsImFwcC5mYWN0b3J5KCAnQ29va2llRmFjdG9yeScsIGZ1bmN0aW9uKCl7XG5cblx0bGV0IGNvb2tpZU9iaiA9IHt9O1xuXG5cdGZ1bmN0aW9uIGlzQ29va2llKCl7XG5cdFx0aWYgKCBkb2N1bWVudC5jb29raWUgKXtcblx0XHRcdHBhcnNlVXNlckluZm8oKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBzZXRDb29raWUobG9naW5JbmZvKXtcblx0XHRjb29raWVPYmouZW1haWwgPSBsb2dpbkluZm8uZW1haWw7XG5cdFx0Y29va2llT2JqLnBhc3N3b3JkID0gbG9naW5JbmZvLnBhc3N3b3JkO1xuXHRcdGRvY3VtZW50LmNvb2tpZSA9ICd1c2VySW5mb0pTT049JyArIEpTT04uc3RyaW5naWZ5KCBjb29raWVPYmogKTtcblx0XHRyZXNldENvb2tpZUV4cGlyZSgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gcmVzZXRDb29raWVFeHBpcmUoKXtcblx0XHRsZXQgY3VycmVudERhdGUgPSBuZXcgRGF0ZSgpO1xuXHRcdGxldCBleHBpcmVEYXRlID0gbmV3IERhdGUoIGN1cnJlbnREYXRlLnNldE1vbnRoKCBjdXJyZW50RGF0ZS5nZXRNb250aCgpICsgNikpO1xuXHRcdGRvY3VtZW50LmNvb2tpZSA9ICdleHBpcmVzPScgKyBleHBpcmVEYXRlLnRvVVRDU3RyaW5nKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRDb29raWUoKXtcblx0XHRyZXR1cm4gY29va2llT2JqO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFyc2VVc2VySW5mbygpe1xuXHRcdGxldCBwYXJzZUluZm8gPSBkb2N1bWVudC5jb29raWUuc3BsaXQoJz0nKTtcblx0XHRsZXQgdXNlckluZm8gPSBwYXJzZUluZm9bMV0uc3BsaXQoJzsnKVswXTtcblx0XHRjb29raWVPYmogPSBKU09OLnBhcnNlKHVzZXJJbmZvKTtcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0aXNDb29raWU6IGlzQ29va2llLFxuXHRcdHNldENvb2tpZTogc2V0Q29va2llLFxuXHRcdGdldENvb2tpZTogZ2V0Q29va2llLFxuXHR9XG5cbn0pO1xuIiwiYXBwLmNvbnRyb2xsZXIoICdMZWFndWVDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCAkaHR0cCwgTGVhZ3VlRmFjdG9yeSApe1xuXG5cdCRzY29wZS50YWIgPSB7IGxlYWd1ZTogJ2FjdGl2ZScgfVxuXG5cdExlYWd1ZUZhY3RvcnkuZ2V0TGVhZ3VlVGVhbXNGcm9tU2VydmVyKCk7XG5cblx0JHNjb3BlLmdldExlYWd1ZVRlYW1zID0gTGVhZ3VlRmFjdG9yeS5nZXRMZWFndWVUZWFtcztcblxufSk7XG4iLCJhcHAuZmFjdG9yeSgnTGVhZ3VlRmFjdG9yeScsIGZ1bmN0aW9uKCRodHRwLCAkc3RhdGVQYXJhbXMsIFRlYW1GYWN0b3J5KXtcblxuXHRsZXQgbGVhZ3VlVGVhbXMgPSBbXTtcblxuXHRmdW5jdGlvbiBnZXRMZWFndWVUZWFtc0Zyb21TZXJ2ZXIoKXtcblx0XHQkaHR0cC5nZXQoJy9hcGkvbGVhZ3VlLycgKyAkc3RhdGVQYXJhbXMuaWQgKyAnL3RlYW1zJyApXG5cdFx0LnRoZW4oIHJlc3BvbnNlID0+IHtcblx0XHRcdGxlYWd1ZVRlYW1zID0gcmVzcG9uc2UuZGF0YTtcblx0XHR9KVxuXHR9XG5cblx0ZnVuY3Rpb24gdXBkYXRlTGVhZ3VlVGVhbXMoKXtcblx0XHRsZWFndWVUZWFtcy5mb3JFYWNoKCB0ZWFtID0+IHtcblx0XHRcdHRlYW0udG90YWxXaW5zID0gVGVhbUZhY3RvcnkuZ2V0VGVhbVRvdGFsV2lucyh0ZWFtLnRlYW1zKVxuXHRcdH0pXG5cdH1cblxuXHRmdW5jdGlvbiBnZXRMZWFndWVUZWFtcygpe1xuXHRcdHVwZGF0ZUxlYWd1ZVRlYW1zKCk7XG5cdFx0cmV0dXJuIGxlYWd1ZVRlYW1zO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRnZXRMZWFndWVUZWFtc0Zyb21TZXJ2ZXI6IGdldExlYWd1ZVRlYW1zRnJvbVNlcnZlcixcblx0XHRnZXRMZWFndWVUZWFtczogZ2V0TGVhZ3VlVGVhbXNcblx0fVxuXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpe1xuXHQkc3RhdGVQcm92aWRlci5zdGF0ZSggJ2xlYWd1ZScsIHtcblx0XHR1cmw6ICcvbGVhZ3VlLzppZCcsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy92aWV3cy9sZWFndWUvbGVhZ3VlLmh0bWwnLFxuXHRcdGNvbnRyb2xsZXI6ICdMZWFndWVDdHJsJ1xuXHR9KVxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyKXtcblxuXHQkc3RhdGVQcm92aWRlci5zdGF0ZSgnbG9naW4nLCB7XG5cdFx0dXJsOiAnL2xvZ2luJyxcblx0XHR0ZW1wbGF0ZVVybDogJ2pzL3ZpZXdzL2xvZ2luL2xvZ2luLmh0bWwnLFxuXHRcdGNvbnRyb2xsZXI6ICdMb2dpbkN0cmwnXG5cdH0pXG59KTtcbiIsImFwcC5jb250cm9sbGVyKCdMb2dpbkN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCBMb2dpbkZhY3RvcnksIENvb2tpZUZhY3RvcnksIE5CQV9MZWFndWVfRmFjdG9yeSkge1xuICAgICRzY29wZS5sb2dpbiA9IHt9O1xuICAgICRzY29wZS5lcnJvciA9IG51bGw7XG4gICAgJHNjb3BlLmlzTG9naW5TdGF0ZSA9ICgpID0+IHtyZXR1cm4gdHJ1ZTt9XG5cbiAgICBOQkFfTGVhZ3VlX0ZhY3Rvcnkua2lja09mZk5CQVRlYW1XaW5HZXR0ZXIoKTsgLy8gU3RhcnQgcmlnaHQgd2hlbiB3ZSBoaXQgdGhlIGxvZ2luIHBhZ2VcblxuICAgIGZ1bmN0aW9uIHNlbmRMb2dpbk5vdyhsb2dpbkluZm8pe1xuXG4gICAgICAgICRzY29wZS5lcnJvciA9IG51bGw7XG4gICAgICAgIExvZ2luRmFjdG9yeS5zZW5kTG9naW4obG9naW5JbmZvKVxuICAgICAgICAuY2F0Y2goICgpID0+IHsgJHNjb3BlLmVycm9yID0gJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJyB9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGd1ZXN0TG9naW4oKXtcbiAgICAgICAgc2VuZExvZ2luTm93KHsgZW1haWw6ICdqb2V5QGpvZXkuY29tJywgcGFzc3dvcmQ6ICdqb2V5J30pXG4gICAgfVxuXG4gICAgJHNjb3BlLnNlbmRMb2dpbiA9IHNlbmRMb2dpbk5vdztcbiAgICAkc2NvcGUuZ3Vlc3RMb2dpbiA9IGd1ZXN0TG9naW47XG5cbiAgICBpZiAoIENvb2tpZUZhY3RvcnkuaXNDb29raWUoKSApe1xuXHRcdHNlbmRMb2dpbk5vdyggQ29va2llRmFjdG9yeS5nZXRDb29raWUoKSApO1xuICAgIH1cblxufSk7XG4iLCJhcHAuZmFjdG9yeSggJ0xvZ2luRmFjdG9yeScsIGZ1bmN0aW9uKCBBdXRoU2VydmljZSwgJHN0YXRlLCBVc2VyRmFjdG9yeSwgQ29va2llRmFjdG9yeSApe1xuXG4gICAgZnVuY3Rpb24gc2VuZExvZ2luKGxvZ2luSW5mbyl7XG4gICAgICAgIHJldHVybiBBdXRoU2VydmljZS5sb2dpbihsb2dpbkluZm8pXG4gICAgICAgIC50aGVuKCAoKSA9PiBDb29raWVGYWN0b3J5LnNldENvb2tpZShsb2dpbkluZm8pKVxuICAgICAgICAudGhlbiggKCkgPT4gVXNlckZhY3RvcnkuaW5pdFVzZXJGYWN0b3J5KCkgKVxuICAgICAgICAudGhlbiggKCkgPT4geyAkc3RhdGUuZ28oJ3VzZXInKSB9KVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIHNlbmRMb2dpbjogc2VuZExvZ2luLFxuICAgIH1cblxufSk7XG4iLCJhcHAuY29udHJvbGxlciggJ05CQV9DdHJsJywgZnVuY3Rpb24oICRzY29wZSwgTkJBX0xlYWd1ZV9GYWN0b3J5KXtcblxuXHQkc2NvcGUudGFiID0geyBuYmFTdGFuZGluZ3M6ICdhY3RpdmUnIH1cblxuXHQkc2NvcGUubmJhVGVhbXNJbmZvID0gTkJBX0xlYWd1ZV9GYWN0b3J5LmdldE5CQVRlYW1JbmZvO1xuXG59KTtcbiIsImFwcC5mYWN0b3J5KCdOQkFfTGVhZ3VlX0ZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCl7XG5cblx0bGV0IG5iYVRlYW1JbmZvID0gW107XG5cdGxldCBuYmFUZWFtSW5mb09iaiA9IHt9O1xuXG5cdGZ1bmN0aW9uIHNjcmFwZUVTUE5odG1sKG5iYVBhZ2Upe1xuXHRcdGxldCB0ZWFtVG9rZW5pemVyID0gJzxzcGFuIGNsYXNzPVwidGVhbS1uYW1lc1wiPic7XG5cdFx0bGV0IHRlYW1Ub2tlbnMgPSBuYmFQYWdlLnNwbGl0KHRlYW1Ub2tlbml6ZXIpO1xuXG5cdFx0Ly8gQ2xlYXIgb2xkIGRhdGFcblx0XHRuYmFUZWFtSW5mbyA9IFtdO1xuXHRcdG5iYVRlYW1JbmZvT2JqID0ge307XG5cdFx0Ly8gUG9wdWxhdGUgbmJhIHRlYW0gaW5mbyBvYmplY3RzXG5cdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCB0ZWFtVG9rZW5zLmxlbmd0aDsgaSsrICl7IC8vIHN0YXJ0aW5nIGF0IDEgaGVyZSBiZWNhdXNlIHRoZSBmaXJzdCB0b2tlbiBpcyBnYXJiYWdlXG5cdFx0XHRuYmFUZWFtSW5mby5wdXNoKHBhcnNlVGVhbUluZm8oIHRlYW1Ub2tlbnNbaV0pICk7XG5cdFx0XHRuYmFUZWFtSW5mb09ialtuYmFUZWFtSW5mb1sgaSAtIDEgXS5hYmJyXSA9IE51bWJlcihuYmFUZWFtSW5mb1sgaSAtIDEgXS53aW5zKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZVRlYW1JbmZvKHRlYW1JbmZvU3RyKXtcblxuXHRcdGxldCB0ZWFtSW5mbyA9IHt9O1xuXHRcdC8vIFBhcnNlIHRlYW0gbmFtZVxuXHRcdGxldCBlbmRPZlRlYW1OYW1lTG9jID0gdGVhbUluZm9TdHIuaW5kZXhPZignPC9zcGFuPicpO1xuXHRcdHRlYW1JbmZvLm5hbWUgPSB0ZWFtSW5mb1N0ci5zbGljZSgwLCBlbmRPZlRlYW1OYW1lTG9jKTtcblxuXHRcdC8vIFBhcnNlIGFiYnJldmlhdGVkIHRlYW0gbmFtZVxuXHRcdGxldCBhYmJyVGFnU3RhcnQgPSAnPGFiYnIgdGl0bGU9XCInICsgdGVhbUluZm8ubmFtZSArICdcIj4nO1xuXHRcdGxldCBhYmJyVGFnRW5kID0gJzwvYWJicj4nO1xuXHRcdHRlYW1JbmZvLmFiYnIgPSB0ZWFtSW5mb1N0ci5zbGljZSggdGVhbUluZm9TdHIuaW5kZXhPZihhYmJyVGFnU3RhcnQpICsgYWJiclRhZ1N0YXJ0Lmxlbmd0aCwgdGVhbUluZm9TdHIuaW5kZXhPZihhYmJyVGFnRW5kKSk7XG5cblx0XHQvLyBQYXJzZSB0ZWFtIHdpbnNcblx0XHRsZXQgd2luc0FyciA9IHRlYW1JbmZvU3RyLnNwbGl0KCdjbGFzcz1cIlwiPicpXG5cdFx0bGV0IHdpbnMgPSB3aW5zQXJyWzFdLnNsaWNlKDAsIHdpbnNBcnJbMV0uaW5kZXhPZignPC90ZD4nKSk7XG5cdFx0dGVhbUluZm8ud2lucyA9IE51bWJlcih3aW5zKTtcblxuXHRcdHJldHVybiB0ZWFtSW5mbztcblx0fVxuXG5cdC8vIEVTUE4gTkJBIFdlYnNjcmFwZXIgZm9yIE5CQSB0ZWFtIGxlYWd1ZSBpbmZvXG5cdC8vIElucHV0OiBcdERlc2lyZWQgeWVhciBvZiBOQkEgdGVhbSBsZWFndWUgaW5mb3JtYXRpb24gaW4gdGhlIGZvcm1hdCBvZiBYWFhYXG5cdC8vIE91dHB1dDogXHRBbiBhcnJheSBvZiBhbGwgTkJBIHRlYW1zIGluIHRoZSBmb2xsb3dpbmcgZm9ybWF0OlxuXHQvL1x0XHRcdFx0eyBcdG5hbWU6ICdOQkEgVGVhbSBOYW1lJyxcblx0Ly9cdFx0XHRcdFx0YWJicjogJ05CQSBUZWFtIE5hbWUgQWJicmV2aWF0aW9uJyxcblx0Ly9cdFx0XHRcdFx0d2luczogJ05CQSBUZWFtIFdpbnMgZm9yIHllYXIgWFhYWCAnIH1cblx0Ly8gbm90ZXM6IEVTUE4gb25seSBwcm92aWRlcyBpbmZvIGRhdGluZyBiYWNrIHRvIDIwMDIuXG5cblx0ZnVuY3Rpb24gZ2V0TkJBVGVhbUluZm9Gcm9tRVNQTigpIHtcblxuXHRcdGxldCB5ZWFyID0gMjAxNzsgLy8gUmlnaHQgbm93IGp1c3Qgc2V0IHRvIGdldCBjdXJyZW50IHllYXJcblxuXHRcdGxldCBob3N0ID0gJ2h0dHBzOi8vd3d3LmVzcG4uY29tJztcblx0XHRsZXQgZXNwblBhdGggPVxuXHRcdFx0eWVhciA+PSAobmV3IERhdGUoKSkuZ2V0RnVsbFllYXIoKSB8fCB5ZWFyIDw9IDIwMDIgP1xuXHRcdFx0Jy9uYmEvc3RhbmRpbmdzL18vZ3JvdXAvbGVhZ3VlJyA6XG5cdFx0XHQnL25iYS9zdGFuZGluZ3MvXy9zZWFzb24vJyArIHllYXIgKyAnL2dyb3VwL2xlYWd1ZSc7XG5cblxuXHRcdCRodHRwLmdldCggaG9zdCArIGVzcG5QYXRoIClcblx0XHQudGhlbiggZXNwbk5CQVBhZ2UgPT4ge1xuXHRcdFx0c2NyYXBlRVNQTmh0bWwoZXNwbk5CQVBhZ2UuZGF0YSlcblx0XHR9KVxuXHRcdC5jYXRjaChjb25zb2xlLmVycm9yKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGtpY2tPZmZOQkFUZWFtV2luR2V0dGVyKCl7XG5cdFx0Z2V0TkJBVGVhbUluZm9Gcm9tRVNQTigpO1x0XHRcdFx0XHQvLyBLaWNrIGl0IG9mZiByaWdodCBhd2F5IHNvIHdlIGhhdmUgZGF0YSB0byBkaXNwbGF5XG5cdFx0c2V0SW50ZXJ2YWwoIGdldE5CQVRlYW1JbmZvRnJvbUVTUE4sIDYwMDAwKTsgLy8gVGhlbiB1cGRhdGUgb25jZSBhIG1pbnV0ZVxuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRnZXROQkFUZWFtSW5mbzogKCkgPT4gbmJhVGVhbUluZm8sXG5cdFx0Z2V0TkJBVGVhbUluZm9PYmo6ICgpID0+IG5iYVRlYW1JbmZvT2JqLFxuXHRcdGtpY2tPZmZOQkFUZWFtV2luR2V0dGVyOiBraWNrT2ZmTkJBVGVhbVdpbkdldHRlclxuXHR9XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyggJHN0YXRlUHJvdmlkZXIgPT4ge1xuXHQkc3RhdGVQcm92aWRlci5zdGF0ZSggJ25iYUxlYWd1ZScsIHtcblx0XHR1cmw6ICcvbmJhLXN0YW5kaW5ncycsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy92aWV3cy9uYmEtbGVhZ3VlL25iYS5sZWFndWUuaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ05CQV9DdHJsJ1xuXHR9KVxufSlcbiIsImFwcC5jb250cm9sbGVyKCAnVGVhbUN0cmwnLCAoJHNjb3BlLCBUZWFtRmFjdG9yeSkgPT4ge1xuXHQkc2NvcGUudGFiID0geyB0ZWFtOiAnYWN0aXZlJyB9XG5cblx0Ly8gU2V0dXAgdG8gbGl2ZSB1cGRhdGUgd2hlbiBlYWNoIEVTUE4gc2NyYXBlXG5cdFRlYW1GYWN0b3J5LmdldFRlYW1Gcm9tU2VydmVyKCk7XG5cdCRzY29wZS5nZXROQkFUZWFtcyA9IFRlYW1GYWN0b3J5LmdldE5CQVRlYW1zO1xuXHQkc2NvcGUuZ2V0TkJBVGVhbVdpbnMgPSBUZWFtRmFjdG9yeS5nZXROQkFUZWFtV2lucztcblx0JHNjb3BlLmdldFRlYW1Ub3RhbFdpbnMgPSBUZWFtRmFjdG9yeS5nZXRUZWFtVG90YWxXaW5zO1xuXG59KTtcbiIsImFwcC5mYWN0b3J5KCAnVGVhbUZhY3RvcnknLCAoICRodHRwLCAkc3RhdGVQYXJhbXMsICRsb2csIE5CQV9MZWFndWVfRmFjdG9yeSApID0+IHtcblxuXHRsZXQgTkJBdGVhbXMgPSBbXTtcblxuXHRmdW5jdGlvbiBnZXRUZWFtRnJvbVNlcnZlcigpe1xuXG5cdFx0JGh0dHAuZ2V0KCdhcGkvdGVhbS8nICsgJHN0YXRlUGFyYW1zLmlkICsgJy9uYmFfdGVhbXMnKVxuXHRcdC50aGVuKCByZXNwb25zZSA9PiB7XG5cdFx0XHROQkF0ZWFtcyA9IHJlc3BvbnNlLmRhdGE7XG5cdFx0fSlcblx0XHQuY2F0Y2goJGxvZylcblx0fVxuXG5cdGZ1bmN0aW9uIHVwZGF0ZU5CQVRlYW1zKCl7XG5cdFx0TkJBdGVhbXMuZm9yRWFjaCggdGVhbSA9PiB7XG5cdFx0XHR0ZWFtLndpbnMgPSBnZXROQkFUZWFtV2lucyh0ZWFtLmFiYnIpO1xuXHRcdH0pXG5cdH1cblxuXHRmdW5jdGlvbiBnZXROQkFUZWFtV2lucyhhYmJyKXtcblx0XHRsZXQgbGl2ZU5CQVRlYW1JbmZvT2JqID0gTkJBX0xlYWd1ZV9GYWN0b3J5LmdldE5CQVRlYW1JbmZvT2JqKCk7XG5cdFx0cmV0dXJuIGxpdmVOQkFUZWFtSW5mb09ialthYmJyXTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFRlYW1Ub3RhbFdpbnModGVhbXMpe1xuXHRcdGxldCBzdW0gPSAwO1xuXHRcdGxldCBsaXZlTkJBVGVhbUluZm9PYmogPSBOQkFfTGVhZ3VlX0ZhY3RvcnkuZ2V0TkJBVGVhbUluZm9PYmooKTtcblxuXHRcdHRlYW1zLmZvckVhY2goIHRlYW0gPT4ge1xuXHRcdFx0c3VtICs9IE51bWJlcihsaXZlTkJBVGVhbUluZm9PYmpbdGVhbS5hYmJyXSk7XG5cdFx0fSlcblxuXHRcdHJldHVybiBzdW07XG5cdH1cblxuXHQvLyBEb2luZyB0aGlzIHRvIGFsbG93IGZvciBzb3J0aW5nIHRoZSB0ZWFtcyBieSB3aW5zXG5cdGZ1bmN0aW9uIGdldE5CQVRlYW1zKCl7XG5cdFx0dXBkYXRlTkJBVGVhbXMoKTtcblx0XHRyZXR1cm4gTkJBdGVhbXM7XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGdldE5CQVRlYW1zOiBnZXROQkFUZWFtcyxcblx0XHRnZXRUZWFtVG90YWxXaW5zOiBnZXRUZWFtVG90YWxXaW5zLFxuXHRcdGdldFRlYW1Gcm9tU2VydmVyOiBnZXRUZWFtRnJvbVNlcnZlclxuXHR9XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyggJHN0YXRlUHJvdmlkZXIgPT4ge1xuXG5cdCRzdGF0ZVByb3ZpZGVyLnN0YXRlKCAndGVhbScsIHtcblx0XHR1cmw6ICcvdGVhbS86aWQnLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvdmlld3MvdGVhbS90ZWFtLmh0bWwnLFxuXHRcdGNvbnRyb2xsZXI6ICdUZWFtQ3RybCcsXG5cdH0pO1xuXG59KTtcbiIsImFwcC5jb250cm9sbGVyKCdVc2VyQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgVXNlckZhY3Rvcnkpe1xuXG5cdCRzY29wZS50YWIgPSB7IGhvbWU6ICdhY3RpdmUnIH07XG5cblx0JHNjb3BlLnVzZXJUZWFtcyA9IFVzZXJGYWN0b3J5LmdldFVzZXJUZWFtcygpO1xuXG5cdCRzY29wZS5zZWxlY3RlZFRlYW1JRCA9IFVzZXJGYWN0b3J5LmdldFNlbGVjdGVkVGVhbUlEKCk7XG5cblx0JHNjb3BlLnNlbGVjdGVkTGVhZ3VlSUQgPSBVc2VyRmFjdG9yeS5nZXRTZWxlY3RlZExlYWd1ZUlEKCk7XG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoICdVc2VyRmFjdG9yeScsIGZ1bmN0aW9uKCRodHRwLCBTZXNzaW9uLCAkbG9nKXtcblxuXHRsZXQgdXNlclRlYW1zID0gW107XG5cdGxldCB1c2VyU2VsZWN0ZWRUZWFtSUQgPSB1bmRlZmluZWQ7XG5cdGxldCB1c2VyU2VsZWN0ZWRMZWFndWVJRCA9IHVuZGVmaW5lZDtcblxuXHRmdW5jdGlvbiBpbml0VXNlckZhY3RvcnkoKXtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCdhcGkvdGVhbS91c2VyLycgKyBTZXNzaW9uLnVzZXIuaWQgKVxuXHRcdC50aGVuKCByZXNwb25zZSA9PiB7XG5cdFx0XHR1c2VyVGVhbXMgPSByZXNwb25zZS5kYXRhO1xuXHRcdFx0Ly8gSW50aWFsaXplIHRoZXNlIHRvIGZpcnN0IHRlYW0gYW5kIGxlYWd1ZSB0byBzdGFydFxuXHRcdFx0dXNlclNlbGVjdGVkVGVhbUlEID0gdXNlclRlYW1zWzBdLmlkO1xuXHRcdFx0dXNlclNlbGVjdGVkTGVhZ3VlSUQgPSB1c2VyVGVhbXNbMF0ubGVhZ3VlLmlkO1xuXHRcdH0pXG5cdFx0LmNhdGNoKCRsb2cpXG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGluaXRVc2VyRmFjdG9yeTogaW5pdFVzZXJGYWN0b3J5LFxuXHRcdGdldFVzZXJUZWFtczogKCkgPT4gdXNlclRlYW1zLFxuXHRcdGdldFNlbGVjdGVkVGVhbUlEOiAoKSA9PiB1c2VyU2VsZWN0ZWRUZWFtSUQsXG5cdFx0Z2V0U2VsZWN0ZWRMZWFndWVJRDogKCkgPT4gdXNlclNlbGVjdGVkTGVhZ3VlSUQsXG5cdH1cblxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyKXtcblxuXHQkc3RhdGVQcm92aWRlci5zdGF0ZSgndXNlcicsIHtcblx0XHR1cmw6ICcvdXNlcicsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy92aWV3cy91c2VyL3VzZXIuaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ1VzZXJDdHJsJ1xuXHR9KVxuXG59KTtcbiJdfQ==
