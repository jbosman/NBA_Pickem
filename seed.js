var chalk = require('chalk');
let db = require('./server/db');
let User = db.model('user');
let NBA_Team = db.model('nbaTeam');
let League = db.model('league');
let Team = db.model('team');
let Promise = require('sequelize').Promise;
let _ = require('lodash')
let NBA_TEAM_INFO_ESPN = require('./server/utilities/NBA-Team-Info.js');

let brettTeams = ['GS', 'MIN', 'HOU', 'ORL', 'DAL', 'BKN'];
let lukeTeams =  ['CLE', 'POR', 'IND', 'WSH', 'MEM', 'PHI'];
let joeyTeams =  ['SA', 'OKC', 'CHA', 'CHI', 'NO', 'MIA'];
let kyleTeams =  ['LAC', 'UTAH', 'DET', 'NY', 'MIL', 'PHX'];
let markTeams =  ['TOR', 'BOS', 'ATL', 'DEN', 'SAC', 'LAL'];

let teamKey = {
    'GS': 1, 'MIN': 1, 'HOU': 1, 'ORL': 1, 'DAL': 1, 'BKN': 1,
    'CLE': 2, 'POR': 2, 'IND': 2, 'WSH': 2, 'MEM': 2, 'PHI': 2,
    'SA': 3, 'OKC': 3, 'CHA': 3, 'CHI': 3, 'NO': 3, 'MIA': 3,
    'LAC': 4, 'UTAH': 4, 'DET': 4, 'NY': 4, 'MIL': 4, 'PHX': 4,
    'TOR': 5, 'BOS': 5, 'ATL': 5, 'DEN': 5, 'SAC': 5, 'LAL': 5
};


function seedUsers(){

    let users = [
        {
            email: 'brett@brett.com',
            password: 'brett'
        },
        {
            email: 'luke@luke.com',
            password: 'luke'
        },
        {
            email: 'joey@joey.com',
            password: 'joey'
        },
        {
            email: 'kyle@kyle.com',
            password: 'kyle'
        },
        {
            email: 'mark@mark.com',
            password: 'mark'
        }
    ];

    let creatingUsers = users.map( userObj => User.create(userObj) );

    return Promise.all(creatingUsers);

};

function seedNBATeams(){

    return NBA_TEAM_INFO_ESPN( (new Date()).getFullYear() )
        .then( teams => {
            teams = _.sortBy(teams, ['name']);

            let creatingNBATeams = teams.map( teamObj => NBA_Team.create(teamObj) );

            return Promise.all(creatingNBATeams); 
        })
}

function seedLeague(){
    return League.create({name: "Bosmans Shed 2016"});
}

function seedTeams(){
    let creatingTeams = createdUsers.map( user => { 
        let teamName = user.email.split('@')[0] + "'s team";
        return Team.create({name: teamName, leagueId: createdLeague.id, userId: user.id})
    })

    return Promise.all(creatingTeams);
}

function draftForTeams(){
    let drafting = createdNBATeams.map( nba_team => {
        return nba_team.addTeam( teamKey[nba_team.abbr] );
    })

    return Promise.all(drafting);
}

let createdLeague;
let createdUsers;
let createdNBATeams;
let createdTeams;

db.sync({ force: true })
    .then( () => seedUsers() )
    .then( (users) => {
        createdUsers = users;
    })
    .then( () => seedNBATeams() )
    .then( nbaTeams => {
        createdNBATeams = nbaTeams;
    })
    .then( () => seedLeague() )
    .then( league => {
         createdLeague = league;
    })
    .then( () => seedTeams() )
    .then( teams => {
        createdTeams = teams;
    })
    .then( () => draftForTeams() )
    .then( () => {
        console.log(chalk.green('Seed successful!'));
        process.exit(0);
    })
    .catch( (err) => {
        console.error(err);
        process.exit(1);
    });