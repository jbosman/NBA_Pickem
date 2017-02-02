'use strict';
let app = require('express')(); // eslint-disable-line new-cap
let Team = require('../../../db/_db').model('team');

module.exports = app;

app.get( '/:id/teams', (req, res, next) => {

	let teamsInLeagueSave;

	Team.findAll({ where: {
		leagueId: req.params.id
	}})
	.then( teamsInLeague => {
		teamsInLeagueSave = teamsInLeague;
		let grabingNBATeams = teamsInLeague.map( team => {
			return team.getNbaTeams();
		})

		return Promise.all(grabingNBATeams)
	})
	.then( nbaTeams => {
		// Filter of only relavent data from new query
		let filtered = [];

		nbaTeams.forEach( arrayOfTeams => {
			let newArray = [];
			arrayOfTeams.forEach( team => {
				newArray.push(team.dataValues)
			})
			filtered.push(newArray)
		})

		return filtered;
	})
	.then( filteredTeams => {
		// Attach the nba team groups to each team
		filteredTeams.forEach( ( group, i) => {
			teamsInLeagueSave[i].dataValues.teams = group;
		})

		res.send(teamsInLeagueSave);
	})
	.catch(next)

});
