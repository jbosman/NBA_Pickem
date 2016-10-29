'use strict'

let Sequelize = require('sequelize');
let db = require('../_db');

module.exports = db.define('TeamNBA_Teams', {
	teamWins: {
		type: Sequelize.INTEGER,
		allowNull: false,
		isNumeric: true,
		defaultValue: 0
	},
	status: {
		type: Sequelize.ENUM('owned', 'traded', 'dropped'), // eslint-disable-line new-cap
		defaultValue: 'owned'
	}

});
