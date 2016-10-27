let Sequelize = require('sequelize');
let db = require('../_db');

module.exports = db.define( 'team', {
	name: {
		type: Sequelize.STRING,
		allowNull: false,
		isAlphanumeric: true,
		len: [6, 25]
	},
	wins: {
		type: Sequelize.INTEGER,
		allowNull: false,
		isNumeric: true,
		defaultValue: 0
	}
});
