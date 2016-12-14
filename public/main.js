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

app.controller('LeagueCtrl', function ($scope, $http, LeagueFactory) {

  $scope.tab = { league: 'active' };

  LeagueFactory.getLeagueTeams().then(function (leagueTeams) {
    $scope.teams = leagueTeams;
  });
});

app.factory('LeagueFactory', function ($http, $stateParams) {

  function getLeagueTeams() {
    return $http.get('/api/league/' + $stateParams.id + '/teams').then(function (response) {
      console.log(response.data);
      return response.data;
    });
  }

  return {
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

app.controller('LoginCtrl', function ($scope, LoginFactory, CookieFactory) {
  $scope.login = {};
  $scope.error = null;
  $scope.isLoginState = function () {
    return true;
  };

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

  // For now just making an IIFE will make more
  // performant later
  (function getNBATeamInfo() {
    return $http.get('api/nba-teams/wins/2016').then(function (response) {
      nbaTeamInfo = response.data;
    }).catch($log);
  })();

  return {
    getNBATeamInfo: function getNBATeamInfo() {
      return nbaTeamInfo;
    }
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

  TeamFactory.getTeams().then(function (teams) {
    $scope.nbaTeams = teams;
    $scope.teamTotalWins = TeamFactory.getTeamWinTotal();
  });
});

app.factory('TeamFactory', function ($http, $stateParams, $log) {

  var teamTotalWins = 0;

  function getTeams() {

    return $http.get('api/team/' + $stateParams.id + '/nba_teams').then(function (response) {
      teamTotalWins = 0;
      response.data.forEach(function (team) {
        teamTotalWins += team.wins;
      });
      return response.data;
    }).catch($log);
  }

  return {
    getTeams: getTeams,
    getTeamWinTotal: function getTeamWinTotal() {
      return teamTotalWins;
    }
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsInByZS1idWlsdC9wcmUtYnVpbHQuanMiLCJkaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuanMiLCJkaXJlY3RpdmVzL3RhYk1lbnUvdGFiTWVudS5jb250cm9sbGVyLmpzIiwiZGlyZWN0aXZlcy90YWJNZW51L3RhYk1lbnUuanMiLCJ2aWV3cy9jb29raWVzL2Nvb2tpZUZhY3RvcnkuanMiLCJ2aWV3cy9sZWFndWUvbGVhZ3VlLmNvbnRyb2xsZXIuanMiLCJ2aWV3cy9sZWFndWUvbGVhZ3VlLmZhY3RvcnkuanMiLCJ2aWV3cy9sZWFndWUvbGVhZ3VlLnN0YXRlLmpzIiwidmlld3MvbG9naW4vbG9naW4uc3RhdGUuanMiLCJ2aWV3cy9sb2dpbi9sb2dpbkNvbnRyb2xsZXIuanMiLCJ2aWV3cy9sb2dpbi9sb2dpbkZhY3RvcnkuanMiLCJ2aWV3cy9uYmEtbGVhZ3VlL25iYS5sZWFndWUuY29udHJvbGxlci5qcyIsInZpZXdzL25iYS1sZWFndWUvbmJhLmxlYWd1ZS5mYWN0b3J5LmpzIiwidmlld3MvbmJhLWxlYWd1ZS9uYmEubGVhZ3VlLnN0YXRlLmpzIiwidmlld3MvdGVhbS90ZWFtLmNvbnRyb2xsZXIuanMiLCJ2aWV3cy90ZWFtL3RlYW0uZmFjdG9yeS5qcyIsInZpZXdzL3RlYW0vdGVhbS5zdGF0ZS5qcyIsInZpZXdzL3VzZXIvdXNlci5jb250cm9sbGVyLmpzIiwidmlld3MvdXNlci91c2VyLmZhY3RvcnkuanMiLCJ2aWV3cy91c2VyL3VzZXIuc3RhdGUuanMiXSwibmFtZXMiOlsid2luZG93IiwiYXBwIiwiYW5ndWxhciIsIm1vZHVsZSIsImNvbmZpZyIsIiR1cmxSb3V0ZXJQcm92aWRlciIsIiRsb2NhdGlvblByb3ZpZGVyIiwiaHRtbDVNb2RlIiwib3RoZXJ3aXNlIiwid2hlbiIsImxvY2F0aW9uIiwicmVsb2FkIiwicnVuIiwiJHJvb3RTY29wZSIsIiRvbiIsImV2ZW50IiwidG9TdGF0ZSIsInRvUGFyYW1zIiwiZnJvbVN0YXRlIiwiZnJvbVBhcmFtcyIsInRocm93bkVycm9yIiwiY29uc29sZSIsImluZm8iLCJuYW1lIiwiZXJyb3IiLCJBdXRoU2VydmljZSIsIiRzdGF0ZSIsImRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGgiLCJzdGF0ZSIsImRhdGEiLCJhdXRoZW50aWNhdGUiLCJpc0F1dGhlbnRpY2F0ZWQiLCJwcmV2ZW50RGVmYXVsdCIsImdldExvZ2dlZEluVXNlciIsInRoZW4iLCJ1c2VyIiwiZ28iLCJFcnJvciIsImNvbnN0YW50IiwibG9naW5TdWNjZXNzIiwibG9naW5GYWlsZWQiLCJsb2dvdXRTdWNjZXNzIiwic2Vzc2lvblRpbWVvdXQiLCJub3RBdXRoZW50aWNhdGVkIiwibm90QXV0aG9yaXplZCIsImZhY3RvcnkiLCIkcSIsIkFVVEhfRVZFTlRTIiwic3RhdHVzRGljdCIsInJlc3BvbnNlRXJyb3IiLCJyZXNwb25zZSIsIiRicm9hZGNhc3QiLCJzdGF0dXMiLCJyZWplY3QiLCIkaHR0cFByb3ZpZGVyIiwiaW50ZXJjZXB0b3JzIiwicHVzaCIsIiRpbmplY3RvciIsImdldCIsInNlcnZpY2UiLCIkaHR0cCIsIlNlc3Npb24iLCJvblN1Y2Nlc3NmdWxMb2dpbiIsImNyZWF0ZSIsImZyb21TZXJ2ZXIiLCJjYXRjaCIsImxvZ2luIiwiY3JlZGVudGlhbHMiLCJwb3N0IiwibWVzc2FnZSIsImxvZ291dCIsImRlc3Ryb3kiLCJzZWxmIiwiZGlyZWN0aXZlIiwicmVzdHJpY3QiLCJ0ZW1wbGF0ZVVybCIsImNvbnRyb2xsZXIiLCIkc2NvcGUiLCJVc2VyRmFjdG9yeSIsInRlYW1JZCIsImdldFNlbGVjdGVkVGVhbUlEIiwibGVhZ3VlSWQiLCJnZXRTZWxlY3RlZExlYWd1ZUlEIiwiY29va2llT2JqIiwiaXNDb29raWUiLCJkb2N1bWVudCIsImNvb2tpZSIsInBhcnNlVXNlckluZm8iLCJzZXRDb29raWUiLCJsb2dpbkluZm8iLCJlbWFpbCIsInBhc3N3b3JkIiwiSlNPTiIsInN0cmluZ2lmeSIsInJlc2V0Q29va2llRXhwaXJlIiwiY3VycmVudERhdGUiLCJEYXRlIiwiZXhwaXJlRGF0ZSIsInNldE1vbnRoIiwiZ2V0TW9udGgiLCJ0b1VUQ1N0cmluZyIsImdldENvb2tpZSIsInBhcnNlSW5mbyIsInNwbGl0IiwidXNlckluZm8iLCJwYXJzZSIsIkxlYWd1ZUZhY3RvcnkiLCJ0YWIiLCJsZWFndWUiLCJnZXRMZWFndWVUZWFtcyIsInRlYW1zIiwibGVhZ3VlVGVhbXMiLCIkc3RhdGVQYXJhbXMiLCJpZCIsImxvZyIsIiRzdGF0ZVByb3ZpZGVyIiwidXJsIiwiTG9naW5GYWN0b3J5IiwiQ29va2llRmFjdG9yeSIsImlzTG9naW5TdGF0ZSIsInNlbmRMb2dpbk5vdyIsInNlbmRMb2dpbiIsImd1ZXN0TG9naW4iLCJpbml0VXNlckZhY3RvcnkiLCJOQkFfTGVhZ3VlX0ZhY3RvcnkiLCJuYmFTdGFuZGluZ3MiLCJuYmFUZWFtc0luZm8iLCJnZXROQkFUZWFtSW5mbyIsIiRsb2ciLCJuYmFUZWFtSW5mbyIsIlRlYW1GYWN0b3J5IiwidGVhbSIsImdldFRlYW1zIiwibmJhVGVhbXMiLCJ0ZWFtVG90YWxXaW5zIiwiZ2V0VGVhbVdpblRvdGFsIiwiZm9yRWFjaCIsIndpbnMiLCJob21lIiwidXNlclRlYW1zIiwiZ2V0VXNlclRlYW1zIiwic2VsZWN0ZWRUZWFtSUQiLCJzZWxlY3RlZExlYWd1ZUlEIiwidXNlclNlbGVjdGVkVGVhbUlEIiwidW5kZWZpbmVkIiwidXNlclNlbGVjdGVkTGVhZ3VlSUQiXSwibWFwcGluZ3MiOiJBQUFBOztBQUNBQSxPQUFBQyxHQUFBLEdBQUFDLFFBQUFDLE1BQUEsQ0FBQSxnQkFBQSxFQUFBLENBQUEsVUFBQSxFQUFBLFdBQUEsQ0FBQSxDQUFBOztBQUVBRixJQUFBRyxNQUFBLENBQUEsVUFBQUMsa0JBQUEsRUFBQUMsaUJBQUEsRUFBQTtBQUNBO0FBQ0FBLG9CQUFBQyxTQUFBLENBQUEsSUFBQTtBQUNBO0FBQ0FGLHFCQUFBRyxTQUFBLENBQUEsUUFBQTtBQUNBO0FBQ0FILHFCQUFBSSxJQUFBLENB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QUFDQXlHLGtCQUFBekYsU0FBQXJCLElBQUE7QUFDQTtBQUNBa0gsMkJBQUFKLFVBQUEsQ0FBQSxFQUFBMUIsRUFBQTtBQUNBZ0MsNkJBQUFOLFVBQUEsQ0FBQSxFQUFBL0IsTUFBQSxDQUFBSyxFQUFBO0FBQ0EsS0FOQSxFQU9BaEQsS0FQQSxDQU9BK0QsSUFQQSxDQUFBO0FBUUE7O0FBRUEsU0FBQTtBQUNBTCxxQkFBQUEsZUFEQTtBQUVBaUIsa0JBQUE7QUFBQSxhQUFBRCxTQUFBO0FBQUEsS0FGQTtBQUdBM0QsdUJBQUE7QUFBQSxhQUFBK0Qsa0JBQUE7QUFBQSxLQUhBO0FBSUE3RCx5QkFBQTtBQUFBLGFBQUErRCxvQkFBQTtBQUFBO0FBSkEsR0FBQTtBQU9BLENBeEJBOztBQ0FBaEosSUFBQUcsTUFBQSxDQUFBLFVBQUErRyxjQUFBLEVBQUE7O0FBRUFBLGlCQUFBdkYsS0FBQSxDQUFBLE1BQUEsRUFBQTtBQUNBd0YsU0FBQSxPQURBO0FBRUF6QyxpQkFBQSx5QkFGQTtBQUdBQyxnQkFBQTtBQUhBLEdBQUE7QUFNQSxDQVJBIiwiZmlsZSI6Im1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG53aW5kb3cuYXBwID0gYW5ndWxhci5tb2R1bGUoJ05CQV9QaWNrZW1fQXBwJywgWydwcmVCdWlsdCcsICd1aS5yb3V0ZXInXSk7XG5cbmFwcC5jb25maWcoZnVuY3Rpb24gKCR1cmxSb3V0ZXJQcm92aWRlciwgJGxvY2F0aW9uUHJvdmlkZXIpIHtcbiAgICAvLyBUaGlzIHR1cm5zIG9mZiBoYXNoYmFuZyB1cmxzICgvI2Fib3V0KSBhbmQgY2hhbmdlcyBpdCB0byBzb21ldGhpbmcgbm9ybWFsICgvYWJvdXQpXG4gICAgJGxvY2F0aW9uUHJvdmlkZXIuaHRtbDVNb2RlKHRydWUpO1xuICAgIC8vIElmIHdlIGdvIHRvIGEgVVJMIHRoYXQgdWktcm91dGVyIGRvZXNuJ3QgaGF2ZSByZWdpc3RlcmVkLCBnbyB0byB0aGUgXCIvXCIgdXJsLlxuICAgICR1cmxSb3V0ZXJQcm92aWRlci5vdGhlcndpc2UoJy9sb2dpbicpO1xuICAgIC8vIFRyaWdnZXIgcGFnZSByZWZyZXNoIHdoZW4gYWNjZXNzaW5nIGFuIE9BdXRoIHJvdXRlXG4gICAgJHVybFJvdXRlclByb3ZpZGVyLndoZW4oJy9hdXRoLzpwcm92aWRlcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xuICAgIH0pO1xufSk7XG5cbi8vIFRoaXMgYXBwLnJ1biBpcyBmb3IgbGlzdGVuaW5nIHRvIGVycm9ycyBicm9hZGNhc3RlZCBieSB1aS1yb3V0ZXIsIHVzdWFsbHkgb3JpZ2luYXRpbmcgZnJvbSByZXNvbHZlc1xuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSkge1xuICAgICRyb290U2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VFcnJvcicsIGZ1bmN0aW9uIChldmVudCwgdG9TdGF0ZSwgdG9QYXJhbXMsIGZyb21TdGF0ZSwgZnJvbVBhcmFtcywgdGhyb3duRXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5pbmZvKGBUaGUgZm9sbG93aW5nIGVycm9yIHdhcyB0aHJvd24gYnkgdWktcm91dGVyIHdoaWxlIHRyYW5zaXRpb25pbmcgdG8gc3RhdGUgXCIke3RvU3RhdGUubmFtZX1cIi4gVGhlIG9yaWdpbiBvZiB0aGlzIGVycm9yIGlzIHByb2JhYmx5IGEgcmVzb2x2ZSBmdW5jdGlvbjpgKTtcbiAgICAgICAgY29uc29sZS5lcnJvcih0aHJvd25FcnJvcik7XG4gICAgfSk7XG59KTtcblxuLy8gVGhpcyBhcHAucnVuIGlzIGZvciBjb250cm9sbGluZyBhY2Nlc3MgdG8gc3BlY2lmaWMgc3RhdGVzLlxuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuXG4gICAgLy8gVGhlIGdpdmVuIHN0YXRlIHJlcXVpcmVzIGFuIGF1dGhlbnRpY2F0ZWQgdXNlci5cbiAgICB2YXIgZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICByZXR1cm4gc3RhdGUuZGF0YSAmJiBzdGF0ZS5kYXRhLmF1dGhlbnRpY2F0ZTtcbiAgICB9O1xuXG4gICAgLy8gJHN0YXRlQ2hhbmdlU3RhcnQgaXMgYW4gZXZlbnQgZmlyZWRcbiAgICAvLyB3aGVuZXZlciB0aGUgcHJvY2VzcyBvZiBjaGFuZ2luZyBhIHN0YXRlIGJlZ2lucy5cbiAgICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlU3RhcnQnLCBmdW5jdGlvbiAoZXZlbnQsIHRvU3RhdGUsIHRvUGFyYW1zKSB7XG5cbiAgICAgICAgaWYgKCFkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoKHRvU3RhdGUpKSB7XG4gICAgICAgICAgICAvLyBUaGUgZGVzdGluYXRpb24gc3RhdGUgZG9lcyBub3QgcmVxdWlyZSBhdXRoZW50aWNhdGlvblxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSkge1xuICAgICAgICAgICAgLy8gVGhlIHVzZXIgaXMgYXV0aGVudGljYXRlZC5cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYW5jZWwgbmF2aWdhdGluZyB0byBuZXcgc3RhdGUuXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgLy8gSWYgYSB1c2VyIGlzIHJldHJpZXZlZCwgdGhlbiByZW5hdmlnYXRlIHRvIHRoZSBkZXN0aW5hdGlvblxuICAgICAgICAgICAgLy8gKHRoZSBzZWNvbmQgdGltZSwgQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkgd2lsbCB3b3JrKVxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlLCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbiwgZ28gdG8gXCJsb2dpblwiIHN0YXRlLlxuICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28odG9TdGF0ZS5uYW1lLCB0b1BhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbygnbG9naW4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9KTtcblxufSk7XG4iLCIoZnVuY3Rpb24gKCkge1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLy8gSG9wZSB5b3UgZGlkbid0IGZvcmdldCBBbmd1bGFyISBEdWgtZG95LlxuICAgIGlmICghd2luZG93LmFuZ3VsYXIpIHRocm93IG5ldyBFcnJvcignSSBjYW5cXCd0IGZpbmQgQW5ndWxhciEnKTtcblxuICAgIHZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgncHJlQnVpbHQnLCBbXSk7XG5cbiAgICAvLyBhcHAuZmFjdG9yeSgnU29ja2V0JywgZnVuY3Rpb24gKCkge1xuICAgIC8vICAgICBpZiAoIXdpbmRvdy5pbykgdGhyb3cgbmV3IEVycm9yKCdzb2NrZXQuaW8gbm90IGZvdW5kIScpO1xuICAgIC8vICAgICByZXR1cm4gd2luZG93LmlvKHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4pO1xuICAgIC8vIH0pO1xuXG4gICAgLy8gQVVUSF9FVkVOVFMgaXMgdXNlZCB0aHJvdWdob3V0IG91ciBhcHAgdG9cbiAgICAvLyBicm9hZGNhc3QgYW5kIGxpc3RlbiBmcm9tIGFuZCB0byB0aGUgJHJvb3RTY29wZVxuICAgIC8vIGZvciBpbXBvcnRhbnQgZXZlbnRzIGFib3V0IGF1dGhlbnRpY2F0aW9uIGZsb3cuXG4gICAgYXBwLmNvbnN0YW50KCdBVVRIX0VWRU5UUycsIHtcbiAgICAgICAgbG9naW5TdWNjZXNzOiAnYXV0aC1sb2dpbi1zdWNjZXNzJyxcbiAgICAgICAgbG9naW5GYWlsZWQ6ICdhdXRoLWxvZ2luLWZhaWxlZCcsXG4gICAgICAgIGxvZ291dFN1Y2Nlc3M6ICdhdXRoLWxvZ291dC1zdWNjZXNzJyxcbiAgICAgICAgc2Vzc2lvblRpbWVvdXQ6ICdhdXRoLXNlc3Npb24tdGltZW91dCcsXG4gICAgICAgIG5vdEF1dGhlbnRpY2F0ZWQ6ICdhdXRoLW5vdC1hdXRoZW50aWNhdGVkJyxcbiAgICAgICAgbm90QXV0aG9yaXplZDogJ2F1dGgtbm90LWF1dGhvcml6ZWQnXG4gICAgfSk7XG5cbiAgICBhcHAuZmFjdG9yeSgnQXV0aEludGVyY2VwdG9yJywgZnVuY3Rpb24gKCRyb290U2NvcGUsICRxLCBBVVRIX0VWRU5UUykge1xuICAgICAgICB2YXIgc3RhdHVzRGljdCA9IHtcbiAgICAgICAgICAgIDQwMTogQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCxcbiAgICAgICAgICAgIDQwMzogQVVUSF9FVkVOVFMubm90QXV0aG9yaXplZCxcbiAgICAgICAgICAgIDQxOTogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsXG4gICAgICAgICAgICA0NDA6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZUVycm9yOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3Qoc3RhdHVzRGljdFtyZXNwb25zZS5zdGF0dXNdLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdChyZXNwb25zZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9KTtcblxuICAgIGFwcC5jb25maWcoZnVuY3Rpb24gKCRodHRwUHJvdmlkZXIpIHtcbiAgICAgICAgJGh0dHBQcm92aWRlci5pbnRlcmNlcHRvcnMucHVzaChbXG4gICAgICAgICAgICAnJGluamVjdG9yJyxcbiAgICAgICAgICAgIGZ1bmN0aW9uICgkaW5qZWN0b3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJGluamVjdG9yLmdldCgnQXV0aEludGVyY2VwdG9yJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIF0pO1xuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ0F1dGhTZXJ2aWNlJywgZnVuY3Rpb24gKCRodHRwLCBTZXNzaW9uLCAkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUywgJHEpIHtcblxuICAgICAgICBmdW5jdGlvbiBvblN1Y2Nlc3NmdWxMb2dpbihyZXNwb25zZSkge1xuICAgICAgICAgICAgdmFyIHVzZXIgPSByZXNwb25zZS5kYXRhLnVzZXI7XG4gICAgICAgICAgICBTZXNzaW9uLmNyZWF0ZSh1c2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MpO1xuICAgICAgICAgICAgcmV0dXJuIHVzZXI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVc2VzIHRoZSBzZXNzaW9uIGZhY3RvcnkgdG8gc2VlIGlmIGFuXG4gICAgICAgIC8vIGF1dGhlbnRpY2F0ZWQgdXNlciBpcyBjdXJyZW50bHkgcmVnaXN0ZXJlZC5cbiAgICAgICAgdGhpcy5pc0F1dGhlbnRpY2F0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gISFTZXNzaW9uLnVzZXI7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5nZXRMb2dnZWRJblVzZXIgPSBmdW5jdGlvbiAoZnJvbVNlcnZlcikge1xuXG4gICAgICAgICAgICAvLyBJZiBhbiBhdXRoZW50aWNhdGVkIHNlc3Npb24gZXhpc3RzLCB3ZVxuICAgICAgICAgICAgLy8gcmV0dXJuIHRoZSB1c2VyIGF0dGFjaGVkIHRvIHRoYXQgc2Vzc2lvblxuICAgICAgICAgICAgLy8gd2l0aCBhIHByb21pc2UuIFRoaXMgZW5zdXJlcyB0aGF0IHdlIGNhblxuICAgICAgICAgICAgLy8gYWx3YXlzIGludGVyZmFjZSB3aXRoIHRoaXMgbWV0aG9kIGFzeW5jaHJvbm91c2x5LlxuXG4gICAgICAgICAgICAvLyBPcHRpb25hbGx5LCBpZiB0cnVlIGlzIGdpdmVuIGFzIHRoZSBmcm9tU2VydmVyIHBhcmFtZXRlcixcbiAgICAgICAgICAgIC8vIHRoZW4gdGhpcyBjYWNoZWQgdmFsdWUgd2lsbCBub3QgYmUgdXNlZC5cblxuICAgICAgICAgICAgaWYgKHRoaXMuaXNBdXRoZW50aWNhdGVkKCkgJiYgZnJvbVNlcnZlciAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAkcS53aGVuKFNlc3Npb24udXNlcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE1ha2UgcmVxdWVzdCBHRVQgL3Nlc3Npb24uXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgdXNlciwgY2FsbCBvblN1Y2Nlc3NmdWxMb2dpbiB3aXRoIHRoZSByZXNwb25zZS5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSA0MDEgcmVzcG9uc2UsIHdlIGNhdGNoIGl0IGFuZCBpbnN0ZWFkIHJlc29sdmUgdG8gbnVsbC5cbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9zZXNzaW9uJykudGhlbihvblN1Y2Nlc3NmdWxMb2dpbikuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxvZ2luID0gZnVuY3Rpb24gKGNyZWRlbnRpYWxzKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAucG9zdCgnL2xvZ2luJywgY3JlZGVudGlhbHMpXG4gICAgICAgICAgICAgICAgLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdCh7IG1lc3NhZ2U6ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLicgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvbG9nb3V0JykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgU2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxuICAgIGFwcC5zZXJ2aWNlKCdTZXNzaW9uJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIEFVVEhfRVZFTlRTKSB7XG5cbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMudXNlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jcmVhdGUgPSBmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgdGhpcy51c2VyID0gdXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnVzZXIgPSBudWxsO1xuICAgICAgICB9O1xuXG4gICAgfSk7XG5cbn0oKSk7XG4iLCJhcHAuZGlyZWN0aXZlKCduYXZiYXInLCBmdW5jdGlvbigpe1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnRScsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuaHRtbCcsXG5cdH1cbn0pO1xuIiwiYXBwLmNvbnRyb2xsZXIoJ1RhYk1lbnVDb250cm9sbGVyJywgZnVuY3Rpb24oJHNjb3BlLCBVc2VyRmFjdG9yeSl7XG5cdCRzY29wZS50ZWFtSWQgPSBVc2VyRmFjdG9yeS5nZXRTZWxlY3RlZFRlYW1JRCgpO1xuXG5cdCRzY29wZS5sZWFndWVJZCA9IFVzZXJGYWN0b3J5LmdldFNlbGVjdGVkTGVhZ3VlSUQoKTtcbn0pOyIsImFwcC5kaXJlY3RpdmUoJ3RhYm1lbnUnLCBmdW5jdGlvbigpe1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnRScsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy9kaXJlY3RpdmVzL3RhYk1lbnUvdGFiTWVudS5odG1sJyxcblx0XHRjb250cm9sbGVyOiAnVGFiTWVudUNvbnRyb2xsZXInXG5cdH1cbn0pO1xuIiwiYXBwLmZhY3RvcnkoICdDb29raWVGYWN0b3J5JywgZnVuY3Rpb24oKXtcblxuXHRsZXQgY29va2llT2JqID0ge307XG5cblx0ZnVuY3Rpb24gaXNDb29raWUoKXtcblx0XHRpZiAoIGRvY3VtZW50LmNvb2tpZSApe1xuXHRcdFx0cGFyc2VVc2VySW5mbygpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHNldENvb2tpZShsb2dpbkluZm8pe1xuXHRcdGNvb2tpZU9iai5lbWFpbCA9IGxvZ2luSW5mby5lbWFpbDtcblx0XHRjb29raWVPYmoucGFzc3dvcmQgPSBsb2dpbkluZm8ucGFzc3dvcmQ7XG5cdFx0ZG9jdW1lbnQuY29va2llID0gJ3VzZXJJbmZvSlNPTj0nICsgSlNPTi5zdHJpbmdpZnkoIGNvb2tpZU9iaiApO1xuXHRcdHJlc2V0Q29va2llRXhwaXJlKCk7XG5cdH1cblxuXHRmdW5jdGlvbiByZXNldENvb2tpZUV4cGlyZSgpe1xuXHRcdGxldCBjdXJyZW50RGF0ZSA9IG5ldyBEYXRlKCk7XG5cdFx0bGV0IGV4cGlyZURhdGUgPSBuZXcgRGF0ZSggY3VycmVudERhdGUuc2V0TW9udGgoIGN1cnJlbnREYXRlLmdldE1vbnRoKCkgKyA2KSk7XG5cdFx0ZG9jdW1lbnQuY29va2llID0gJ2V4cGlyZXM9JyArIGV4cGlyZURhdGUudG9VVENTdHJpbmcoKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldENvb2tpZSgpe1xuXHRcdHJldHVybiBjb29raWVPYmo7XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZVVzZXJJbmZvKCl7XG5cdFx0bGV0IHBhcnNlSW5mbyA9IGRvY3VtZW50LmNvb2tpZS5zcGxpdCgnPScpO1xuXHRcdGxldCB1c2VySW5mbyA9IHBhcnNlSW5mb1sxXS5zcGxpdCgnOycpWzBdO1xuXHRcdGNvb2tpZU9iaiA9IEpTT04ucGFyc2UodXNlckluZm8pO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRpc0Nvb2tpZTogaXNDb29raWUsXG5cdFx0c2V0Q29va2llOiBzZXRDb29raWUsXG5cdFx0Z2V0Q29va2llOiBnZXRDb29raWUsXG5cdH1cblxufSk7XG4iLCJhcHAuY29udHJvbGxlciggJ0xlYWd1ZUN0cmwnLCBmdW5jdGlvbigkc2NvcGUsICRodHRwLCBMZWFndWVGYWN0b3J5KXtcblxuXHQkc2NvcGUudGFiID0geyBsZWFndWU6ICdhY3RpdmUnIH1cblxuXHRMZWFndWVGYWN0b3J5LmdldExlYWd1ZVRlYW1zKClcblx0LnRoZW4obGVhZ3VlVGVhbXMgPT4geyAkc2NvcGUudGVhbXMgPSBsZWFndWVUZWFtcyB9KVxufSk7XG4iLCJhcHAuZmFjdG9yeSgnTGVhZ3VlRmFjdG9yeScsIGZ1bmN0aW9uKCRodHRwLCAkc3RhdGVQYXJhbXMpe1xuXG5cdGZ1bmN0aW9uIGdldExlYWd1ZVRlYW1zKCl7XG5cdFx0cmV0dXJuICRodHRwLmdldCgnL2FwaS9sZWFndWUvJyArICRzdGF0ZVBhcmFtcy5pZCArICcvdGVhbXMnIClcblx0XHQudGhlbiggcmVzcG9uc2UgPT4ge1xuXHRcdFx0Y29uc29sZS5sb2cocmVzcG9uc2UuZGF0YSlcblx0XHRcdHJldHVybiByZXNwb25zZS5kYXRhO1xuXHRcdH0pXG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGdldExlYWd1ZVRlYW1zOiBnZXRMZWFndWVUZWFtcyxcblxuXHR9XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlcil7XG5cdCRzdGF0ZVByb3ZpZGVyLnN0YXRlKCAnbGVhZ3VlJywge1xuXHRcdHVybDogJy9sZWFndWUvOmlkJyxcblx0XHR0ZW1wbGF0ZVVybDogJ2pzL3ZpZXdzL2xlYWd1ZS9sZWFndWUuaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ0xlYWd1ZUN0cmwnXG5cdH0pXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpe1xuXG5cdCRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdsb2dpbicsIHtcblx0XHR1cmw6ICcvbG9naW4nLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvdmlld3MvbG9naW4vbG9naW4uaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ0xvZ2luQ3RybCdcblx0fSlcbn0pO1xuIiwiYXBwLmNvbnRyb2xsZXIoJ0xvZ2luQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIExvZ2luRmFjdG9yeSwgQ29va2llRmFjdG9yeSkge1xuICAgICRzY29wZS5sb2dpbiA9IHt9O1xuICAgICRzY29wZS5lcnJvciA9IG51bGw7XG4gICAgJHNjb3BlLmlzTG9naW5TdGF0ZSA9ICgpID0+IHtyZXR1cm4gdHJ1ZTt9XG5cbiAgICBmdW5jdGlvbiBzZW5kTG9naW5Ob3cobG9naW5JbmZvKXtcblxuICAgICAgICAkc2NvcGUuZXJyb3IgPSBudWxsO1xuICAgICAgICBMb2dpbkZhY3Rvcnkuc2VuZExvZ2luKGxvZ2luSW5mbylcbiAgICAgICAgLmNhdGNoKCAoKSA9PiB7ICRzY29wZS5lcnJvciA9ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLicgfSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBndWVzdExvZ2luKCl7XG4gICAgICAgIHNlbmRMb2dpbk5vdyh7IGVtYWlsOiAnam9leUBqb2V5LmNvbScsIHBhc3N3b3JkOiAnam9leSd9KVxuICAgIH1cblxuICAgICRzY29wZS5zZW5kTG9naW4gPSBzZW5kTG9naW5Ob3c7XG4gICAgJHNjb3BlLmd1ZXN0TG9naW4gPSBndWVzdExvZ2luO1xuXG4gICAgaWYgKCBDb29raWVGYWN0b3J5LmlzQ29va2llKCkgKXtcblx0XHRzZW5kTG9naW5Ob3coIENvb2tpZUZhY3RvcnkuZ2V0Q29va2llKCkgKTtcbiAgICB9XG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoICdMb2dpbkZhY3RvcnknLCBmdW5jdGlvbiggQXV0aFNlcnZpY2UsICRzdGF0ZSwgVXNlckZhY3RvcnksIENvb2tpZUZhY3RvcnkgKXtcblxuICAgIGZ1bmN0aW9uIHNlbmRMb2dpbihsb2dpbkluZm8pe1xuICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UubG9naW4obG9naW5JbmZvKVxuICAgICAgICAudGhlbiggKCkgPT4gQ29va2llRmFjdG9yeS5zZXRDb29raWUobG9naW5JbmZvKSlcbiAgICAgICAgLnRoZW4oICgpID0+IFVzZXJGYWN0b3J5LmluaXRVc2VyRmFjdG9yeSgpIClcbiAgICAgICAgLnRoZW4oICgpID0+IHsgJHN0YXRlLmdvKCd1c2VyJykgfSlcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBzZW5kTG9naW46IHNlbmRMb2dpbixcbiAgICB9XG5cbn0pO1xuIiwiYXBwLmNvbnRyb2xsZXIoICdOQkFfQ3RybCcsIGZ1bmN0aW9uKCAkc2NvcGUsIE5CQV9MZWFndWVfRmFjdG9yeSl7XG5cblx0JHNjb3BlLnRhYiA9IHsgbmJhU3RhbmRpbmdzOiAnYWN0aXZlJyB9XG5cblx0JHNjb3BlLm5iYVRlYW1zSW5mbyA9IE5CQV9MZWFndWVfRmFjdG9yeS5nZXROQkFUZWFtSW5mbztcblxuXG59KTtcbiIsImFwcC5mYWN0b3J5KCdOQkFfTGVhZ3VlX0ZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCwgJGxvZyl7XG5cblx0bGV0IG5iYVRlYW1JbmZvID0gW107XG5cblx0Ly8gRm9yIG5vdyBqdXN0IG1ha2luZyBhbiBJSUZFIHdpbGwgbWFrZSBtb3JlXG5cdC8vIHBlcmZvcm1hbnQgbGF0ZXJcblx0KGZ1bmN0aW9uIGdldE5CQVRlYW1JbmZvKCl7XG5cdFx0cmV0dXJuICRodHRwLmdldCgnYXBpL25iYS10ZWFtcy93aW5zLzIwMTYnKVxuXHQgICAgLnRoZW4oIHJlc3BvbnNlID0+IHtcblx0XHRcdG5iYVRlYW1JbmZvID0gcmVzcG9uc2UuZGF0YTtcblx0ICAgIH0pXG5cdCAgICAuY2F0Y2goJGxvZylcblx0fSkoKVxuXG5cdHJldHVybiB7XG5cdFx0Z2V0TkJBVGVhbUluZm86ICgpID0+IG5iYVRlYW1JbmZvLFxuXHR9XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyggJHN0YXRlUHJvdmlkZXIgPT4ge1xuXHQkc3RhdGVQcm92aWRlci5zdGF0ZSggJ25iYUxlYWd1ZScsIHtcblx0XHR1cmw6ICcvbmJhLXN0YW5kaW5ncycsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy92aWV3cy9uYmEtbGVhZ3VlL25iYS5sZWFndWUuaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ05CQV9DdHJsJ1xuXHR9KVxufSlcbiIsImFwcC5jb250cm9sbGVyKCAnVGVhbUN0cmwnLCAoJHNjb3BlLCBUZWFtRmFjdG9yeSkgPT4ge1xuXHQkc2NvcGUudGFiID0geyB0ZWFtOiAnYWN0aXZlJyB9XG5cblx0IFRlYW1GYWN0b3J5LmdldFRlYW1zKClcblx0IC50aGVuKCB0ZWFtcyA9PiB7XG5cdFx0JHNjb3BlLm5iYVRlYW1zID0gdGVhbXNcblx0XHQkc2NvcGUudGVhbVRvdGFsV2lucyA9IFRlYW1GYWN0b3J5LmdldFRlYW1XaW5Ub3RhbCgpO1xuXHQgfSlcblxufSk7XG4iLCJhcHAuZmFjdG9yeSggJ1RlYW1GYWN0b3J5JywgKCAkaHR0cCwgJHN0YXRlUGFyYW1zLCAkbG9nKSA9PiB7XG5cblx0bGV0IHRlYW1Ub3RhbFdpbnMgPSAwO1xuXG5cdGZ1bmN0aW9uIGdldFRlYW1zKCl7XG5cblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCdhcGkvdGVhbS8nICsgJHN0YXRlUGFyYW1zLmlkICsgJy9uYmFfdGVhbXMnKVxuXHRcdC50aGVuKCByZXNwb25zZSA9PiB7XG5cdFx0XHR0ZWFtVG90YWxXaW5zID0gMDtcblx0XHRcdHJlc3BvbnNlLmRhdGEuZm9yRWFjaCggdGVhbSA9PiB7IHRlYW1Ub3RhbFdpbnMgKz0gdGVhbS53aW5zIH0pXG5cdFx0XHRyZXR1cm4gcmVzcG9uc2UuZGF0YTtcblx0XHR9KVxuXHRcdC5jYXRjaCgkbG9nKVxuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRnZXRUZWFtczogZ2V0VGVhbXMsXG5cdFx0Z2V0VGVhbVdpblRvdGFsOiAoKSA9PiB0ZWFtVG90YWxXaW5zLFxuXHR9XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyggJHN0YXRlUHJvdmlkZXIgPT4ge1xuXG5cdCRzdGF0ZVByb3ZpZGVyLnN0YXRlKCAndGVhbScsIHtcblx0XHR1cmw6ICcvdGVhbS86aWQnLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvdmlld3MvdGVhbS90ZWFtLmh0bWwnLFxuXHRcdGNvbnRyb2xsZXI6ICdUZWFtQ3RybCcsXG5cdH0pO1xuXG59KTtcbiIsImFwcC5jb250cm9sbGVyKCdVc2VyQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgVXNlckZhY3Rvcnkpe1xuXG5cdCRzY29wZS50YWIgPSB7IGhvbWU6ICdhY3RpdmUnIH07XG5cblx0JHNjb3BlLnVzZXJUZWFtcyA9IFVzZXJGYWN0b3J5LmdldFVzZXJUZWFtcygpO1xuXG5cdCRzY29wZS5zZWxlY3RlZFRlYW1JRCA9IFVzZXJGYWN0b3J5LmdldFNlbGVjdGVkVGVhbUlEKCk7XG5cblx0JHNjb3BlLnNlbGVjdGVkTGVhZ3VlSUQgPSBVc2VyRmFjdG9yeS5nZXRTZWxlY3RlZExlYWd1ZUlEKCk7XG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoICdVc2VyRmFjdG9yeScsIGZ1bmN0aW9uKCRodHRwLCBTZXNzaW9uLCAkbG9nKXtcblxuXHRsZXQgdXNlclRlYW1zID0gW107XG5cdGxldCB1c2VyU2VsZWN0ZWRUZWFtSUQgPSB1bmRlZmluZWQ7XG5cdGxldCB1c2VyU2VsZWN0ZWRMZWFndWVJRCA9IHVuZGVmaW5lZDtcblxuXHRmdW5jdGlvbiBpbml0VXNlckZhY3RvcnkoKXtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCdhcGkvdGVhbS91c2VyLycgKyBTZXNzaW9uLnVzZXIuaWQgKVxuXHRcdC50aGVuKCByZXNwb25zZSA9PiB7XG5cdFx0XHR1c2VyVGVhbXMgPSByZXNwb25zZS5kYXRhO1xuXHRcdFx0Ly8gSW50aWFsaXplIHRoZXNlIHRvIGZpcnN0IHRlYW0gYW5kIGxlYWd1ZSB0byBzdGFydFxuXHRcdFx0dXNlclNlbGVjdGVkVGVhbUlEID0gdXNlclRlYW1zWzBdLmlkO1xuXHRcdFx0dXNlclNlbGVjdGVkTGVhZ3VlSUQgPSB1c2VyVGVhbXNbMF0ubGVhZ3VlLmlkO1xuXHRcdH0pXG5cdFx0LmNhdGNoKCRsb2cpXG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGluaXRVc2VyRmFjdG9yeTogaW5pdFVzZXJGYWN0b3J5LFxuXHRcdGdldFVzZXJUZWFtczogKCkgPT4gdXNlclRlYW1zLFxuXHRcdGdldFNlbGVjdGVkVGVhbUlEOiAoKSA9PiB1c2VyU2VsZWN0ZWRUZWFtSUQsXG5cdFx0Z2V0U2VsZWN0ZWRMZWFndWVJRDogKCkgPT4gdXNlclNlbGVjdGVkTGVhZ3VlSUQsXG5cdH1cblxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyKXtcblxuXHQkc3RhdGVQcm92aWRlci5zdGF0ZSgndXNlcicsIHtcblx0XHR1cmw6ICcvdXNlcicsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy92aWV3cy91c2VyL3VzZXIuaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ1VzZXJDdHJsJ1xuXHR9KVxuXG59KTtcbiJdfQ==
