describe('Cookie Factory', function() {

	beforeEach(module('NBA_Pickem_App'));

	let CookieFactory;

	beforeEach('Get factory', inject(function (_CookieFactory_) {
		CookieFactory = _CookieFactory_;
    })); 

    it('Should be an object', () => {
        expect(CookieFactory).to.be.an('object');
    });

    it('Should contain 3 object keys that are tested', function() {
    	let factory_keys = Object.keys(CookieFactory);
    	expect(factory_keys.length).to.eql(3);
    });

    describe('getCookie function', function(){

        let cookie;

        it('Should be a function', function(){
            expect(CookieFactory.getCookie).to.be.an('function');
        })

        it('Should initially return an object', function(){
            cookie = CookieFactory.getCookie();
            expect(cookie).to.be.an('object');
        })

        it('Should initially return an empty object', function(){
            cookie = CookieFactory.getCookie();
            expect(Object.keys(cookie).length).equals(0);
        });
    });

    // I know this is bad practice, but I'm unsure how to reset the 
    // document.cookie at this time. Shouldn't have describe lock orders 
    // depending on each other
    describe('isCookie function prior to running setCookie', function(){
    
        it('Should be a function', function(){
            expect(CookieFactory.isCookie).to.be.an('function');
        })

        it('Should initially return false', function(){
            expect(CookieFactory.isCookie()).equals(false);
        })

    });

    describe('setCookie function', function(){

        let setCookieObj = { email: 'jose@jose.com', password: 'abc123' };
        let getCookieObj = {};

        it('Should be a function', function(){
            expect(CookieFactory.getCookie).to.be.an('function');
        })

        it('Should set email and password on cookie object', function(){
            CookieFactory.setCookie(setCookieObj);
            getCookieObj = CookieFactory.getCookie();
            expect(getCookieObj.email).equals(setCookieObj.email);
            expect(getCookieObj.password).equals(setCookieObj.password);
        })
    });

    describe('isCookie function post running setCookie', function(){
    
        it('Should return true after setCookie has been executed', function(){
            expect(CookieFactory.isCookie()).equals(true);
        })

    });
})