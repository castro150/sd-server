const sinon = require('sinon');

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const User = mongoose.model('User');

describe('User Model', function() {
	let sandbox;

	beforeEach(function() {
		sandbox = sinon.sandbox.create();
	});

	afterEach(function() {
		sandbox.restore();
	});

	describe('set password', function() {
		it('set password with success', function(done) {
			let user = new User();

			assert.isUndefined(user.salt);
			assert.isUndefined(user.hash);

			user.setPassword('pwd');

			assert.isNotNull(user.salt);
			assert.isNotNull(user.hash);

			done();
		});
	});

	describe('valid password', function() {
		it('validate correct password with success', function(done) {
			let user = new User();
			user.setPassword('pwd');

			assert.isTrue(user.validPassword('pwd'));

			done();
		});

		it('validate incorrect password with success', function(done) {
			let user = new User();
			user.setPassword('pwd');

			assert.isFalse(user.validPassword('incorrect-pwd'));

			done();
		});
	});

	describe('generate JWT', function() {
		it('generate JWT with success', function(done) {
			let clock = sinon.useFakeTimers();

			let renewedToken = '1234567';
			let signStub = sandbox.stub(jwt, 'sign').returns(renewedToken);

			let user = new User();
			user.username = 'user';
			let newToken = user.generateJWT();

			let capturedUser = signStub.getCall(0).args[0];
			let expectedExp = new Date();
			expectedExp.setMinutes(new Date().getMinutes() + 1000);

			assert.equal(newToken, renewedToken);
			assert.equal(capturedUser._id, user._id);
			assert.equal(capturedUser.username, user.username);
			assert.equal(capturedUser.exp, parseInt(expectedExp.getTime() / 1000));

			clock.restore();
			done();
		});
	});
});
