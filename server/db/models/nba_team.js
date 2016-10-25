let Sequelize = require('sequelize');
let db = require('../_db');

module.exports = db.define('nba_team', {
	name: {
		type: Sequelize.STRING,
		allowNull: false,
		isAlpha: true
	},
	nextGame: {
		type: Sequelize.DATE,
		allowNull: false
	},
	wins: {
		type: Sequelize.INTEGER,
		allowNull: false,
		min: 0,
	},
	lastYearWins: {
		type: Sequelize.INTEGER,
		allowNull: false,
		min: 0,
	}
});
