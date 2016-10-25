let path = require('path');
let Sequelize = require('sequelize');

let env = require(path.join(__dirname, '../env'));

let db = new Sequelize( env.DATABASE_URL, {
  logging: env.LOGGING ? console.log : false,
  native: env.NATIVE
});

module.exports = db;
