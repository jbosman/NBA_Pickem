'use strict';
let db = require('./_db');
module.exports = db;

/* eslint-disable no-unused-vars */
let User = require(		'./models/user');
let Team = require(		'./models/team');
let League = require(	'./models/league');
let NBA_Team = require( './models/nba_team');
/* eslint-enable no-unused-vars */

// Associations
