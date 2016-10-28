'use strict';
let app = require('express')(); // eslint-disable-line new-cap
let Team = require('../../../db/_db').model('team');

module.exports = app;

app.get( '/:id/teams', (req, res, next) => {

	Team.findAll({ where: {
		leagueId: req.params.id
	}})
	.then( teamsInLeague => {
		res.send(teamsInLeague);
	})
	.catch(next)

});
