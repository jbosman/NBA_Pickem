'use strict';
let db = require('./_db');
module.exports = db;

/* eslint-disable no-unused-vars */
let User = require(		'./models/user');
let Team = require(		'./models/team');
let League = require(	'./models/league');
let NBA_Team = require(	'./models/nbaTeam');
let TeamNBA_Teams = require( './models/TeamNbaTeam.joinTable');
/* eslint-enable no-unused-vars */

Team.belongsTo(League);
Team.belongsTo(User);

Team.belongsToMany(NBA_Team, {through: TeamNBA_Teams});
NBA_Team.belongsToMany(Team, {through: TeamNBA_Teams});

// Associations

