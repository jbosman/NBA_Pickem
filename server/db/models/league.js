'use strict'

let Sequelize = require('sequelize');
let db = require('../_db');

module.exports = db.define('league', {
	name: {
		type: Sequelize.STRING,
		allowNull: false
	}
});
