'use strict';

window.app = angular.module('NBA_Pickem_App', ['preBuilt', 'ui.router']);

app.config(function ($urlRouterProvider, $locationProvider) {
    // This turns off hashbang urls (/#about) and changes it to something normal (/about)
    $locationProvider.html5Mode(true);
    // If we go to a URL that ui-router doesn't have registered, go to the "/" url.
    $urlRouterProvider.otherwise('/');
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

app.controller('TeamCtrl', function ($scope, TeamFactory) {

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
        url: 'team/:id',
        templateUrl: 'js/views/team/team.html',
        controller: 'TeamCtrl'
    });
});

app.controller('UserCtrl', function ($scope, UserFactory) {

    $scope.userTeams = UserFactory.getUserTeams();
});

app.factory('UserFactory', function ($http, Session, $log) {

    var userTeams = [];

    function initUserFactory() {
        return $http.get('api/team/user/' + Session.user.id).then(function (response) {
            userTeams = response.data;
        }).catch($log);
    }

    return {
        initUserFactory: initUserFactory,
        getUserTeams: function getUserTeams() {
            return userTeams;
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsInByZS1idWlsdC9wcmUtYnVpbHQuanMiLCJkaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuanMiLCJ2aWV3cy9sZWFndWUvbGVhZ3VlLmNvbnRyb2xsZXIuanMiLCJ2aWV3cy9sZWFndWUvbGVhZ3VlLmZhY3RvcnkuanMiLCJ2aWV3cy9sZWFndWUvbGVhZ3VlLnN0YXRlLmpzIiwidmlld3MvbG9naW4vbG9naW4uc3RhdGUuanMiLCJ2aWV3cy90ZWFtL3RlYW0uY29udHJvbGxlci5qcyIsInZpZXdzL3RlYW0vdGVhbS5mYWN0b3J5LmpzIiwidmlld3MvdGVhbS90ZWFtLnN0YXRlLmpzIiwidmlld3MvdXNlci91c2VyLmNvbnRyb2xsZXIuanMiLCJ2aWV3cy91c2VyL3VzZXIuZmFjdG9yeS5qcyIsInZpZXdzL3VzZXIvdXNlci5zdGF0ZS5qcyJdLCJuYW1lcyI6WyJ3aW5kb3ciLCJhcHAiLCJhbmd1bGFyIiwibW9kdWxlIiwiY29uZmlnIiwiJHVybFJvdXRlclByb3ZpZGVyIiwiJGxvY2F0aW9uUHJvdmlkZXIiLCJodG1sNU1vZGUiLCJvdGhlcndpc2UiLCJ3aGVuIiwibG9jYXRpb24iLCJyZWxvYWQiLCJydW4iLCIkcm9vdFNjb3BlIiwiJG9uIiwiZXZlbnQiLCJ0b1N0YXRlIiwidG9QYXJhbXMiLCJmcm9tU3RhdGUiLCJmcm9tUGFyYW1zIiwidGhyb3duRXJyb3IiLCJjb25zb2xlIiwiaW5mbyIsIm5hbWUiLCJlcnJvciIsIkF1dGhTZXJ2aWNlIiwiJHN0YXRlIiwiZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCIsInN0YXRlIiwiZGF0YSIsImF1dGhlbnRpY2F0ZSIsImlzQXV0aGVudGljYXRlZCIsInByZXZlbnREZWZhdWx0IiwiZ2V0TG9nZ2VkSW5Vc2VyIiwidGhlbiIsInVzZXIiLCJnbyIsIkVycm9yIiwiY29uc3RhbnQiLCJsb2dpblN1Y2Nlc3MiLCJsb2dpbkZhaWxlZCIsImxvZ291dFN1Y2Nlc3MiLCJzZXNzaW9uVGltZW91dCIsIm5vdEF1dGhlbnRpY2F0ZWQiLCJub3RBdXRob3JpemVkIiwiZmFjdG9yeSIsIiRxIiwiQVVUSF9FVkVOVFMiLCJzdGF0dXNEaWN0IiwicmVzcG9uc2VFcnJvciIsInJlc3BvbnNlIiwiJGJyb2FkY2FzdCIsInN0YXR1cyIsInJlamVjdCIsIiRodHRwUHJvdmlkZXIiLCJpbnRlcmNlcHRvcnMiLCJwdXNoIiwiJGluamVjdG9yIiwiZ2V0Iiwic2VydmljZSIsIiRodHRwIiwiU2Vzc2lvbiIsIm9uU3VjY2Vzc2Z1bExvZ2luIiwiY3JlYXRlIiwiZnJvbVNlcnZlciIsImNhdGNoIiwibG9naW4iLCJjcmVkZW50aWFscyIsInBvc3QiLCJtZXNzYWdlIiwibG9nb3V0IiwiZGVzdHJveSIsInNlbGYiLCJkaXJlY3RpdmUiLCJyZXN0cmljdCIsInRlbXBsYXRlVXJsIiwiY29udHJvbGxlciIsIiRzY29wZSIsIkxlYWd1ZUZhY3RvcnkiLCJnZXRMZWFndWVUZWFtcyIsInRlYW1zIiwibGVhZ3VlVGVhbXMiLCIkc3RhdGVQYXJhbXMiLCJpZCIsIiRzdGF0ZVByb3ZpZGVyIiwidXJsIiwiVXNlckZhY3RvcnkiLCJzZW5kTG9naW4iLCJsb2dpbkluZm8iLCJpbml0VXNlckZhY3RvcnkiLCJUZWFtRmFjdG9yeSIsImdldFRlYW1zIiwibmJhVGVhbXMiLCIkbG9nIiwidXNlclRlYW1zIiwiZ2V0VXNlclRlYW1zIl0sIm1hcHBpbmdzIjoiQUFBQTs7QUFDQUEsT0FBQUMsR0FBQSxHQUFBQyxRQUFBQyxNQUFBLENBQUEsZ0JBQUEsRUFBQSxDQUFBLFVBQUEsRUFBQSxXQUFBLENBQUEsQ0FBQTs7QUFFQUYsSUFBQUcsTUFBQSxDQUFBLFVBQUFDLGtCQUFBLEVBQUFDLGlCQUFBLEVBQUE7QUFDQTtBQUNBQSxzQkFBQUMsU0FBQSxDQUFBLElBQUE7QUFDQTtBQUNBRix1QkFBQUcsU0FBQSxDQUFBLEdBQUE7QUFDQTtBQUNBSCx1QkFBQUksSUFBQSxDQUFBLGlCQUFBLEVBQUEsWUFBQTtBQUNBVCxlQUFBVSxRQUFBLENBQUFD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LENBQUE7QUFHQTs7QUFFQSxXQUFBO0FBQ0FKLHlCQUFBQSxlQURBO0FBRUFNLHNCQUFBO0FBQUEsbUJBQUFELFNBQUE7QUFBQTtBQUZBLEtBQUE7QUFLQSxDQWZBOztBQ0FBN0YsSUFBQUcsTUFBQSxDQUFBLFVBQUFnRixjQUFBLEVBQUE7O0FBRUFBLG1CQUFBeEQsS0FBQSxDQUFBLE1BQUEsRUFBQTtBQUNBeUQsYUFBQSxPQURBO0FBRUFWLHFCQUFBLHlCQUZBO0FBR0FDLG9CQUFBO0FBSEEsS0FBQTtBQU1BLENBUkEiLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcbndpbmRvdy5hcHAgPSBhbmd1bGFyLm1vZHVsZSgnTkJBX1BpY2tlbV9BcHAnLCBbJ3ByZUJ1aWx0JywgJ3VpLnJvdXRlciddKTtcblxuYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHVybFJvdXRlclByb3ZpZGVyLCAkbG9jYXRpb25Qcm92aWRlcikge1xuICAgIC8vIFRoaXMgdHVybnMgb2ZmIGhhc2hiYW5nIHVybHMgKC8jYWJvdXQpIGFuZCBjaGFuZ2VzIGl0IHRvIHNvbWV0aGluZyBub3JtYWwgKC9hYm91dClcbiAgICAkbG9jYXRpb25Qcm92aWRlci5odG1sNU1vZGUodHJ1ZSk7XG4gICAgLy8gSWYgd2UgZ28gdG8gYSBVUkwgdGhhdCB1aS1yb3V0ZXIgZG9lc24ndCBoYXZlIHJlZ2lzdGVyZWQsIGdvIHRvIHRoZSBcIi9cIiB1cmwuXG4gICAgJHVybFJvdXRlclByb3ZpZGVyLm90aGVyd2lzZSgnLycpO1xuICAgIC8vIFRyaWdnZXIgcGFnZSByZWZyZXNoIHdoZW4gYWNjZXNzaW5nIGFuIE9BdXRoIHJvdXRlXG4gICAgJHVybFJvdXRlclByb3ZpZGVyLndoZW4oJy9hdXRoLzpwcm92aWRlcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xuICAgIH0pO1xufSk7XG5cbi8vIFRoaXMgYXBwLnJ1biBpcyBmb3IgbGlzdGVuaW5nIHRvIGVycm9ycyBicm9hZGNhc3RlZCBieSB1aS1yb3V0ZXIsIHVzdWFsbHkgb3JpZ2luYXRpbmcgZnJvbSByZXNvbHZlc1xuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSkge1xuICAgICRyb290U2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VFcnJvcicsIGZ1bmN0aW9uIChldmVudCwgdG9TdGF0ZSwgdG9QYXJhbXMsIGZyb21TdGF0ZSwgZnJvbVBhcmFtcywgdGhyb3duRXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5pbmZvKGBUaGUgZm9sbG93aW5nIGVycm9yIHdhcyB0aHJvd24gYnkgdWktcm91dGVyIHdoaWxlIHRyYW5zaXRpb25pbmcgdG8gc3RhdGUgXCIke3RvU3RhdGUubmFtZX1cIi4gVGhlIG9yaWdpbiBvZiB0aGlzIGVycm9yIGlzIHByb2JhYmx5IGEgcmVzb2x2ZSBmdW5jdGlvbjpgKTtcbiAgICAgICAgY29uc29sZS5lcnJvcih0aHJvd25FcnJvcik7XG4gICAgfSk7XG59KTtcblxuLy8gVGhpcyBhcHAucnVuIGlzIGZvciBjb250cm9sbGluZyBhY2Nlc3MgdG8gc3BlY2lmaWMgc3RhdGVzLlxuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuXG4gICAgLy8gVGhlIGdpdmVuIHN0YXRlIHJlcXVpcmVzIGFuIGF1dGhlbnRpY2F0ZWQgdXNlci5cbiAgICB2YXIgZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICByZXR1cm4gc3RhdGUuZGF0YSAmJiBzdGF0ZS5kYXRhLmF1dGhlbnRpY2F0ZTtcbiAgICB9O1xuXG4gICAgLy8gJHN0YXRlQ2hhbmdlU3RhcnQgaXMgYW4gZXZlbnQgZmlyZWRcbiAgICAvLyB3aGVuZXZlciB0aGUgcHJvY2VzcyBvZiBjaGFuZ2luZyBhIHN0YXRlIGJlZ2lucy5cbiAgICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlU3RhcnQnLCBmdW5jdGlvbiAoZXZlbnQsIHRvU3RhdGUsIHRvUGFyYW1zKSB7XG5cbiAgICAgICAgaWYgKCFkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoKHRvU3RhdGUpKSB7XG4gICAgICAgICAgICAvLyBUaGUgZGVzdGluYXRpb24gc3RhdGUgZG9lcyBub3QgcmVxdWlyZSBhdXRoZW50aWNhdGlvblxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSkge1xuICAgICAgICAgICAgLy8gVGhlIHVzZXIgaXMgYXV0aGVudGljYXRlZC5cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYW5jZWwgbmF2aWdhdGluZyB0byBuZXcgc3RhdGUuXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgLy8gSWYgYSB1c2VyIGlzIHJldHJpZXZlZCwgdGhlbiByZW5hdmlnYXRlIHRvIHRoZSBkZXN0aW5hdGlvblxuICAgICAgICAgICAgLy8gKHRoZSBzZWNvbmQgdGltZSwgQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkgd2lsbCB3b3JrKVxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlLCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbiwgZ28gdG8gXCJsb2dpblwiIHN0YXRlLlxuICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28odG9TdGF0ZS5uYW1lLCB0b1BhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbygnbG9naW4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9KTtcblxufSk7XG4iLCIoZnVuY3Rpb24gKCkge1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLy8gSG9wZSB5b3UgZGlkbid0IGZvcmdldCBBbmd1bGFyISBEdWgtZG95LlxuICAgIGlmICghd2luZG93LmFuZ3VsYXIpIHRocm93IG5ldyBFcnJvcignSSBjYW5cXCd0IGZpbmQgQW5ndWxhciEnKTtcblxuICAgIHZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgncHJlQnVpbHQnLCBbXSk7XG5cbiAgICAvLyBhcHAuZmFjdG9yeSgnU29ja2V0JywgZnVuY3Rpb24gKCkge1xuICAgIC8vICAgICBpZiAoIXdpbmRvdy5pbykgdGhyb3cgbmV3IEVycm9yKCdzb2NrZXQuaW8gbm90IGZvdW5kIScpO1xuICAgIC8vICAgICByZXR1cm4gd2luZG93LmlvKHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4pO1xuICAgIC8vIH0pO1xuXG4gICAgLy8gQVVUSF9FVkVOVFMgaXMgdXNlZCB0aHJvdWdob3V0IG91ciBhcHAgdG9cbiAgICAvLyBicm9hZGNhc3QgYW5kIGxpc3RlbiBmcm9tIGFuZCB0byB0aGUgJHJvb3RTY29wZVxuICAgIC8vIGZvciBpbXBvcnRhbnQgZXZlbnRzIGFib3V0IGF1dGhlbnRpY2F0aW9uIGZsb3cuXG4gICAgYXBwLmNvbnN0YW50KCdBVVRIX0VWRU5UUycsIHtcbiAgICAgICAgbG9naW5TdWNjZXNzOiAnYXV0aC1sb2dpbi1zdWNjZXNzJyxcbiAgICAgICAgbG9naW5GYWlsZWQ6ICdhdXRoLWxvZ2luLWZhaWxlZCcsXG4gICAgICAgIGxvZ291dFN1Y2Nlc3M6ICdhdXRoLWxvZ291dC1zdWNjZXNzJyxcbiAgICAgICAgc2Vzc2lvblRpbWVvdXQ6ICdhdXRoLXNlc3Npb24tdGltZW91dCcsXG4gICAgICAgIG5vdEF1dGhlbnRpY2F0ZWQ6ICdhdXRoLW5vdC1hdXRoZW50aWNhdGVkJyxcbiAgICAgICAgbm90QXV0aG9yaXplZDogJ2F1dGgtbm90LWF1dGhvcml6ZWQnXG4gICAgfSk7XG5cbiAgICBhcHAuZmFjdG9yeSgnQXV0aEludGVyY2VwdG9yJywgZnVuY3Rpb24gKCRyb290U2NvcGUsICRxLCBBVVRIX0VWRU5UUykge1xuICAgICAgICB2YXIgc3RhdHVzRGljdCA9IHtcbiAgICAgICAgICAgIDQwMTogQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCxcbiAgICAgICAgICAgIDQwMzogQVVUSF9FVkVOVFMubm90QXV0aG9yaXplZCxcbiAgICAgICAgICAgIDQxOTogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsXG4gICAgICAgICAgICA0NDA6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZUVycm9yOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3Qoc3RhdHVzRGljdFtyZXNwb25zZS5zdGF0dXNdLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdChyZXNwb25zZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9KTtcblxuICAgIGFwcC5jb25maWcoZnVuY3Rpb24gKCRodHRwUHJvdmlkZXIpIHtcbiAgICAgICAgJGh0dHBQcm92aWRlci5pbnRlcmNlcHRvcnMucHVzaChbXG4gICAgICAgICAgICAnJGluamVjdG9yJyxcbiAgICAgICAgICAgIGZ1bmN0aW9uICgkaW5qZWN0b3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJGluamVjdG9yLmdldCgnQXV0aEludGVyY2VwdG9yJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIF0pO1xuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ0F1dGhTZXJ2aWNlJywgZnVuY3Rpb24gKCRodHRwLCBTZXNzaW9uLCAkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUywgJHEpIHtcblxuICAgICAgICBmdW5jdGlvbiBvblN1Y2Nlc3NmdWxMb2dpbihyZXNwb25zZSkge1xuICAgICAgICAgICAgdmFyIHVzZXIgPSByZXNwb25zZS5kYXRhLnVzZXI7XG4gICAgICAgICAgICBTZXNzaW9uLmNyZWF0ZSh1c2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MpO1xuICAgICAgICAgICAgcmV0dXJuIHVzZXI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVc2VzIHRoZSBzZXNzaW9uIGZhY3RvcnkgdG8gc2VlIGlmIGFuXG4gICAgICAgIC8vIGF1dGhlbnRpY2F0ZWQgdXNlciBpcyBjdXJyZW50bHkgcmVnaXN0ZXJlZC5cbiAgICAgICAgdGhpcy5pc0F1dGhlbnRpY2F0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gISFTZXNzaW9uLnVzZXI7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5nZXRMb2dnZWRJblVzZXIgPSBmdW5jdGlvbiAoZnJvbVNlcnZlcikge1xuXG4gICAgICAgICAgICAvLyBJZiBhbiBhdXRoZW50aWNhdGVkIHNlc3Npb24gZXhpc3RzLCB3ZVxuICAgICAgICAgICAgLy8gcmV0dXJuIHRoZSB1c2VyIGF0dGFjaGVkIHRvIHRoYXQgc2Vzc2lvblxuICAgICAgICAgICAgLy8gd2l0aCBhIHByb21pc2UuIFRoaXMgZW5zdXJlcyB0aGF0IHdlIGNhblxuICAgICAgICAgICAgLy8gYWx3YXlzIGludGVyZmFjZSB3aXRoIHRoaXMgbWV0aG9kIGFzeW5jaHJvbm91c2x5LlxuXG4gICAgICAgICAgICAvLyBPcHRpb25hbGx5LCBpZiB0cnVlIGlzIGdpdmVuIGFzIHRoZSBmcm9tU2VydmVyIHBhcmFtZXRlcixcbiAgICAgICAgICAgIC8vIHRoZW4gdGhpcyBjYWNoZWQgdmFsdWUgd2lsbCBub3QgYmUgdXNlZC5cblxuICAgICAgICAgICAgaWYgKHRoaXMuaXNBdXRoZW50aWNhdGVkKCkgJiYgZnJvbVNlcnZlciAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAkcS53aGVuKFNlc3Npb24udXNlcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE1ha2UgcmVxdWVzdCBHRVQgL3Nlc3Npb24uXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgdXNlciwgY2FsbCBvblN1Y2Nlc3NmdWxMb2dpbiB3aXRoIHRoZSByZXNwb25zZS5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSA0MDEgcmVzcG9uc2UsIHdlIGNhdGNoIGl0IGFuZCBpbnN0ZWFkIHJlc29sdmUgdG8gbnVsbC5cbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9zZXNzaW9uJykudGhlbihvblN1Y2Nlc3NmdWxMb2dpbikuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxvZ2luID0gZnVuY3Rpb24gKGNyZWRlbnRpYWxzKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAucG9zdCgnL2xvZ2luJywgY3JlZGVudGlhbHMpXG4gICAgICAgICAgICAgICAgLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdCh7IG1lc3NhZ2U6ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLicgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvbG9nb3V0JykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgU2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxuICAgIGFwcC5zZXJ2aWNlKCdTZXNzaW9uJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIEFVVEhfRVZFTlRTKSB7XG5cbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMudXNlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jcmVhdGUgPSBmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgdGhpcy51c2VyID0gdXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnVzZXIgPSBudWxsO1xuICAgICAgICB9O1xuXG4gICAgfSk7XG5cbn0oKSk7XG4iLCJhcHAuZGlyZWN0aXZlKCduYXZiYXInLCBmdW5jdGlvbigpe1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnRScsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuaHRtbCdcblx0fTtcbn0pXG4iLCJhcHAuY29udHJvbGxlciggJ0xlYWd1ZUN0cmwnLCBmdW5jdGlvbigkc2NvcGUsICRodHRwLCBMZWFndWVGYWN0b3J5KXtcblx0TGVhZ3VlRmFjdG9yeS5nZXRMZWFndWVUZWFtcygpXG5cdC50aGVuKGxlYWd1ZVRlYW1zID0+IHsgJHNjb3BlLnRlYW1zID0gbGVhZ3VlVGVhbXMgfSlcbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ0xlYWd1ZUZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCwgJHN0YXRlUGFyYW1zKXtcblxuXHRmdW5jdGlvbiBnZXRMZWFndWVUZWFtcygpe1xuXHRcdHJldHVybiAkaHR0cC5nZXQoJy9hcGkvbGVhZ3VlLycgKyAkc3RhdGVQYXJhbXMuaWQgKyAnL3RlYW1zJyApXG5cdFx0LnRoZW4oIHJlc3BvbnNlID0+IHtcblx0XHRcdHJldHVybiByZXNwb25zZS5kYXRhO1xuXHRcdH0pXG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGdldExlYWd1ZVRlYW1zOiBnZXRMZWFndWVUZWFtcyxcblxuXHR9XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlcil7XG5cdCRzdGF0ZVByb3ZpZGVyLnN0YXRlKCAnbGVhZ3VlJywge1xuXHRcdHVybDogJy9sZWFndWUvOmlkJyxcblx0XHR0ZW1wbGF0ZVVybDogJ2pzL3ZpZXdzL2xlYWd1ZS9sZWFndWUuaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ0xlYWd1ZUN0cmwnXG5cdH0pXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpe1xuXG5cdCRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdsb2dpbicsIHtcblx0XHR1cmw6ICcvbG9naW4nLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvdmlld3MvbG9naW4vbG9naW4uaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ0xvZ2luQ3RybCdcblx0fSlcbn0pO1xuXG5hcHAuY29udHJvbGxlcignTG9naW5DdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSwgVXNlckZhY3RvcnkpIHtcblxuICAgICRzY29wZS5sb2dpbiA9IHt9O1xuICAgICRzY29wZS5lcnJvciA9IG51bGw7XG5cbiAgICAkc2NvcGUuc2VuZExvZ2luID0gZnVuY3Rpb24gKGxvZ2luSW5mbykge1xuXG4gICAgICAgICRzY29wZS5lcnJvciA9IG51bGw7XG5cbiAgICAgICAgQXV0aFNlcnZpY2UubG9naW4obG9naW5JbmZvKS50aGVuKCAoKSA9PiBVc2VyRmFjdG9yeS5pbml0VXNlckZhY3RvcnkoKSApXG4gICAgICAgIC50aGVuKCAoKSA9PiB7ICRzdGF0ZS5nbygndXNlcicpIH0pXG4gICAgICAgIC5jYXRjaCggKCkgPT4geyAkc2NvcGUuZXJyb3IgPSAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nIH0pO1xuXG4gICAgfTtcblxufSk7XG5cbiIsImFwcC5jb250cm9sbGVyKCAnVGVhbUN0cmwnLCAoJHNjb3BlLCBUZWFtRmFjdG9yeSkgPT4ge1xuXG5cdFRlYW1GYWN0b3J5LmdldFRlYW1zKClcblx0LnRoZW4obmJhVGVhbXMgPT4ge1xuXHRcdCRzY29wZS5uYmFUZWFtcyA9IG5iYVRlYW1zXG5cdH0pXG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoICdUZWFtRmFjdG9yeScsICggJGh0dHAsICRzdGF0ZVBhcmFtcywgJGxvZykgPT4ge1xuXG5cdGZ1bmN0aW9uIGdldFRlYW1zKCl7XG5cblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCdhcGkvdGVhbS8nICsgJHN0YXRlUGFyYW1zLmlkICsgJy9uYmFfdGVhbXMnKVxuXHRcdC50aGVuKCByZXNwb25zZSA9PiB7XG5cdFx0XHRyZXR1cm4gcmVzcG9uc2UuZGF0YTtcblx0XHR9KVxuXHRcdC5jYXRjaCgkbG9nKVxuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRnZXRUZWFtczogZ2V0VGVhbXMsXG5cdH1cblxufSk7XG4iLCJhcHAuY29uZmlnKCAkc3RhdGVQcm92aWRlciA9PiB7XG5cblx0JHN0YXRlUHJvdmlkZXIuc3RhdGUoICd0ZWFtJywge1xuXHRcdHVybDogJ3RlYW0vOmlkJyxcblx0XHR0ZW1wbGF0ZVVybDogJ2pzL3ZpZXdzL3RlYW0vdGVhbS5odG1sJyxcblx0XHRjb250cm9sbGVyOiAnVGVhbUN0cmwnLFxuXHR9KTtcblxufSk7XG4iLCJhcHAuY29udHJvbGxlcignVXNlckN0cmwnLCBmdW5jdGlvbigkc2NvcGUsIFVzZXJGYWN0b3J5KXtcblxuXHQkc2NvcGUudXNlclRlYW1zID0gVXNlckZhY3RvcnkuZ2V0VXNlclRlYW1zKCk7XG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoICdVc2VyRmFjdG9yeScsIGZ1bmN0aW9uKCRodHRwLCBTZXNzaW9uLCAkbG9nKXtcblxuXHRsZXQgdXNlclRlYW1zID0gW107XG5cblx0ZnVuY3Rpb24gaW5pdFVzZXJGYWN0b3J5KCl7XG5cdFx0cmV0dXJuICRodHRwLmdldCgnYXBpL3RlYW0vdXNlci8nICsgU2Vzc2lvbi51c2VyLmlkIClcblx0XHQudGhlbiggcmVzcG9uc2UgPT4geyB1c2VyVGVhbXMgPSByZXNwb25zZS5kYXRhIH0pXG5cdFx0LmNhdGNoKCRsb2cpXG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGluaXRVc2VyRmFjdG9yeTogaW5pdFVzZXJGYWN0b3J5LFxuXHRcdGdldFVzZXJUZWFtczogKCkgPT4gdXNlclRlYW1zLFxuXHR9XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlcil7XG5cblx0JHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3VzZXInLCB7XG5cdFx0dXJsOiAnL3VzZXInLFxuXHRcdHRlbXBsYXRlVXJsOiAnanMvdmlld3MvdXNlci91c2VyLmh0bWwnLFxuXHRcdGNvbnRyb2xsZXI6ICdVc2VyQ3RybCdcblx0fSlcblxufSk7XG4iXX0=
