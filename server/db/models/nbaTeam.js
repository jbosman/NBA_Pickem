let Sequelize = require('sequelize');
let db = require('../_db');

module.exports = db.define( 'nbaTeam', {
	name: {
		type: Sequelize.STRING,
		allowNull: false,
		isAlpha: true
	},
	abbr: {
		type: Sequelize.STRING,
		allowNull: false,
		isAlpha: true
	}
});
