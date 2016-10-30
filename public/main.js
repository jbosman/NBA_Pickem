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
    LeagueFactory.getLeagueTeams().then(function (leagueTeams) {
        $scope.teams = leagueTeams;
    });
});

app.factory('LeagueFactory', function ($http, $stateParams) {

    function getLeagueTeams() {
        return $http.get('/api/league/' + $stateParams.id + '/teams').then(function (response) {
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

app.controller('NBA_Ctrl', function ($scope, NBA_League_Factory, $log) {

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

    TeamFactory.getTeams().then(function (nbaTeams) {
        $scope.nbaTeams = nbaTeams;
    });
});

app.factory('TeamFactory', function ($http, $stateParams, $log) {

    function getTeams() {

        return $http.get('api/team/' + $stateParams.id + '/nba_teams').then(function (response) {
            return response.data;
        }).catch($log);
    }

    return {
        getTeams: getTeams
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

    $scope.userTeams = UserFactory.getUserTeams();
    $scope.tab = { home: 'active' };
});

app.factory('UserFactory', function ($http, Session, $log) {

    var userTeams = [];
    var userSelectedTeam = undefined;

    function initUserFactory() {
        return $http.get('api/team/user/' + Session.user.id).then(function (response) {
            userTeams = response.data;
            userSelectedTeam = userTeams[0];
        }).catch($log);
    }

    return {
        initUserFactory: initUserFactory,
        getUserTeams: function getUserTeams() {
            return userTeams;
        },
        getSelectedTeam: function getSelectedTeam() {
            return userSelectedTeam;
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsInByZS1idWlsdC9wcmUtYnVpbHQuanMiLCJkaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuanMiLCJkaXJlY3RpdmVzL3RhYk1lbnUvdGFiTWVudS5qcyIsInZpZXdzL2xlYWd1ZS9sZWFndWUuY29udHJvbGxlci5qcyIsInZpZXdzL2xlYWd1ZS9sZWFndWUuZmFjdG9yeS5qcyIsInZpZXdzL2xlYWd1ZS9sZWFndWUuc3RhdGUuanMiLCJ2aWV3cy9sb2dpbi9sb2dpbi5zdGF0ZS5qcyIsInZpZXdzL25iYS1sZWFndWUvbmJhLmxlYWd1ZS5jb250cm9sbGVyLmpzIiwidmlld3MvbmJhLWxlYWd1ZS9uYmEubGVhZ3VlLmZhY3RvcnkuanMiLCJ2aWV3cy9uYmEtbGVhZ3VlL25iYS5sZWFndWUuc3RhdGUuanMiLCJ2aWV3cy90ZWFtL3RlYW0uY29udHJvbGxlci5qcyIsInZpZXdzL3RlYW0vdGVhbS5mYWN0b3J5LmpzIiwidmlld3MvdGVhbS90ZWFtLnN0YXRlLmpzIiwidmlld3MvdXNlci91c2VyLmNvbnRyb2xsZXIuanMiLCJ2aWV3cy91c2VyL3VzZXIuZmFjdG9yeS5qcyIsInZpZXdzL3VzZXIvdXNlci5zdGF0ZS5qcyJdLCJuYW1lcyI6WyJ3aW5kb3ciLCJhcHAiLCJhbmd1bGFyIiwibW9kdWxlIiwiY29uZmlnIiwiJHVybFJvdXRlclByb3ZpZGVyIiwiJGxvY2F0aW9uUHJvdmlkZXIiLCJodG1sNU1vZGUiLCJvdGhlcndpc2UiLCJ3aGVuIiwibG9jYXRpb24iLCJyZWxvYWQiLCJydW4iLCIkcm9vdFNjb3BlIiwiJG9uIiwiZXZlbnQiLCJ0b1N0YXRlIiwidG9QYXJhbXMiLCJmcm9tU3RhdGUiLCJmcm9tUGFyYW1zIiwidGhyb3duRXJyb3IiLCJjb25zb2xlIiwiaW5mbyIsIm5hbWUiLCJlcnJvciIsIkF1dGhTZXJ2aWNlIiwiJHN0YXRlIiwiZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCIsInN0YXRlIiwiZGF0YSIsImF1dGhlbnRpY2F0ZSIsImlzQXV0aGVudGljYXRlZCIsInByZXZlbnREZWZhdWx0IiwiZ2V0TG9nZ2VkSW5Vc2VyIiwidGhlbiIsInVzZXIiLCJnbyIsIkVycm9yIiwiY29uc3RhbnQiLCJsb2dpblN1Y2Nlc3MiLCJsb2dpbkZhaWxlZCIsImxvZ291dFN1Y2Nlc3MiLCJzZXNzaW9uVGltZW91dCIsIm5vdEF1dGhlbnRpY2F0ZWQiLCJub3RBdXRob3JpemVkIiwiZmFjdG9yeSIsIiRxIiwiQVVUSF9FVkVOVFMiLCJzdGF0dXNEaWN0IiwicmVzcG9uc2VFcnJvciIsInJlc3BvbnNlIiwiJGJyb2FkY2FzdCIsInN0YXR1cyIsInJlamVjdCIsIiRodHRwUHJvdmlkZXIiLCJpbnRlcmNlcHRvcnMiLCJwdXNoIiwiJGluamVjdG9yIiwiZ2V0Iiwic2VydmljZSIsIiRodHRwIiwiU2Vzc2lvbiIsIm9uU3VjY2Vzc2Z1bExvZ2luIiwiY3JlYXRlIiwiZnJvbVNlcnZlciIsImNhdGNoIiwibG9naW4iLCJjcmVkZW50aWFscyIsInBvc3QiLCJtZXNzYWdlIiwibG9nb3V0IiwiZGVzdHJveSIsInNlbGYiLCJkaXJlY3RpdmUiLCJyZXN0cmljdCIsInRlbXBsYXRlVXJsIiwiY29udHJvbGxlciIsIiRzY29wZSIsIkxlYWd1ZUZhY3RvcnkiLCJnZXRMZWFndWVUZWFtcyIsInRlYW1zIiwibGVhZ3VlVGVhbXMiLCIkc3RhdGVQYXJhbXMiLCJpZCIsIiRzdGF0ZVByb3ZpZGVyIiwidXJsIiwiVXNlckZhY3RvcnkiLCJpc0xvZ2luU3RhdGUiLCJzZW5kTG9naW4iLCJsb2dpbkluZm8iLCJpbml0VXNlckZhY3RvcnkiLCJOQkFfTGVhZ3VlX0ZhY3RvcnkiLCIkbG9nIiwidGFiIiwibmJhU3RhbmRpbmdzIiwibmJhVGVhbXNJbmZvIiwiZ2V0TkJBVGVhbUluZm8iLCJuYmFUZWFtSW5mbyIsIlRlYW1GYWN0b3J5IiwidGVhbSIsImdldFRlYW1zIiwibmJhVGVhbXMiLCJ1c2VyVGVhbXMiLCJnZXRVc2VyVGVhbXMiLCJob21lIiwidXNlclNlbGVj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LEVBQUFXLE1BQUEsUUFBQSxFQUFBO0FBRUEsQ0FMQTs7QUNBQXZHLElBQUE0QyxPQUFBLENBQUEsYUFBQSxFQUFBLFVBQUFlLEtBQUEsRUFBQUMsT0FBQSxFQUFBK0IsSUFBQSxFQUFBOztBQUVBLFFBQUFVLFlBQUEsRUFBQTtBQUNBLFFBQUFHLG1CQUFBQyxTQUFBOztBQUdBLGFBQUFoQixlQUFBLEdBQUE7QUFDQSxlQUFBOUIsTUFBQUYsR0FBQSxDQUFBLG1CQUFBRyxRQUFBMUIsSUFBQSxDQUFBZ0QsRUFBQSxFQUNBakQsSUFEQSxDQUNBLG9CQUFBO0FBQ0FvRSx3QkFBQXBELFNBQUFyQixJQUFBO0FBQ0E0RSwrQkFBQUgsVUFBQSxDQUFBLENBQUE7QUFDQSxTQUpBLEVBS0FyQyxLQUxBLENBS0EyQixJQUxBLENBQUE7QUFNQTs7QUFFQSxXQUFBO0FBQ0FGLHlCQUFBQSxlQURBO0FBRUFhLHNCQUFBO0FBQUEsbUJBQUFELFNBQUE7QUFBQSxTQUZBO0FBR0FLLHlCQUFBO0FBQUEsbUJBQUFGLGdCQUFBO0FBQUE7QUFIQSxLQUFBO0FBTUEsQ0FyQkE7O0FDQUF4RyxJQUFBRyxNQUFBLENBQUEsVUFBQWdGLGNBQUEsRUFBQTs7QUFFQUEsbUJBQUF4RCxLQUFBLENBQUEsTUFBQSxFQUFBO0FBQ0F5RCxhQUFBLE9BREE7QUFFQVYscUJBQUEseUJBRkE7QUFHQUMsb0JBQUE7QUFIQSxLQUFBO0FBTUEsQ0FSQSIsImZpbGUiOiJtYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xud2luZG93LmFwcCA9IGFuZ3VsYXIubW9kdWxlKCdOQkFfUGlja2VtX0FwcCcsIFsncHJlQnVpbHQnLCAndWkucm91dGVyJ10pO1xuXG5hcHAuY29uZmlnKGZ1bmN0aW9uICgkdXJsUm91dGVyUHJvdmlkZXIsICRsb2NhdGlvblByb3ZpZGVyKSB7XG4gICAgLy8gVGhpcyB0dXJucyBvZmYgaGFzaGJhbmcgdXJscyAoLyNhYm91dCkgYW5kIGNoYW5nZXMgaXQgdG8gc29tZXRoaW5nIG5vcm1hbCAoL2Fib3V0KVxuICAgICRsb2NhdGlvblByb3ZpZGVyLmh0bWw1TW9kZSh0cnVlKTtcbiAgICAvLyBJZiB3ZSBnbyB0byBhIFVSTCB0aGF0IHVpLXJvdXRlciBkb2Vzbid0IGhhdmUgcmVnaXN0ZXJlZCwgZ28gdG8gdGhlIFwiL1wiIHVybC5cbiAgICAkdXJsUm91dGVyUHJvdmlkZXIub3RoZXJ3aXNlKCcvbG9naW4nKTtcbiAgICAvLyBUcmlnZ2VyIHBhZ2UgcmVmcmVzaCB3aGVuIGFjY2Vzc2luZyBhbiBPQXV0aCByb3V0ZVxuICAgICR1cmxSb3V0ZXJQcm92aWRlci53aGVuKCcvYXV0aC86cHJvdmlkZXInLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICB9KTtcbn0pO1xuXG4vLyBUaGlzIGFwcC5ydW4gaXMgZm9yIGxpc3RlbmluZyB0byBlcnJvcnMgYnJvYWRjYXN0ZWQgYnkgdWktcm91dGVyLCB1c3VhbGx5IG9yaWdpbmF0aW5nIGZyb20gcmVzb2x2ZXNcbmFwcC5ydW4oZnVuY3Rpb24gKCRyb290U2NvcGUpIHtcbiAgICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlRXJyb3InLCBmdW5jdGlvbiAoZXZlbnQsIHRvU3RhdGUsIHRvUGFyYW1zLCBmcm9tU3RhdGUsIGZyb21QYXJhbXMsIHRocm93bkVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuaW5mbyhgVGhlIGZvbGxvd2luZyBlcnJvciB3YXMgdGhyb3duIGJ5IHVpLXJvdXRlciB3aGlsZSB0cmFuc2l0aW9uaW5nIHRvIHN0YXRlIFwiJHt0b1N0YXRlLm5hbWV9XCIuIFRoZSBvcmlnaW4gb2YgdGhpcyBlcnJvciBpcyBwcm9iYWJseSBhIHJlc29sdmUgZnVuY3Rpb246YCk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IodGhyb3duRXJyb3IpO1xuICAgIH0pO1xufSk7XG5cbi8vIFRoaXMgYXBwLnJ1biBpcyBmb3IgY29udHJvbGxpbmcgYWNjZXNzIHRvIHNwZWNpZmljIHN0YXRlcy5cbmFwcC5ydW4oZnVuY3Rpb24gKCRyb290U2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUpIHtcblxuICAgIC8vIFRoZSBnaXZlbiBzdGF0ZSByZXF1aXJlcyBhbiBhdXRoZW50aWNhdGVkIHVzZXIuXG4gICAgdmFyIGRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGggPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlLmRhdGEgJiYgc3RhdGUuZGF0YS5hdXRoZW50aWNhdGU7XG4gICAgfTtcblxuICAgIC8vICRzdGF0ZUNoYW5nZVN0YXJ0IGlzIGFuIGV2ZW50IGZpcmVkXG4gICAgLy8gd2hlbmV2ZXIgdGhlIHByb2Nlc3Mgb2YgY2hhbmdpbmcgYSBzdGF0ZSBiZWdpbnMuXG4gICAgJHJvb3RTY29wZS4kb24oJyRzdGF0ZUNoYW5nZVN0YXJ0JywgZnVuY3Rpb24gKGV2ZW50LCB0b1N0YXRlLCB0b1BhcmFtcykge1xuXG4gICAgICAgIGlmICghZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCh0b1N0YXRlKSkge1xuICAgICAgICAgICAgLy8gVGhlIGRlc3RpbmF0aW9uIHN0YXRlIGRvZXMgbm90IHJlcXVpcmUgYXV0aGVudGljYXRpb25cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkpIHtcbiAgICAgICAgICAgIC8vIFRoZSB1c2VyIGlzIGF1dGhlbnRpY2F0ZWQuXG4gICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IHdpdGggcmV0dXJuLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FuY2VsIG5hdmlnYXRpbmcgdG8gbmV3IHN0YXRlLlxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgIC8vIElmIGEgdXNlciBpcyByZXRyaWV2ZWQsIHRoZW4gcmVuYXZpZ2F0ZSB0byB0aGUgZGVzdGluYXRpb25cbiAgICAgICAgICAgIC8vICh0aGUgc2Vjb25kIHRpbWUsIEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpIHdpbGwgd29yaylcbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSwgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4sIGdvIHRvIFwibG9naW5cIiBzdGF0ZS5cbiAgICAgICAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKHRvU3RhdGUubmFtZSwgdG9QYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28oJ2xvZ2luJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgfSk7XG5cbn0pO1xuIiwiKGZ1bmN0aW9uICgpIHtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIC8vIEhvcGUgeW91IGRpZG4ndCBmb3JnZXQgQW5ndWxhciEgRHVoLWRveS5cbiAgICBpZiAoIXdpbmRvdy5hbmd1bGFyKSB0aHJvdyBuZXcgRXJyb3IoJ0kgY2FuXFwndCBmaW5kIEFuZ3VsYXIhJyk7XG5cbiAgICB2YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ3ByZUJ1aWx0JywgW10pO1xuXG4gICAgLy8gYXBwLmZhY3RvcnkoJ1NvY2tldCcsIGZ1bmN0aW9uICgpIHtcbiAgICAvLyAgICAgaWYgKCF3aW5kb3cuaW8pIHRocm93IG5ldyBFcnJvcignc29ja2V0LmlvIG5vdCBmb3VuZCEnKTtcbiAgICAvLyAgICAgcmV0dXJuIHdpbmRvdy5pbyh3aW5kb3cubG9jYXRpb24ub3JpZ2luKTtcbiAgICAvLyB9KTtcblxuICAgIC8vIEFVVEhfRVZFTlRTIGlzIHVzZWQgdGhyb3VnaG91dCBvdXIgYXBwIHRvXG4gICAgLy8gYnJvYWRjYXN0IGFuZCBsaXN0ZW4gZnJvbSBhbmQgdG8gdGhlICRyb290U2NvcGVcbiAgICAvLyBmb3IgaW1wb3J0YW50IGV2ZW50cyBhYm91dCBhdXRoZW50aWNhdGlvbiBmbG93LlxuICAgIGFwcC5jb25zdGFudCgnQVVUSF9FVkVOVFMnLCB7XG4gICAgICAgIGxvZ2luU3VjY2VzczogJ2F1dGgtbG9naW4tc3VjY2VzcycsXG4gICAgICAgIGxvZ2luRmFpbGVkOiAnYXV0aC1sb2dpbi1mYWlsZWQnLFxuICAgICAgICBsb2dvdXRTdWNjZXNzOiAnYXV0aC1sb2dvdXQtc3VjY2VzcycsXG4gICAgICAgIHNlc3Npb25UaW1lb3V0OiAnYXV0aC1zZXNzaW9uLXRpbWVvdXQnLFxuICAgICAgICBub3RBdXRoZW50aWNhdGVkOiAnYXV0aC1ub3QtYXV0aGVudGljYXRlZCcsXG4gICAgICAgIG5vdEF1dGhvcml6ZWQ6ICdhdXRoLW5vdC1hdXRob3JpemVkJ1xuICAgIH0pO1xuXG4gICAgYXBwLmZhY3RvcnkoJ0F1dGhJbnRlcmNlcHRvcicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCAkcSwgQVVUSF9FVkVOVFMpIHtcbiAgICAgICAgdmFyIHN0YXR1c0RpY3QgPSB7XG4gICAgICAgICAgICA0MDE6IEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsXG4gICAgICAgICAgICA0MDM6IEFVVEhfRVZFTlRTLm5vdEF1dGhvcml6ZWQsXG4gICAgICAgICAgICA0MTk6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LFxuICAgICAgICAgICAgNDQwOiBBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcmVzcG9uc2VFcnJvcjogZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KHN0YXR1c0RpY3RbcmVzcG9uc2Uuc3RhdHVzXSwgcmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgIHJldHVybiAkcS5yZWplY3QocmVzcG9uc2UpXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfSk7XG5cbiAgICBhcHAuY29uZmlnKGZ1bmN0aW9uICgkaHR0cFByb3ZpZGVyKSB7XG4gICAgICAgICRodHRwUHJvdmlkZXIuaW50ZXJjZXB0b3JzLnB1c2goW1xuICAgICAgICAgICAgJyRpbmplY3RvcicsXG4gICAgICAgICAgICBmdW5jdGlvbiAoJGluamVjdG9yKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRpbmplY3Rvci5nZXQoJ0F1dGhJbnRlcmNlcHRvcicpO1xuICAgICAgICAgICAgfVxuICAgICAgICBdKTtcbiAgICB9KTtcblxuICAgIGFwcC5zZXJ2aWNlKCdBdXRoU2VydmljZScsIGZ1bmN0aW9uICgkaHR0cCwgU2Vzc2lvbiwgJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMsICRxKSB7XG5cbiAgICAgICAgZnVuY3Rpb24gb25TdWNjZXNzZnVsTG9naW4ocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHZhciB1c2VyID0gcmVzcG9uc2UuZGF0YS51c2VyO1xuICAgICAgICAgICAgU2Vzc2lvbi5jcmVhdGUodXNlcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoQVVUSF9FVkVOVFMubG9naW5TdWNjZXNzKTtcbiAgICAgICAgICAgIHJldHVybiB1c2VyO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXNlcyB0aGUgc2Vzc2lvbiBmYWN0b3J5IHRvIHNlZSBpZiBhblxuICAgICAgICAvLyBhdXRoZW50aWNhdGVkIHVzZXIgaXMgY3VycmVudGx5IHJlZ2lzdGVyZWQuXG4gICAgICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICEhU2Vzc2lvbi51c2VyO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZ2V0TG9nZ2VkSW5Vc2VyID0gZnVuY3Rpb24gKGZyb21TZXJ2ZXIpIHtcblxuICAgICAgICAgICAgLy8gSWYgYW4gYXV0aGVudGljYXRlZCBzZXNzaW9uIGV4aXN0cywgd2VcbiAgICAgICAgICAgIC8vIHJldHVybiB0aGUgdXNlciBhdHRhY2hlZCB0byB0aGF0IHNlc3Npb25cbiAgICAgICAgICAgIC8vIHdpdGggYSBwcm9taXNlLiBUaGlzIGVuc3VyZXMgdGhhdCB3ZSBjYW5cbiAgICAgICAgICAgIC8vIGFsd2F5cyBpbnRlcmZhY2Ugd2l0aCB0aGlzIG1ldGhvZCBhc3luY2hyb25vdXNseS5cblxuICAgICAgICAgICAgLy8gT3B0aW9uYWxseSwgaWYgdHJ1ZSBpcyBnaXZlbiBhcyB0aGUgZnJvbVNlcnZlciBwYXJhbWV0ZXIsXG4gICAgICAgICAgICAvLyB0aGVuIHRoaXMgY2FjaGVkIHZhbHVlIHdpbGwgbm90IGJlIHVzZWQuXG5cbiAgICAgICAgICAgIGlmICh0aGlzLmlzQXV0aGVudGljYXRlZCgpICYmIGZyb21TZXJ2ZXIgIT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJHEud2hlbihTZXNzaW9uLnVzZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBNYWtlIHJlcXVlc3QgR0VUIC9zZXNzaW9uLlxuICAgICAgICAgICAgLy8gSWYgaXQgcmV0dXJucyBhIHVzZXIsIGNhbGwgb25TdWNjZXNzZnVsTG9naW4gd2l0aCB0aGUgcmVzcG9uc2UuXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgNDAxIHJlc3BvbnNlLCB3ZSBjYXRjaCBpdCBhbmQgaW5zdGVhZCByZXNvbHZlIHRvIG51bGwuXG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvc2Vzc2lvbicpLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dpbiA9IGZ1bmN0aW9uIChjcmVkZW50aWFscykge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9sb2dpbicsIGNyZWRlbnRpYWxzKVxuICAgICAgICAgICAgICAgIC50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKVxuICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAkcS5yZWplY3QoeyBtZXNzYWdlOiAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMubG9nb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2xvZ291dCcpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIFNlc3Npb24uZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgfSk7XG5cbiAgICBhcHAuc2VydmljZSgnU2Vzc2lvbicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUykge1xuXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5ub3RBdXRoZW50aWNhdGVkLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnVzZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuY3JlYXRlID0gZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgIHRoaXMudXNlciA9IHVzZXI7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy51c2VyID0gbnVsbDtcbiAgICAgICAgfTtcblxuICAgIH0pO1xuXG59KCkpO1xuIiwiYXBwLmRpcmVjdGl2ZSgnbmF2YmFyJywgZnVuY3Rpb24oKXtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0UnLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvZGlyZWN0aXZlcy9uYXZiYXIvbmF2YmFyLmh0bWwnLFxuXHR9XG59KTtcbiIsImFwcC5kaXJlY3RpdmUoJ3RhYm1lbnUnLCBmdW5jdGlvbigpe1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnRScsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy9kaXJlY3RpdmVzL3RhYk1lbnUvdGFiTWVudS5odG1sJyxcblx0fVxufSlcbiIsImFwcC5jb250cm9sbGVyKCAnTGVhZ3VlQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJGh0dHAsIExlYWd1ZUZhY3Rvcnkpe1xuXHRMZWFndWVGYWN0b3J5LmdldExlYWd1ZVRlYW1zKClcblx0LnRoZW4obGVhZ3VlVGVhbXMgPT4geyAkc2NvcGUudGVhbXMgPSBsZWFndWVUZWFtcyB9KVxufSk7XG4iLCJhcHAuZmFjdG9yeSgnTGVhZ3VlRmFjdG9yeScsIGZ1bmN0aW9uKCRodHRwLCAkc3RhdGVQYXJhbXMpe1xuXG5cdGZ1bmN0aW9uIGdldExlYWd1ZVRlYW1zKCl7XG5cdFx0cmV0dXJuICRodHRwLmdldCgnL2FwaS9sZWFndWUvJyArICRzdGF0ZVBhcmFtcy5pZCArICcvdGVhbXMnIClcblx0XHQudGhlbiggcmVzcG9uc2UgPT4ge1xuXHRcdFx0cmV0dXJuIHJlc3BvbnNlLmRhdGE7XG5cdFx0fSlcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0Z2V0TGVhZ3VlVGVhbXM6IGdldExlYWd1ZVRlYW1zLFxuXG5cdH1cblxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyKXtcblx0JHN0YXRlUHJvdmlkZXIuc3RhdGUoICdsZWFndWUnLCB7XG5cdFx0dXJsOiAnL2xlYWd1ZS86aWQnLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvdmlld3MvbGVhZ3VlL2xlYWd1ZS5odG1sJyxcblx0XHRjb250cm9sbGVyOiAnTGVhZ3VlQ3RybCdcblx0fSlcbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlcil7XG5cblx0JHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2xvZ2luJywge1xuXHRcdHVybDogJy9sb2dpbicsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy92aWV3cy9sb2dpbi9sb2dpbi5odG1sJyxcblx0XHRjb250cm9sbGVyOiAnTG9naW5DdHJsJ1xuXHR9KVxufSk7XG5cbmFwcC5jb250cm9sbGVyKCdMb2dpbkN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCBBdXRoU2VydmljZSwgJHN0YXRlLCBVc2VyRmFjdG9yeSkge1xuXG4gICAgJHNjb3BlLmxvZ2luID0ge307XG4gICAgJHNjb3BlLmVycm9yID0gbnVsbDtcbiAgICAkc2NvcGUuaXNMb2dpblN0YXRlID0gKCkgPT4ge3JldHVybiB0cnVlO31cblxuICAgICRzY29wZS5zZW5kTG9naW4gPSBmdW5jdGlvbiAobG9naW5JbmZvKSB7XG5cbiAgICAgICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICAgICBBdXRoU2VydmljZS5sb2dpbihsb2dpbkluZm8pLnRoZW4oICgpID0+IFVzZXJGYWN0b3J5LmluaXRVc2VyRmFjdG9yeSgpIClcbiAgICAgICAgLnRoZW4oICgpID0+IHsgJHN0YXRlLmdvKCd1c2VyJykgfSlcbiAgICAgICAgLmNhdGNoKCAoKSA9PiB7ICRzY29wZS5lcnJvciA9ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLicgfSk7XG5cbiAgICB9O1xuXG59KTtcblxuIiwiYXBwLmNvbnRyb2xsZXIoICdOQkFfQ3RybCcsIGZ1bmN0aW9uKCAkc2NvcGUsIE5CQV9MZWFndWVfRmFjdG9yeSwgJGxvZyl7XG5cblx0JHNjb3BlLnRhYiA9IHsgbmJhU3RhbmRpbmdzOiAnYWN0aXZlJyB9XG5cblx0JHNjb3BlLm5iYVRlYW1zSW5mbyA9IE5CQV9MZWFndWVfRmFjdG9yeS5nZXROQkFUZWFtSW5mbztcblxuXG59KTtcbiIsImFwcC5mYWN0b3J5KCdOQkFfTGVhZ3VlX0ZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCwgJGxvZyl7XG5cblx0bGV0IG5iYVRlYW1JbmZvID0gW107XG5cblx0Ly8gRm9yIG5vdyBqdXN0IG1ha2luZyBhbiBJSUZFIHdpbGwgbWFrZSBtb3JlXG5cdC8vIHBlcmZvcm1hbnQgbGF0ZXJcblx0KGZ1bmN0aW9uIGdldE5CQVRlYW1JbmZvKCl7XG5cdFx0cmV0dXJuICRodHRwLmdldCgnYXBpL25iYS10ZWFtcy93aW5zLzIwMTYnKVxuXHQgICAgLnRoZW4oIHJlc3BvbnNlID0+IHtcblx0ICAgIFx0bmJhVGVhbUluZm8gPSByZXNwb25zZS5kYXRhO1xuXHQgICAgfSlcblx0ICAgIC5jYXRjaCgkbG9nKVxuXHR9KSgpXG5cblx0cmV0dXJuIHtcblx0XHRnZXROQkFUZWFtSW5mbzogKCkgPT4gbmJhVGVhbUluZm8sXG5cdH1cblxufSk7XG4iLCJhcHAuY29uZmlnKCAkc3RhdGVQcm92aWRlciA9PiB7XG5cdFxuXHQkc3RhdGVQcm92aWRlci5zdGF0ZSggJ25iYUxlYWd1ZScsIHtcblx0XHR1cmw6ICcvbmJhLXN0YW5kaW5ncycsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy92aWV3cy9uYmEtbGVhZ3VlL25iYS5sZWFndWUuaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ05CQV9DdHJsJ1xuXHR9KVxufSlcbiIsImFwcC5jb250cm9sbGVyKCAnVGVhbUN0cmwnLCAoJHNjb3BlLCBUZWFtRmFjdG9yeSkgPT4ge1xuXG5cdCRzY29wZS50YWIgPSB7IHRlYW06ICdhY3RpdmUnIH1cblxuXHRUZWFtRmFjdG9yeS5nZXRUZWFtcygpXG5cdC50aGVuKG5iYVRlYW1zID0+IHtcblx0XHQkc2NvcGUubmJhVGVhbXMgPSBuYmFUZWFtc1xuXHR9KVxuXG59KTtcbiIsImFwcC5mYWN0b3J5KCAnVGVhbUZhY3RvcnknLCAoICRodHRwLCAkc3RhdGVQYXJhbXMsICRsb2cpID0+IHtcblxuXHRmdW5jdGlvbiBnZXRUZWFtcygpe1xuXG5cdFx0cmV0dXJuICRodHRwLmdldCgnYXBpL3RlYW0vJyArICRzdGF0ZVBhcmFtcy5pZCArICcvbmJhX3RlYW1zJylcblx0XHQudGhlbiggcmVzcG9uc2UgPT4ge1xuXHRcdFx0cmV0dXJuIHJlc3BvbnNlLmRhdGE7XG5cdFx0fSlcblx0XHQuY2F0Y2goJGxvZylcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0Z2V0VGVhbXM6IGdldFRlYW1zLFxuXHR9XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyggJHN0YXRlUHJvdmlkZXIgPT4ge1xuXG5cdCRzdGF0ZVByb3ZpZGVyLnN0YXRlKCAndGVhbScsIHtcblx0XHR1cmw6ICcvdGVhbS86aWQnLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvdmlld3MvdGVhbS90ZWFtLmh0bWwnLFxuXHRcdGNvbnRyb2xsZXI6ICdUZWFtQ3RybCcsXG5cdH0pO1xuXG59KTtcbiIsImFwcC5jb250cm9sbGVyKCdVc2VyQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgVXNlckZhY3Rvcnkpe1xuXG5cdCRzY29wZS51c2VyVGVhbXMgPSBVc2VyRmFjdG9yeS5nZXRVc2VyVGVhbXMoKTtcblx0JHNjb3BlLnRhYiA9IHsgaG9tZTogJ2FjdGl2ZScgfVxuXG59KTtcbiIsImFwcC5mYWN0b3J5KCAnVXNlckZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCwgU2Vzc2lvbiwgJGxvZyl7XG5cblx0bGV0IHVzZXJUZWFtcyA9IFtdO1xuXHRsZXQgdXNlclNlbGVjdGVkVGVhbSA9IHVuZGVmaW5lZDtcblxuXG5cdGZ1bmN0aW9uIGluaXRVc2VyRmFjdG9yeSgpe1xuXHRcdHJldHVybiAkaHR0cC5nZXQoJ2FwaS90ZWFtL3VzZXIvJyArIFNlc3Npb24udXNlci5pZCApXG5cdFx0LnRoZW4oIHJlc3BvbnNlID0+IHtcblx0XHRcdHVzZXJUZWFtcyA9IHJlc3BvbnNlLmRhdGE7XG5cdFx0XHR1c2VyU2VsZWN0ZWRUZWFtID0gdXNlclRlYW1zWzBdO1xuXHRcdH0pXG5cdFx0LmNhdGNoKCRsb2cpXG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGluaXRVc2VyRmFjdG9yeTogaW5pdFVzZXJGYWN0b3J5LFxuXHRcdGdldFVzZXJUZWFtczogKCkgPT4gdXNlclRlYW1zLFxuXHRcdGdldFNlbGVjdGVkVGVhbTogKCkgPT4gdXNlclNlbGVjdGVkVGVhbVxuXHR9XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlcil7XG5cblx0JHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3VzZXInLCB7XG5cdFx0dXJsOiAnL3VzZXInLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvdmlld3MvdXNlci91c2VyLmh0bWwnLFxuXHRcdGNvbnRyb2xsZXI6ICdVc2VyQ3RybCdcblx0fSlcblxufSk7XG4iXX0=
