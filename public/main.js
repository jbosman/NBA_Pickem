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

app.directive('tabmenu', function () {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/tabMenu/tabMenu.html'
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

app.controller('LoginCtrl', function ($scope, AuthService, $state, UserFactory) {

    $scope.login = {};
    $scope.error = null;
    $scope.isLoginState = function () {
        return true;
    };

    $scope.sendLogin = function (loginInfo) {

        $scope.error = null;

        AuthService.login(loginInfo).then(function () {
            return UserFactory.initUserFactory();
        }).then(function () {
            $state.go('user');
        }).catch(function () {
            $scope.error = 'Invalid login credentials.';
        });
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsInByZS1idWlsdC9wcmUtYnVpbHQuanMiLCJkaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuanMiLCJkaXJlY3RpdmVzL3RhYk1lbnUvdGFiTWVudS5qcyIsInZpZXdzL2xlYWd1ZS9sZWFndWUuY29udHJvbGxlci5qcyIsInZpZXdzL2xlYWd1ZS9sZWFndWUuZmFjdG9yeS5qcyIsInZpZXdzL2xlYWd1ZS9sZWFndWUuc3RhdGUuanMiLCJ2aWV3cy9sb2dpbi9sb2dpbi5zdGF0ZS5qcyIsInZpZXdzL25iYS1sZWFndWUvbmJhLmxlYWd1ZS5jb250cm9sbGVyLmpzIiwidmlld3MvbmJhLWxlYWd1ZS9uYmEubGVhZ3VlLmZhY3RvcnkuanMiLCJ2aWV3cy9uYmEtbGVhZ3VlL25iYS5sZWFndWUuc3RhdGUuanMiLCJ2aWV3cy90ZWFtL3RlYW0uY29udHJvbGxlci5qcyIsInZpZXdzL3RlYW0vdGVhbS5mYWN0b3J5LmpzIiwidmlld3MvdGVhbS90ZWFtLnN0YXRlLmpzIiwidmlld3MvdXNlci91c2VyLmNvbnRyb2xsZXIuanMiLCJ2aWV3cy91c2VyL3VzZXIuZmFjdG9yeS5qcyIsInZpZXdzL3VzZXIvdXNlci5zdGF0ZS5qcyJdLCJuYW1lcyI6WyJ3aW5kb3ciLCJhcHAiLCJhbmd1bGFyIiwibW9kdWxlIiwiY29uZmlnIiwiJHVybFJvdXRlclByb3ZpZGVyIiwiJGxvY2F0aW9uUHJvdmlkZXIiLCJodG1sNU1vZGUiLCJvdGhlcndpc2UiLCJ3aGVuIiwibG9jYXRpb24iLCJyZWxvYWQiLCJydW4iLCIkcm9vdFNjb3BlIiwiJG9uIiwiZXZlbnQiLCJ0b1N0YXRlIiwidG9QYXJhbXMiLCJmcm9tU3RhdGUiLCJmcm9tUGFyYW1zIiwidGhyb3duRXJyb3IiLCJjb25zb2xlIiwiaW5mbyIsIm5hbWUiLCJlcnJvciIsIkF1dGhTZXJ2aWNlIiwiJHN0YXRlIiwiZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCIsInN0YXRlIiwiZGF0YSIsImF1dGhlbnRpY2F0ZSIsImlzQXV0aGVudGljYXRlZCIsInByZXZlbnREZWZhdWx0IiwiZ2V0TG9nZ2VkSW5Vc2VyIiwidGhlbiIsInVzZXIiLCJnbyIsIkVycm9yIiwiY29uc3RhbnQiLCJsb2dpblN1Y2Nlc3MiLCJsb2dpbkZhaWxlZCIsImxvZ291dFN1Y2Nlc3MiLCJzZXNzaW9uVGltZW91dCIsIm5vdEF1dGhlbnRpY2F0ZWQiLCJub3RBdXRob3JpemVkIiwiZmFjdG9yeSIsIiRxIiwiQVVUSF9FVkVOVFMiLCJzdGF0dXNEaWN0IiwicmVzcG9uc2VFcnJvciIsInJlc3BvbnNlIiwiJGJyb2FkY2FzdCIsInN0YXR1cyIsInJlamVjdCIsIiRodHRwUHJvdmlkZXIiLCJpbnRlcmNlcHRvcnMiLCJwdXNoIiwiJGluamVjdG9yIiwiZ2V0Iiwic2VydmljZSIsIiRodHRwIiwiU2Vzc2lvbiIsIm9uU3VjY2Vzc2Z1bExvZ2luIiwiY3JlYXRlIiwiZnJvbVNlcnZlciIsImNhdGNoIiwibG9naW4iLCJjcmVkZW50aWFscyIsInBvc3QiLCJtZXNzYWdlIiwibG9nb3V0IiwiZGVzdHJveSIsInNlbGYiLCJkaXJlY3RpdmUiLCJyZXN0cmljdCIsInRlbXBsYXRlVXJsIiwiY29udHJvbGxlciIsIiRzY29wZSIsIkxlYWd1ZUZhY3RvcnkiLCJ0YWIiLCJsZWFndWUiLCJnZXRMZWFndWVUZWFtcyIsInRlYW1zIiwibGVhZ3VlVGVhbXMiLCIkc3RhdGVQYXJhbXMiLCJpZCIsImxvZyIsIiRzdGF0ZVByb3ZpZGVyIiwidXJsIiwiVXNlckZhY3RvcnkiLCJpc0xvZ2luU3RhdGUiLCJzZW5kTG9naW4iLCJsb2dpbkluZm8iLCJpbml0VXNlckZhY3RvcnkiLCJOQkFfTGVhZ3VlX0ZhY3RvcnkiLCJuYmFTdGFuZGluZ3MiLCJuYmFUZWFtc0luZm8iLCJnZXROQkFUZWFtSW5mbyIsIiRsb2ciLCJuYmFUZWFtSW5mbyIsIlRlYW1GYWN0b3J5IiwidGVhbSIsImdldFRlYW1zIiwibmJhVGVhbXMiLCJ0ZWFtVG90YWxXaW5zIiwiZ2V0VGVhbVdpblRvdGFsIiwiZm9yRWFjaCIsIndpbnMiLCJob21lIiwidXNlclRlYW1zIiwiZ2V0VXNlclRlYW1zIiwic2VsZWN0ZWRUZWFtSUQiLCJnZXRTZWxlY3RlZFRlYW1JRCIsInNlbGVjdGVkTGVhZ3VlSUQiLCJnZXRTZWxlY3RlZExlYWd1ZUlEIiwidXNlclNlbGVjdGVkVGVhbUlEIiwidW5kZWZpbmVkIiwidXNlclNlbGVjdGVkTGVhZ3VlSUQiXSwibWFwcGluZ3MiOiJBQUFBOztBQUNBQSxPQUFBQyxHQUFBLEdBQUFDLFFBQUFDLE1BQUEsQ0FBQSxnQkFBQSxFQUFBLENBQUEsVUFBQSxFQUFBLFdBQUEsQ0FBQSxDQUFBOztBQUVBRixJQUFBRyxNQUFBLENBQUEsVUFBQUMsa0JBQUEsRUFBQUMsaUJBQUEsRUFBQTtBQUNBO0FBQ0FBLHNCQUFBQyxTQUFBLENBQUEsSUFBQTtBQUNBO0FBQ0FGLHVCQUFBRyxTQUFBLENBQUEsUUFBQTtBQUNBO0FBQ0FILHVCQUFBSSxJQUFBLENBQUEsaUJBQUEsRUFBQSxZQUFBO0FBQ0FULGVBQUFVLFFBQUEsQ0FBQUMsTUFBQTtBQUNBLEtBRkE7QUFHQSxDQVRBOztBQVdBO0FBQ0FWLElBQUFXLEdBQUEsQ0FBQSxVQUFBQyxVQUFBLEVBQUE7QUFDQUEsZUFBQUMsR0FBQSxDQUFBLG1CQUFBLEVBQUEsVUFBQUMsS0FBQSxFQUFBQyxPQUFBLEVBQUFDLFFBQUEsRUFBQUMsU0FBQSxFQUFBQyxVQUFBLEVBQUFDLFdBQUEsRUFBQTtBQUNBQyxnQkFBQUMsSUFBQSxnRkFBQU4sUUFBQU8sSUFBQTtBQUNBRixnQkFBQUcsS0FBQSxDQUFBSixXQUFBO0FBQ0EsS0FIQTtBQUlBLENBTEE7O0FBT0E7QUFDQW5CLElBQUFXLEdBQUEsQ0FBQSxVQUFBQyxVQUFBLEVBQUFZLFdBQUEsRUFBQUMsTUFBQSxFQUFBOztBQUVBO0FBQ0EsUUFBQUMsK0JBQUEsU0FBQUEsNEJBQUEsQ0FBQUMsS0FBQSxFQUFBO0FBQ0EsZUFBQUEsTUFBQUMsSUFBQSxJQUFBRCxNQUFBQyxJQUFBLENBQUFDLFlBQUE7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QUssRUFBQTtBQUNBLFNBTkEsRUFPQXBCLEtBUEEsQ0FPQWlDLElBUEEsQ0FBQTtBQVFBOztBQUVBLFdBQUE7QUFDQUwseUJBQUFBLGVBREE7QUFFQWlCLHNCQUFBO0FBQUEsbUJBQUFELFNBQUE7QUFBQSxTQUZBO0FBR0FHLDJCQUFBO0FBQUEsbUJBQUFHLGtCQUFBO0FBQUEsU0FIQTtBQUlBRCw2QkFBQTtBQUFBLG1CQUFBRyxvQkFBQTtBQUFBO0FBSkEsS0FBQTtBQU9BLENBeEJBOztBQ0FBcEgsSUFBQUcsTUFBQSxDQUFBLFVBQUFtRixjQUFBLEVBQUE7O0FBRUFBLG1CQUFBM0QsS0FBQSxDQUFBLE1BQUEsRUFBQTtBQUNBNEQsYUFBQSxPQURBO0FBRUFiLHFCQUFBLHlCQUZBO0FBR0FDLG9CQUFBO0FBSEEsS0FBQTtBQU1BLENBUkEiLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcbndpbmRvdy5hcHAgPSBhbmd1bGFyLm1vZHVsZSgnTkJBX1BpY2tlbV9BcHAnLCBbJ3ByZUJ1aWx0JywgJ3VpLnJvdXRlciddKTtcblxuYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHVybFJvdXRlclByb3ZpZGVyLCAkbG9jYXRpb25Qcm92aWRlcikge1xuICAgIC8vIFRoaXMgdHVybnMgb2ZmIGhhc2hiYW5nIHVybHMgKC8jYWJvdXQpIGFuZCBjaGFuZ2VzIGl0IHRvIHNvbWV0aGluZyBub3JtYWwgKC9hYm91dClcbiAgICAkbG9jYXRpb25Qcm92aWRlci5odG1sNU1vZGUodHJ1ZSk7XG4gICAgLy8gSWYgd2UgZ28gdG8gYSBVUkwgdGhhdCB1aS1yb3V0ZXIgZG9lc24ndCBoYXZlIHJlZ2lzdGVyZWQsIGdvIHRvIHRoZSBcIi9cIiB1cmwuXG4gICAgJHVybFJvdXRlclByb3ZpZGVyLm90aGVyd2lzZSgnL2xvZ2luJyk7XG4gICAgLy8gVHJpZ2dlciBwYWdlIHJlZnJlc2ggd2hlbiBhY2Nlc3NpbmcgYW4gT0F1dGggcm91dGVcbiAgICAkdXJsUm91dGVyUHJvdmlkZXIud2hlbignL2F1dGgvOnByb3ZpZGVyJywgZnVuY3Rpb24gKCkge1xuICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgfSk7XG59KTtcblxuLy8gVGhpcyBhcHAucnVuIGlzIGZvciBsaXN0ZW5pbmcgdG8gZXJyb3JzIGJyb2FkY2FzdGVkIGJ5IHVpLXJvdXRlciwgdXN1YWxseSBvcmlnaW5hdGluZyBmcm9tIHJlc29sdmVzXG5hcHAucnVuKGZ1bmN0aW9uICgkcm9vdFNjb3BlKSB7XG4gICAgJHJvb3RTY29wZS4kb24oJyRzdGF0ZUNoYW5nZUVycm9yJywgZnVuY3Rpb24gKGV2ZW50LCB0b1N0YXRlLCB0b1BhcmFtcywgZnJvbVN0YXRlLCBmcm9tUGFyYW1zLCB0aHJvd25FcnJvcikge1xuICAgICAgICBjb25zb2xlLmluZm8oYFRoZSBmb2xsb3dpbmcgZXJyb3Igd2FzIHRocm93biBieSB1aS1yb3V0ZXIgd2hpbGUgdHJhbnNpdGlvbmluZyB0byBzdGF0ZSBcIiR7dG9TdGF0ZS5uYW1lfVwiLiBUaGUgb3JpZ2luIG9mIHRoaXMgZXJyb3IgaXMgcHJvYmFibHkgYSByZXNvbHZlIGZ1bmN0aW9uOmApO1xuICAgICAgICBjb25zb2xlLmVycm9yKHRocm93bkVycm9yKTtcbiAgICB9KTtcbn0pO1xuXG4vLyBUaGlzIGFwcC5ydW4gaXMgZm9yIGNvbnRyb2xsaW5nIGFjY2VzcyB0byBzcGVjaWZpYyBzdGF0ZXMuXG5hcHAucnVuKGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBdXRoU2VydmljZSwgJHN0YXRlKSB7XG5cbiAgICAvLyBUaGUgZ2l2ZW4gc3RhdGUgcmVxdWlyZXMgYW4gYXV0aGVudGljYXRlZCB1c2VyLlxuICAgIHZhciBkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgIHJldHVybiBzdGF0ZS5kYXRhICYmIHN0YXRlLmRhdGEuYXV0aGVudGljYXRlO1xuICAgIH07XG5cbiAgICAvLyAkc3RhdGVDaGFuZ2VTdGFydCBpcyBhbiBldmVudCBmaXJlZFxuICAgIC8vIHdoZW5ldmVyIHRoZSBwcm9jZXNzIG9mIGNoYW5naW5nIGEgc3RhdGUgYmVnaW5zLlxuICAgICRyb290U2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VTdGFydCcsIGZ1bmN0aW9uIChldmVudCwgdG9TdGF0ZSwgdG9QYXJhbXMpIHtcblxuICAgICAgICBpZiAoIWRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGgodG9TdGF0ZSkpIHtcbiAgICAgICAgICAgIC8vIFRoZSBkZXN0aW5hdGlvbiBzdGF0ZSBkb2VzIG5vdCByZXF1aXJlIGF1dGhlbnRpY2F0aW9uXG4gICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IHdpdGggcmV0dXJuLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpKSB7XG4gICAgICAgICAgICAvLyBUaGUgdXNlciBpcyBhdXRoZW50aWNhdGVkLlxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbmNlbCBuYXZpZ2F0aW5nIHRvIG5ldyBzdGF0ZS5cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICAvLyBJZiBhIHVzZXIgaXMgcmV0cmlldmVkLCB0aGVuIHJlbmF2aWdhdGUgdG8gdGhlIGRlc3RpbmF0aW9uXG4gICAgICAgICAgICAvLyAodGhlIHNlY29uZCB0aW1lLCBBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSB3aWxsIHdvcmspXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UsIGlmIG5vIHVzZXIgaXMgbG9nZ2VkIGluLCBnbyB0byBcImxvZ2luXCIgc3RhdGUuXG4gICAgICAgICAgICBpZiAodXNlcikge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbyh0b1N0YXRlLm5hbWUsIHRvUGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdsb2dpbicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgIH0pO1xuXG59KTtcbiIsIihmdW5jdGlvbiAoKSB7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvLyBIb3BlIHlvdSBkaWRuJ3QgZm9yZ2V0IEFuZ3VsYXIhIER1aC1kb3kuXG4gICAgaWYgKCF3aW5kb3cuYW5ndWxhcikgdGhyb3cgbmV3IEVycm9yKCdJIGNhblxcJ3QgZmluZCBBbmd1bGFyIScpO1xuXG4gICAgdmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdwcmVCdWlsdCcsIFtdKTtcblxuICAgIC8vIGFwcC5mYWN0b3J5KCdTb2NrZXQnLCBmdW5jdGlvbiAoKSB7XG4gICAgLy8gICAgIGlmICghd2luZG93LmlvKSB0aHJvdyBuZXcgRXJyb3IoJ3NvY2tldC5pbyBub3QgZm91bmQhJyk7XG4gICAgLy8gICAgIHJldHVybiB3aW5kb3cuaW8od2luZG93LmxvY2F0aW9uLm9yaWdpbik7XG4gICAgLy8gfSk7XG5cbiAgICAvLyBBVVRIX0VWRU5UUyBpcyB1c2VkIHRocm91Z2hvdXQgb3VyIGFwcCB0b1xuICAgIC8vIGJyb2FkY2FzdCBhbmQgbGlzdGVuIGZyb20gYW5kIHRvIHRoZSAkcm9vdFNjb3BlXG4gICAgLy8gZm9yIGltcG9ydGFudCBldmVudHMgYWJvdXQgYXV0aGVudGljYXRpb24gZmxvdy5cbiAgICBhcHAuY29uc3RhbnQoJ0FVVEhfRVZFTlRTJywge1xuICAgICAgICBsb2dpblN1Y2Nlc3M6ICdhdXRoLWxvZ2luLXN1Y2Nlc3MnLFxuICAgICAgICBsb2dpbkZhaWxlZDogJ2F1dGgtbG9naW4tZmFpbGVkJyxcbiAgICAgICAgbG9nb3V0U3VjY2VzczogJ2F1dGgtbG9nb3V0LXN1Y2Nlc3MnLFxuICAgICAgICBzZXNzaW9uVGltZW91dDogJ2F1dGgtc2Vzc2lvbi10aW1lb3V0JyxcbiAgICAgICAgbm90QXV0aGVudGljYXRlZDogJ2F1dGgtbm90LWF1dGhlbnRpY2F0ZWQnLFxuICAgICAgICBub3RBdXRob3JpemVkOiAnYXV0aC1ub3QtYXV0aG9yaXplZCdcbiAgICB9KTtcblxuICAgIGFwcC5mYWN0b3J5KCdBdXRoSW50ZXJjZXB0b3InLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgJHEsIEFVVEhfRVZFTlRTKSB7XG4gICAgICAgIHZhciBzdGF0dXNEaWN0ID0ge1xuICAgICAgICAgICAgNDAxOiBBVVRIX0VWRU5UUy5ub3RBdXRoZW50aWNhdGVkLFxuICAgICAgICAgICAgNDAzOiBBVVRIX0VWRU5UUy5ub3RBdXRob3JpemVkLFxuICAgICAgICAgICAgNDE5OiBBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCxcbiAgICAgICAgICAgIDQ0MDogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXRcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJlc3BvbnNlRXJyb3I6IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChzdGF0dXNEaWN0W3Jlc3BvbnNlLnN0YXR1c10sIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJHEucmVqZWN0KHJlc3BvbnNlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH0pO1xuXG4gICAgYXBwLmNvbmZpZyhmdW5jdGlvbiAoJGh0dHBQcm92aWRlcikge1xuICAgICAgICAkaHR0cFByb3ZpZGVyLmludGVyY2VwdG9ycy5wdXNoKFtcbiAgICAgICAgICAgICckaW5qZWN0b3InLFxuICAgICAgICAgICAgZnVuY3Rpb24gKCRpbmplY3Rvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiAkaW5qZWN0b3IuZ2V0KCdBdXRoSW50ZXJjZXB0b3InKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXSk7XG4gICAgfSk7XG5cbiAgICBhcHAuc2VydmljZSgnQXV0aFNlcnZpY2UnLCBmdW5jdGlvbiAoJGh0dHAsIFNlc3Npb24sICRyb290U2NvcGUsIEFVVEhfRVZFTlRTLCAkcSkge1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uU3VjY2Vzc2Z1bExvZ2luKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgdXNlciA9IHJlc3BvbnNlLmRhdGEudXNlcjtcbiAgICAgICAgICAgIFNlc3Npb24uY3JlYXRlKHVzZXIpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ2luU3VjY2Vzcyk7XG4gICAgICAgICAgICByZXR1cm4gdXNlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVzZXMgdGhlIHNlc3Npb24gZmFjdG9yeSB0byBzZWUgaWYgYW5cbiAgICAgICAgLy8gYXV0aGVudGljYXRlZCB1c2VyIGlzIGN1cnJlbnRseSByZWdpc3RlcmVkLlxuICAgICAgICB0aGlzLmlzQXV0aGVudGljYXRlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAhIVNlc3Npb24udXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmdldExvZ2dlZEluVXNlciA9IGZ1bmN0aW9uIChmcm9tU2VydmVyKSB7XG5cbiAgICAgICAgICAgIC8vIElmIGFuIGF1dGhlbnRpY2F0ZWQgc2Vzc2lvbiBleGlzdHMsIHdlXG4gICAgICAgICAgICAvLyByZXR1cm4gdGhlIHVzZXIgYXR0YWNoZWQgdG8gdGhhdCBzZXNzaW9uXG4gICAgICAgICAgICAvLyB3aXRoIGEgcHJvbWlzZS4gVGhpcyBlbnN1cmVzIHRoYXQgd2UgY2FuXG4gICAgICAgICAgICAvLyBhbHdheXMgaW50ZXJmYWNlIHdpdGggdGhpcyBtZXRob2QgYXN5bmNocm9ub3VzbHkuXG5cbiAgICAgICAgICAgIC8vIE9wdGlvbmFsbHksIGlmIHRydWUgaXMgZ2l2ZW4gYXMgdGhlIGZyb21TZXJ2ZXIgcGFyYW1ldGVyLFxuICAgICAgICAgICAgLy8gdGhlbiB0aGlzIGNhY2hlZCB2YWx1ZSB3aWxsIG5vdCBiZSB1c2VkLlxuXG4gICAgICAgICAgICBpZiAodGhpcy5pc0F1dGhlbnRpY2F0ZWQoKSAmJiBmcm9tU2VydmVyICE9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLndoZW4oU2Vzc2lvbi51c2VyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTWFrZSByZXF1ZXN0IEdFVCAvc2Vzc2lvbi5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSB1c2VyLCBjYWxsIG9uU3VjY2Vzc2Z1bExvZ2luIHdpdGggdGhlIHJlc3BvbnNlLlxuICAgICAgICAgICAgLy8gSWYgaXQgcmV0dXJucyBhIDQwMSByZXNwb25zZSwgd2UgY2F0Y2ggaXQgYW5kIGluc3RlYWQgcmVzb2x2ZSB0byBudWxsLlxuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL3Nlc3Npb24nKS50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMubG9naW4gPSBmdW5jdGlvbiAoY3JlZGVudGlhbHMpIHtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5wb3N0KCcvbG9naW4nLCBjcmVkZW50aWFscylcbiAgICAgICAgICAgICAgICAudGhlbihvblN1Y2Nlc3NmdWxMb2dpbilcbiAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJHEucmVqZWN0KHsgbWVzc2FnZTogJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJyB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxvZ291dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9sb2dvdXQnKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBTZXNzaW9uLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoQVVUSF9FVkVOVFMubG9nb3V0U3VjY2Vzcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ1Nlc3Npb24nLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy51c2VyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmNyZWF0ZSA9IGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICB0aGlzLnVzZXIgPSB1c2VyO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMudXNlciA9IG51bGw7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxufSgpKTtcbiIsImFwcC5kaXJlY3RpdmUoJ25hdmJhcicsIGZ1bmN0aW9uKCl7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdFJyxcblx0XHR0ZW1wbGF0ZVVybDogJ2pzL2RpcmVjdGl2ZXMvbmF2YmFyL25hdmJhci5odG1sJyxcblx0fVxufSk7XG4iLCJhcHAuZGlyZWN0aXZlKCd0YWJtZW51JywgZnVuY3Rpb24oKXtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0UnLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvZGlyZWN0aXZlcy90YWJNZW51L3RhYk1lbnUuaHRtbCcsXG5cdH1cbn0pO1xuIiwiYXBwLmNvbnRyb2xsZXIoICdMZWFndWVDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCAkaHR0cCwgTGVhZ3VlRmFjdG9yeSl7XG5cblx0JHNjb3BlLnRhYiA9IHsgbGVhZ3VlOiAnYWN0aXZlJyB9XG5cblx0TGVhZ3VlRmFjdG9yeS5nZXRMZWFndWVUZWFtcygpXG5cdC50aGVuKGxlYWd1ZVRlYW1zID0+IHsgJHNjb3BlLnRlYW1zID0gbGVhZ3VlVGVhbXMgfSlcbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ0xlYWd1ZUZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCwgJHN0YXRlUGFyYW1zKXtcblxuXHRmdW5jdGlvbiBnZXRMZWFndWVUZWFtcygpe1xuXHRcdHJldHVybiAkaHR0cC5nZXQoJy9hcGkvbGVhZ3VlLycgKyAkc3RhdGVQYXJhbXMuaWQgKyAnL3RlYW1zJyApXG5cdFx0LnRoZW4oIHJlc3BvbnNlID0+IHtcblx0XHRcdGNvbnNvbGUubG9nKHJlc3BvbnNlLmRhdGEpXG5cdFx0XHRyZXR1cm4gcmVzcG9uc2UuZGF0YTtcblx0XHR9KVxuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRnZXRMZWFndWVUZWFtczogZ2V0TGVhZ3VlVGVhbXMsXG5cblx0fVxuXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpe1xuXHQkc3RhdGVQcm92aWRlci5zdGF0ZSggJ2xlYWd1ZScsIHtcblx0XHR1cmw6ICcvbGVhZ3VlLzppZCcsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy92aWV3cy9sZWFndWUvbGVhZ3VlLmh0bWwnLFxuXHRcdGNvbnRyb2xsZXI6ICdMZWFndWVDdHJsJ1xuXHR9KVxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyKXtcblxuXHQkc3RhdGVQcm92aWRlci5zdGF0ZSgnbG9naW4nLCB7XG5cdFx0dXJsOiAnL2xvZ2luJyxcblx0XHR0ZW1wbGF0ZVVybDogJ2pzL3ZpZXdzL2xvZ2luL2xvZ2luLmh0bWwnLFxuXHRcdGNvbnRyb2xsZXI6ICdMb2dpbkN0cmwnXG5cdH0pXG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ0xvZ2luQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUsIFVzZXJGYWN0b3J5KSB7XG5cbiAgICAkc2NvcGUubG9naW4gPSB7fTtcbiAgICAkc2NvcGUuZXJyb3IgPSBudWxsO1xuICAgICRzY29wZS5pc0xvZ2luU3RhdGUgPSAoKSA9PiB7cmV0dXJuIHRydWU7fVxuXG4gICAgJHNjb3BlLnNlbmRMb2dpbiA9IGZ1bmN0aW9uIChsb2dpbkluZm8pIHtcblxuICAgICAgICAkc2NvcGUuZXJyb3IgPSBudWxsO1xuXG4gICAgICAgIEF1dGhTZXJ2aWNlLmxvZ2luKGxvZ2luSW5mbykudGhlbiggKCkgPT4gVXNlckZhY3RvcnkuaW5pdFVzZXJGYWN0b3J5KCkgKVxuICAgICAgICAudGhlbiggKCkgPT4geyAkc3RhdGUuZ28oJ3VzZXInKSB9KVxuICAgICAgICAuY2F0Y2goICgpID0+IHsgJHNjb3BlLmVycm9yID0gJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJyB9KTtcblxuICAgIH07XG5cbn0pO1xuXG4iLCJhcHAuY29udHJvbGxlciggJ05CQV9DdHJsJywgZnVuY3Rpb24oICRzY29wZSwgTkJBX0xlYWd1ZV9GYWN0b3J5KXtcblxuXHQkc2NvcGUudGFiID0geyBuYmFTdGFuZGluZ3M6ICdhY3RpdmUnIH1cblxuXHQkc2NvcGUubmJhVGVhbXNJbmZvID0gTkJBX0xlYWd1ZV9GYWN0b3J5LmdldE5CQVRlYW1JbmZvO1xuXG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ05CQV9MZWFndWVfRmFjdG9yeScsIGZ1bmN0aW9uKCRodHRwLCAkbG9nKXtcblxuXHRsZXQgbmJhVGVhbUluZm8gPSBbXTtcblxuXHQvLyBGb3Igbm93IGp1c3QgbWFraW5nIGFuIElJRkUgd2lsbCBtYWtlIG1vcmVcblx0Ly8gcGVyZm9ybWFudCBsYXRlclxuXHQoZnVuY3Rpb24gZ2V0TkJBVGVhbUluZm8oKXtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCdhcGkvbmJhLXRlYW1zL3dpbnMvMjAxNicpXG5cdCAgICAudGhlbiggcmVzcG9uc2UgPT4ge1xuXHRcdFx0bmJhVGVhbUluZm8gPSByZXNwb25zZS5kYXRhO1xuXHQgICAgfSlcblx0ICAgIC5jYXRjaCgkbG9nKVxuXHR9KSgpXG5cblx0cmV0dXJuIHtcblx0XHRnZXROQkFUZWFtSW5mbzogKCkgPT4gbmJhVGVhbUluZm8sXG5cdH1cblxufSk7XG4iLCJhcHAuY29uZmlnKCAkc3RhdGVQcm92aWRlciA9PiB7XG5cdCRzdGF0ZVByb3ZpZGVyLnN0YXRlKCAnbmJhTGVhZ3VlJywge1xuXHRcdHVybDogJy9uYmEtc3RhbmRpbmdzJyxcblx0XHR0ZW1wbGF0ZVVybDogJ2pzL3ZpZXdzL25iYS1sZWFndWUvbmJhLmxlYWd1ZS5odG1sJyxcblx0XHRjb250cm9sbGVyOiAnTkJBX0N0cmwnXG5cdH0pXG59KVxuIiwiYXBwLmNvbnRyb2xsZXIoICdUZWFtQ3RybCcsICgkc2NvcGUsIFRlYW1GYWN0b3J5KSA9PiB7XG5cdCRzY29wZS50YWIgPSB7IHRlYW06ICdhY3RpdmUnIH1cblxuXHQgVGVhbUZhY3RvcnkuZ2V0VGVhbXMoKVxuXHQgLnRoZW4oIHRlYW1zID0+IHtcblx0XHQkc2NvcGUubmJhVGVhbXMgPSB0ZWFtc1xuXHRcdCRzY29wZS50ZWFtVG90YWxXaW5zID0gVGVhbUZhY3RvcnkuZ2V0VGVhbVdpblRvdGFsKCk7XG5cdCB9KVxuXG59KTtcbiIsImFwcC5mYWN0b3J5KCAnVGVhbUZhY3RvcnknLCAoICRodHRwLCAkc3RhdGVQYXJhbXMsICRsb2cpID0+IHtcblxuXHRsZXQgdGVhbVRvdGFsV2lucyA9IDA7XG5cblx0ZnVuY3Rpb24gZ2V0VGVhbXMoKXtcblxuXHRcdHJldHVybiAkaHR0cC5nZXQoJ2FwaS90ZWFtLycgKyAkc3RhdGVQYXJhbXMuaWQgKyAnL25iYV90ZWFtcycpXG5cdFx0LnRoZW4oIHJlc3BvbnNlID0+IHtcblx0XHRcdHRlYW1Ub3RhbFdpbnMgPSAwO1xuXHRcdFx0cmVzcG9uc2UuZGF0YS5mb3JFYWNoKCB0ZWFtID0+IHsgdGVhbVRvdGFsV2lucyArPSB0ZWFtLndpbnMgfSlcblx0XHRcdHJldHVybiByZXNwb25zZS5kYXRhO1xuXHRcdH0pXG5cdFx0LmNhdGNoKCRsb2cpXG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGdldFRlYW1zOiBnZXRUZWFtcyxcblx0XHRnZXRUZWFtV2luVG90YWw6ICgpID0+IHRlYW1Ub3RhbFdpbnMsXG5cdH1cblxufSk7XG4iLCJhcHAuY29uZmlnKCAkc3RhdGVQcm92aWRlciA9PiB7XG5cblx0JHN0YXRlUHJvdmlkZXIuc3RhdGUoICd0ZWFtJywge1xuXHRcdHVybDogJy90ZWFtLzppZCcsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy92aWV3cy90ZWFtL3RlYW0uaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ1RlYW1DdHJsJyxcblx0fSk7XG5cbn0pO1xuIiwiYXBwLmNvbnRyb2xsZXIoJ1VzZXJDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBVc2VyRmFjdG9yeSl7XG5cblx0JHNjb3BlLnRhYiA9IHsgaG9tZTogJ2FjdGl2ZScgfTtcblxuXHQkc2NvcGUudXNlclRlYW1zID0gVXNlckZhY3RvcnkuZ2V0VXNlclRlYW1zKCk7XG5cblx0JHNjb3BlLnNlbGVjdGVkVGVhbUlEID0gVXNlckZhY3RvcnkuZ2V0U2VsZWN0ZWRUZWFtSUQoKTtcblxuXHQkc2NvcGUuc2VsZWN0ZWRMZWFndWVJRCA9IFVzZXJGYWN0b3J5LmdldFNlbGVjdGVkTGVhZ3VlSUQoKTtcblxufSk7XG4iLCJhcHAuZmFjdG9yeSggJ1VzZXJGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHAsIFNlc3Npb24sICRsb2cpe1xuXG5cdGxldCB1c2VyVGVhbXMgPSBbXTtcblx0bGV0IHVzZXJTZWxlY3RlZFRlYW1JRCA9IHVuZGVmaW5lZDtcblx0bGV0IHVzZXJTZWxlY3RlZExlYWd1ZUlEID0gdW5kZWZpbmVkO1xuXG5cdGZ1bmN0aW9uIGluaXRVc2VyRmFjdG9yeSgpe1xuXHRcdHJldHVybiAkaHR0cC5nZXQoJ2FwaS90ZWFtL3VzZXIvJyArIFNlc3Npb24udXNlci5pZCApXG5cdFx0LnRoZW4oIHJlc3BvbnNlID0+IHtcblx0XHRcdHVzZXJUZWFtcyA9IHJlc3BvbnNlLmRhdGE7XG5cdFx0XHQvLyBJbnRpYWxpemUgdGhlc2UgdG8gZmlyc3QgdGVhbSBhbmQgbGVhZ3VlIHRvIHN0YXJ0XG5cdFx0XHR1c2VyU2VsZWN0ZWRUZWFtSUQgPSB1c2VyVGVhbXNbMF0uaWQ7XG5cdFx0XHR1c2VyU2VsZWN0ZWRMZWFndWVJRCA9IHVzZXJUZWFtc1swXS5sZWFndWUuaWQ7XG5cdFx0fSlcblx0XHQuY2F0Y2goJGxvZylcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0aW5pdFVzZXJGYWN0b3J5OiBpbml0VXNlckZhY3RvcnksXG5cdFx0Z2V0VXNlclRlYW1zOiAoKSA9PiB1c2VyVGVhbXMsXG5cdFx0Z2V0U2VsZWN0ZWRUZWFtSUQ6ICgpID0+IHVzZXJTZWxlY3RlZFRlYW1JRCxcblx0XHRnZXRTZWxlY3RlZExlYWd1ZUlEOiAoKSA9PiB1c2VyU2VsZWN0ZWRMZWFndWVJRCxcblx0fVxuXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpe1xuXG5cdCRzdGF0ZVByb3ZpZGVyLnN0YXRlKCd1c2VyJywge1xuXHRcdHVybDogJy91c2VyJyxcblx0XHR0ZW1wbGF0ZVVybDogJ2pzL3ZpZXdzL3VzZXIvdXNlci5odG1sJyxcblx0XHRjb250cm9sbGVyOiAnVXNlckN0cmwnXG5cdH0pXG5cbn0pO1xuIl19
