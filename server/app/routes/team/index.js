'use strict';
let app = require('express')(); // eslint-disable-line new-cap
let db = require('../../../db/_db');
let Team = db.model('team');
let League = db.model('league');


module.exports = app;

// Returns all teams for a given user id
app.get( '/user/:id', (req, res, next) => {

	Team.findAll({ where: {
		userId: req.params.id,
	},
		include: [{ model: League }]
	})
	.then( userTeams => {
		res.send(userTeams);
	})
	.catch(next)

});

// Returns all teams for a given league id
app.get( '/league/:id', (req, res, next) => {

	Team.findAll({ where: {
		leagueId: req.params.id
	}})
	.then( teamsInLeague => {
		res.send(teamsInLeague);
	})
	.catch(next)

});

app.get( '/:id/nba_teams', (req, res, next) =>{

	Team.findOne({ where: { 
		id: req.params.id
	}})
	.then( team => {
		return team.getNbaTeams();
	})
	.then( nbaTeams => { res.send(nbaTeams) })
	.catch(next);

});
