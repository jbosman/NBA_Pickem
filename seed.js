var chalk = require('chalk');
let db = require('./server/db');
let User = db.model('user');
let NBA_Team = db.model('nbaTeam');
let League = db.model('league');
let Team = db.model('team');
let Promise = require('sequelize').Promise;
let _ = require('lodash')
let NBA_TEAM_INFO_ESPN = require('./server/utilities/NBA-Team-Info.js');

function seedUsers(){

    let users = [
        {
            email: 'joey@joey.com',
            password: 'joey'
        },
        {
            email: 'mark@mark.com',
            password: 'mark'
        },
        {
            email: 'brett@brett.com',
            password: 'brett'
        },
        {
            email: 'luke@luke.com',
            password: 'luke'
        },
        {
            email: 'kyle@kyle.com',
            password: 'kyle'
        }
    ];

    let creatingUsers = users.map( userObj => User.create(userObj) );

    return Promise.all(creatingUsers);

};

function seedNBATeams(teams){

    return NBA_TEAM_INFO_ESPN( (new Date()).getFullYear() )
        .then( teams => {
            teams = _.sortBy(teams, ['name']);

            let creatingNBATeams = teams.map( teamObj => NBA_Team.create(teamObj) );

            return Promise.all(creatingNBATeams); 
        })
}

function seedLeague(){
    return League.create();
}

function seedTeams(){
    let creatingTeams = createdUsers.map( user => { 
        let teamName = user.email.split('@')[0] + "'s Team";
        return Team.create({name: teamName, leagueId: createdLeague.id, userId: user.id})
    })

    return Promise.all(creatingTeams);
}

function draftForTeams(){
    let drafting = createdNBATeams.map( nba_team => {
        return nba_team.addTeam( [_.random(1,5)] );
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