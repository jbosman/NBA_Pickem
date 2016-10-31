let db = require('../db');
let NBA_Team = db.model('nbaTeam');
let NBA_TEAM_INFO_ESPN = require('./NBA-Team-Info.js');
let _ = require('../../node_modules/lodash');

function updateWins(){

    NBA_TEAM_INFO_ESPN( (new Date()).getFullYear() ) // eslint-disable-line new-cap
    .then( teams => {
        teams = _.sortBy(teams, ['name']);

        let creatingNBATeams = teams.map( teamObj => {
                return NBA_Team.update({
                    wins: teamObj.wins
                }, {
                    where: { abbr: teamObj.abbr },
                    returning: true,
                });
        });

        return Promise.all(creatingNBATeams);
    })
    .then( updatedTeams => {
        console.log('Updated teams: ')
        updatedTeams.forEach( teamUpdate => {
            let updatedTeam = teamUpdate[1][0].dataValues;
            console.log('         ', 'wins: ', updatedTeam.wins, ' ', updatedTeam.name );
        })
    })
    .catch(console.error)

}

module.exports = {
    updateWins: updateWins
}
