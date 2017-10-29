'use strict';

var should = require('should'),
	app = require('../../server'),
	Session = require('supertest-session'),
	mongoose = require('mongoose'),
	User = mongoose.model('User'),
	config = require('../../config/config'),
	tmpUser = mongoose.model(config.tempUserCollection),
	async = require('async');

/**
 * Globals
 */
var credentials, _User, userSession;

/**
 * Form routes tests
 */
describe('User CRUD tests', function() {
	before(function() {
		// Create user credentials
		credentials = {
			email: 'test732@test.com',
			username: 'test732',
			password: 'password3223'
		};

		//Create a new user
		_User = {
			email: credentials.email,
			username: credentials.username,
			password: credentials.password,
			firstName: 'John',
			lastName: 'Smith'
		};

        //Initialize Session
        userSession = Session(app);
	});

	describe(' > Create, Verify and Activate a User > ', function() {
		this.timeout(5000);

		it('should be able to create and activate a User', function(done) {
			async.waterfall([
			    function(callback) {
			        userSession.post('/auth/signup')
						.send(_User)
						.expect(200)
						.end(function(err) {
							callback(err)
						});
			    },
			    function(callback) {
			        tmpUser.findOne({username: _User.username})
			        	.lean() 
			        	.exec(function (err, user) {
                        should.exist(user);

                        _User.username.should.equal(user.username);
                        _User.firstName.should.equal(user.firstName);
                        _User.lastName.should.equal(user.lastName);
                        callback(err, user.GENERATED_VERIFYING_URL);
                    });
			    },
			    function(activateToken, callback) {
                    userSession.get('/auth/verify/' + activateToken)
                        .expect(200)
                        .end(function(err, res) {
                            (res.text).should.equal('User successfully verified');
                            callback(err);
                        });
			    },
			    function(callback) {
			    	userSession.post('/auth/signin')
			            .send(credentials)
			            .expect('Content-Type', /json/)
			            .expect(200)
			            .end(function(err, res) {			    
			                (res.body.username).should.equal(credentials.username);
			                callback(err);
			            });
			    },
			    function(callback) {
			    	userSession.get('/auth/signout')
	                    .expect(200)
	                    .end(function(err, res) {
	                        (res.text).should.equal('You have successfully logged out.');
	                        callback(err);
	                    });
			    },
			    function(callback) {
			    	User.findOne({ username: _User.username })
			    		.lean()
			    		.exec(function(err, user){
			    			should.exist(user);
			    			callback(err);
			    		});
			    }
			], function (err) {
			    done(err);
			});         
		});

		it('should be able to reset password of a created User with a valid passwordResetToken', function(done) {
			var changedPassword = 'password1234';
			var resetPasswordToken;

			async.waterfall([
			    function(callback) {
			        userSession.post('/auth/forgot')
						.send({ username: _User.username })
						.expect(200)
						.end(function(err) {
							callback(err);
						});
			    },
			    function(callback) {
			        User.findOne({ username: _User.username })
			        	.lean()
			        	.exec(function(err, user){
			        		if(err){
			        			callback(err);
			        		}
			        		callback(null, user.resetPasswordToken)
						});
			    },
			    function(resetPasswordToken, callback) {
			        userSession.get('/auth/reset/' + resetPasswordToken)
						.expect(302)
						.end(function(err) {
							callback(err, resetPasswordToken);
						});
			    },
			    function(resetPasswordToken, callback) {
			    	userSession.post('/auth/reset/' + resetPasswordToken)
			    		.send({
			    			newPassword: changedPassword,
			    			verifyPassword: changedPassword
			    		})
						.expect(200)
						.end(function(err, res) {
							callback(err, resetPasswordToken);
						});
			    },
			    function(resetPasswordToken, callback) {
			    	User.findOne({ username: _User.username })
			    		.exec(function(err, user){
			    			should.exist(user);
			    			user.authenticate(changedPassword).should.be.true();
			    			should.not.exist(user.resetPasswordToken);

			    			callback(err);
			    		});
			    }
			], function (err, result) {
				done(err);
			});
		});

		it('should be not able to reset password of a created User with a invalid passwordResetToken', function(done) {
			var changedPassword = 'password4321';
			var resetPasswordToken = 'thisIsNotAValidToken';

			async.waterfall([
			    function(callback) {
			        userSession.post('/auth/forgot')
						.send({ username: credentials.username })
						.expect(200)
						.end(function(err, res) {
							callback(err);
						});
			    },
			    function(callback) {
			        userSession.get('/auth/reset/' + resetPasswordToken)
						.expect(400)
						.end(function(err) {
							callback(err);
						});
			    },
			    function(callback) {
			    	userSession.post('/auth/reset/' + resetPasswordToken)
			    		.send({
			    			newPassword: changedPassword,
			    			verifyPassword: changedPassword
			    		})
						.expect(400)
						.end(function(err, res) {
							callback(err);
						});
			    },
			    function(callback) {
			    	User.findOne({ username: _User.username })
			    		.exec(function(err, user){
			    			should.exist(user);
			    			user.authenticate(changedPassword).should.be.false();
			    			callback(err);
			    		});
			    }
			], function (err, result) {
				done(err);
			});
		});

	});

	after(function(done) {
		User.remove().exec(function () {
			tmpUser.remove().exec(function(){
				userSession.destroy();
				done();
			});
		});
	});
});
