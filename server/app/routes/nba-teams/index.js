'use strict';
let app = require('express')(); // eslint-disable-line new-cap
let NBA_Team_Info = require('../../../utilities/NBA-Team-Info.js');

module.exports = app;

app.get( '/wins/:year', (req, res, next) => {

	NBA_Team_Info(req.params.year) // eslint-disable-line new-cap
	.then( result => {
		res.send(result);
	})
	.catch(next)

});
