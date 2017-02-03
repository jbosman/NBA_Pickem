
describe('NBA League Factory', function() {

	beforeEach(module('NBA_Pickem_App'));

	let NBA_League_Factory;

	beforeEach('Get factory', inject(function (_NBA_League_Factory_) {
		NBA_League_Factory = _NBA_League_Factory_;
    })); 

    it('Should be an object', () => {
        expect(NBA_League_Factory).to.be.an('object');
    });

    it('Should contain 4 object keys that are tested', function() {
    	factory_keys = Object.keys(NBA_League_Factory);
    	expect(factory_keys.length).to.eql(4);
    })

    describe('getNBATeamInfo', function(){
    	
    	let teamInfo;

    	it('Should be a function', function(){
    		expect(NBA_League_Factory.getNBATeamInfo).to.be.an('function');
    	})

    	it('Should initially return an array', function(){
    		teamInfo = NBA_League_Factory.getNBATeamInfo();
    		expect(teamInfo).to.be.an('array');
    	})

    	it('Should initially return an empty array', function(){
    		expect(teamInfo.length).to.eql(0);
    	})

    });

    describe('getNBATeamInfoObj', function(){
    	
    	let teamInfoObj;

    	it('Should be a function', function(){
    		expect(NBA_League_Factory.getNBATeamInfoObj).to.be.an('function');
    	})

    	it('Should initially return an obj', function(){
    		teamInfoObj = NBA_League_Factory.getNBATeamInfoObj();
    		expect(teamInfoObj).to.be.an('object');
    	})

    	it('Should initially return an empty obj', function(){
    		expect(Object.keys(teamInfoObj).length).to.eql(0);
    	})

    });

    // Leaving for later ----
    // Need to learn how to do async tests
    // Or maybe try to do this in the server tests
    // I think you can do $http tests
    // describe('getNBATeamInfoFromESPN Async', function(){


    // });


});

