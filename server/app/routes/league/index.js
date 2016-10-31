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
		
		filteredTeams.forEach( (group,i) => {
			let sum = 0;
			group.forEach( team => {
				sum += team.wins;
			})
			teamsInLeagueSave[i].wins = sum;
		})

		res.send(teamsInLeagueSave);
	})
	.catch(next)

});
