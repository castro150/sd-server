const sinon = require('sinon');
const http_mocks = require('node-mocks-http');

const passport = require('passport');

const SecurityService = require('services/security.js');
const logger = require('config/logger.js');
const router = require('routes/security.js');

let buildRequest = function(method, url, needAuthorization) {
	let token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1OGJkYjJlNTQ4MzAyYTE0MDM2NWQ4YTEiLCJ1c2VybmFtZSI6ImFkbWluIiwiZXhwIjo3MjY3ODU5MDM5LCJpYXQiOjE0OTQ2MTEwMzl9.9_TRSXWdII-GFTJCZlPB9Hs0j15VRyEYGAlI1JiGRQs';
	let request = {};
	request.method = method;
	request.url = url;
	if (needAuthorization) {
		request.headers = {};
		request.headers.Authorization = 'Bearer ' + token;
	}

	return http_mocks.createRequest(request);
};

let buildResponse = function() {
	return http_mocks.createResponse({
		eventEmitter: require('events').EventEmitter
	});
};

describe('Security Routes', function() {
	let request;
	let response;
	let sandbox;

	beforeEach(function() {
		sandbox = sinon.sandbox.create();
	});

	afterEach(function() {
		sandbox.restore();
	});

	describe('Register new user', function() {
		beforeEach(function() {
			request = buildRequest('POST', '/register');
			response = buildResponse();
		});

		it('register new user with success', function(done) {
			let token = '1234567';
			let user = {
				username: 'user',
				password: 'pwd',
				generateJWT: sinon.stub().returns(token)
			};
			request.body.username = user.username;
			request.body.password = user.password;
			let registerStub = sandbox.stub(SecurityService, 'register').yields(null, user);

			response.on('end', function() {
				let data = JSON.parse(response._getData());

				assert(registerStub.calledWith(user.username, user.password));
				assert.equal(response.statusCode, 200);
				assert.equal(data.token, token);

				done();
			});

			router.handle(request, response);
		});

		it('error while registering new user without username', function(done) {
			request.body.username = null;
			request.body.password = 'pwd';

			response.on('end', function() {
				done(new Error('Uncatched error'));
			});

			router.handle(request, response, function(err) {
				assert.equal(err.status, 400);
				assert.equal(err.message, 'Register: not all fields filled');
				assert.equal(err.name, 'security.login.fill.all.fields');

				done();
			});
		});

		it('error while registering new user without password', function(done) {
			request.body.username = 'user';
			request.body.password = null;

			response.on('end', function() {
				done(new Error('Uncatched error'));
			});

			router.handle(request, response, function(err) {
				assert.equal(err.status, 400);
				assert.equal(err.message, 'Register: not all fields filled');
				assert.equal(err.name, 'security.login.fill.all.fields');

				done();
			});
		});

		it('error while registering new user without username and password', function(done) {
			request.body.username = null;
			request.body.password = null;

			response.on('end', function() {
				done(new Error('Uncatched error'));
			});

			router.handle(request, response, function(err) {
				assert.equal(err.status, 400);
				assert.equal(err.message, 'Register: not all fields filled');
				assert.equal(err.name, 'security.login.fill.all.fields');

				done();
			});
		});

		it('generic error while registering new user', function(done) {
			let genericError = 'internal server error';
			request.body.username = 'user';
			request.body.password = 'pwd';
			sandbox.stub(SecurityService, 'register').yields(genericError);

			response.on('end', function() {
				done(new Error('Uncatched error'));
			});

			router.handle(request, response, function(err) {
				assert.equal(err, genericError);

				done();
			});
		});
	});

	describe('Login user', function() {
		beforeEach(function() {
			request = buildRequest('POST', '/login');
			response = buildResponse();
		});

		it('login user with success', function(done) {
			let token = '1234567';
			let user = {
				username: 'user',
				password: 'pwd',
				generateJWT: sinon.stub().returns(token)
			};
			request.body.username = user.username;
			request.body.password = user.password;
			let loginStub = sandbox.stub(passport, 'authenticate').yields(null, user).returns(sinon.stub());
			let loggerStub = sandbox.stub(logger, 'debug');

			response.on('end', function() {
				let data = JSON.parse(response._getData());

				assert(loginStub.calledWith('local'));
				assert(loggerStub.calledWith(user.username + ' loged in.'));
				assert.equal(response.statusCode, 200);
				assert.equal(data.token, token);

				done();
			});

			router.handle(request, response);
		});

		it('error while login user without username', function(done) {
			request.body.username = null;
			request.body.password = 'pwd';

			response.on('end', function() {
				done(new Error('Uncatched error'));
			});

			router.handle(request, response, function(err) {
				assert.equal(err.status, 400);
				assert.equal(err.message, 'Login: not all fields filled');
				assert.equal(err.name, 'security.login.fill.all.fields');

				done();
			});
		});

		it('error while login user without password', function(done) {
			request.body.username = 'user';
			request.body.password = null;

			response.on('end', function() {
				done(new Error('Uncatched error'));
			});

			router.handle(request, response, function(err) {
				assert.equal(err.status, 400);
				assert.equal(err.message, 'Login: not all fields filled');
				assert.equal(err.name, 'security.login.fill.all.fields');

				done();
			});
		});

		it('error while login user without username and password', function(done) {
			request.body.username = null;
			request.body.password = null;

			response.on('end', function() {
				done(new Error('Uncatched error'));
			});

			router.handle(request, response, function(err) {
				assert.equal(err.status, 400);
				assert.equal(err.message, 'Login: not all fields filled');
				assert.equal(err.name, 'security.login.fill.all.fields');

				done();
			});
		});

		it('generic error while login user', function(done) {
			let genericError = 'internal server error';
			request.body.username = 'user';
			request.body.password = 'pwd';
			sandbox.stub(passport, 'authenticate').yields(genericError).returns(sinon.stub());

			response.on('end', function() {
				done(new Error('Uncatched error'));
			});

			router.handle(request, response, function(err) {
				assert.equal(err, genericError);

				done();
			});
		});

		it('authentication error while login user', function(done) {
			let authenticationError = 'authentication error';
			request.body.username = 'user';
			request.body.password = 'pwd';
			let loginStub = sandbox.stub(passport, 'authenticate').yields(null, null, {
				message: authenticationError
			}).returns(sinon.stub());
			let loggerStub = sandbox.stub(logger, 'warn');

			response.on('end', function() {
				let data = JSON.parse(response._getData());

				assert(loginStub.calledWith('local'));
				assert(loggerStub.calledWith('Failed to login user: ' + authenticationError));
				assert.equal(response.statusCode, 401);
				assert.equal(data.message, authenticationError);

				done();
			});

			router.handle(request, response);
		});
	});

	describe('Renew token', function() {
		beforeEach(function() {
			request = buildRequest('POST', '/token', true);
			response = buildResponse();
		});

		it('renew token with success', function(done) {
			let newToken = '7654321';
			request.body.token = '1234567';
			let registerStub = sandbox.stub(SecurityService, 'renewToken').yields(null, newToken);

			response.on('end', function() {
				let data = JSON.parse(response._getData());

				assert(registerStub.calledWith('1234567'));
				assert.equal(response.statusCode, 200);
				assert.equal(data.token, newToken);

				done();
			});

			router.handle(request, response);
		});

		it('generic error while renewing token', function(done) {
			let genericError = 'internal server error';
			request.body.token = '1234567';
			sandbox.stub(SecurityService, 'renewToken').yields(genericError);

			response.on('end', function() {
				done(new Error('Uncatched error'));
			});

			router.handle(request, response, function(err) {
				assert.equal(err, genericError);

				done();
			});
		});
	});
});
