var sinon = require('sinon');

var mongoose = require('mongoose');
var jwtoken = require('jsonwebtoken');

var properties = require('properties-reader');
var msg = require('properties-reader')('./config/messages.properties');
var logger = require('config/logger.js');
var User = mongoose.model('User');
var SecurityService = require('services/security.js');

describe('Security Service', function() {
	var sandbox;

	beforeEach(function() {
		sandbox = sinon.sandbox.create();
	});

	afterEach(function() {
		sandbox.restore();
	});

	it('register user with success', function(done) {
		var username = 'user';
		var password = 'pwd';

		var loggerStub = sandbox.stub(logger, 'debug');
		sandbox.stub(User.prototype, 'save').yields(null);

		SecurityService.register(username, password, function(err, user) {
			assert(loggerStub.calledWith('New user registered: ' + username));

			assert.isNull(err);
			assert.isNotNull(user);
			assert.equal(user.username, username);
			assert.isNotNull(user.salt)
			assert.isNotNull(user.hash);

			done();
		});
	});

	it('error while registering existing user', function(done) {
		var username = 'user';
		var password = 'pwd';

		sandbox.stub(User.prototype, 'save').yields({
			code: 11000
		});

		SecurityService.register(username, password, function(err, user) {
			assert.isUndefined(user);
			assert.isNotNull(err);
			assert.equal(err.code, 11000);
			assert.equal(err.name, 'security.register.user.already.exists');

			done();
		});
	});

	it('generic error while registering user', function(done) {
		var username = 'user';
		var password = 'pwd';

		sandbox.stub(User.prototype, 'save').yields({
			name: 'generic.error',
			code: 500
		});

		SecurityService.register(username, password, function(err, user) {
			assert.isUndefined(user);
			assert.isNotNull(err);
			assert.equal(err.code, 500);
			assert.equal(err.name, 'generic.error');

			done();
		});
	});

	// TODO
	it('renew token with success', function(done) {
		var oldToken = '1234567';
		var user = {};
		user.username = 'user';
		user.password = 'pwd';

		var loggerStub = sandbox.stub(logger, 'debug');

		SecurityService.renewToken(oldToken, function(err, newToken) {
			// assert(loggerStub.calledWith('New token for user: ' + user.username));
			// 
			// assert.isNull(err);
			// assert.isNotNull(user);
			// assert.equal(user.username, username);
			// assert.isNotNull(user.salt)
			// assert.isNotNull(user.hash);

			done();
		});
	});
});
