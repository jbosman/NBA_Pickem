'use strict';
var chalk = require('chalk');
var db = require('./db');
let updateWins = require('./utilities/updateNBATeams').updateWins;

// Create a node server instance! cOoL!
var server = require('http').createServer();

var createApplication = function () {
    var app = require('./app')(db);
    server.on('request', app); // Attach the Express application.
};

var startServer = function () {

    var PORT = process.env.PORT || 1337;

    server.listen(PORT, function () {
        console.log(chalk.blue('Server started on port', chalk.magenta(PORT)));
    });

    // Update the nba wins every hour
    (function update(){
        setTimeout( function(){
            updateWins();
            update();
        }, 1800000)
    })()

};

db.sync()
.then(createApplication)
.then(startServer)
.catch(function (err) {
    console.error(chalk.red(err.stack));
});
