'use strict'

let Sequelize = require('sequelize');
let db = require('../_db');

module.exports = db.define('league', {
	numOfTeams: {
		type: Sequelize.INTEGER,
		allowNull: false,
		min: 2,
		max: 16
	}
});
