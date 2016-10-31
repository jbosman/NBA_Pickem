let db = require('./server/db/_db');
let Team = require( './server/db/models/team');
let NBATeam = require( './server/db/models/nbaTeam');
let NBA_TEAM_INFO_ESPN = require('./server/utilities/NBA-Team-Info.js');

NBATeam.findAll({})
.then( nbaTeams => {
	console.log(nbaTeams)
}).catch(console.error)

