'use strict';
let app = require('express')(); // eslint-disable-line new-cap
let NBA_TEAM = require('../../../db/models/nbaTeam');
let _ = require('lodash');

module.exports = app;

app.get( '/wins/:year', (req, res, next) => {

	NBA_TEAM.findAll()
	.then( allTeams => {
		let sortedTeams = _.sortBy(allTeams, ['wins']).reverse();
		res.send(sortedTeams);
	})
	.catch(next);
});
