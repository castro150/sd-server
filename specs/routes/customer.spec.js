var sinon = require('sinon');
var http_mocks = require('node-mocks-http');

var CustomerService = require('services/customer.js');
var router = require('routes/customer.js');

var buildRequest = function(method, url) {
	var token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1OGJkYjJlNTQ4MzAyYTE0MDM2NWQ4YTEiLCJ1c2VybmFtZSI6ImFkbWluIiwiZXhwIjo3MjY3ODU5MDM5LCJpYXQiOjE0OTQ2MTEwMzl9.9_TRSXWdII-GFTJCZlPB9Hs0j15VRyEYGAlI1JiGRQs';
	var request = {};
	request.method = method;
	request.url = url;
	request.headers = {};
	request.headers.Authorization = 'Bearer ' + token;

	return http_mocks.createRequest(request);
};

var buildResponse = function() {
	return http_mocks.createResponse({
		eventEmitter: require('events').EventEmitter
	});
};

describe('Customer Routes', function() {
	var request;
	var response;
	var sandbox;

	beforeEach(function() {
		sandbox = sinon.sandbox.create();
	});

	afterEach(function() {
		sandbox.restore();
	});

	describe('POST new customer', function() {
		beforeEach(function() {
			request = buildRequest('POST', '/');
			response = buildResponse();
		});

		it('POST new customer with success', function(done) {
			var validCustomer = {};
			validCustomer.name = 'Master Cars';
			validCustomer.number = 1;
			var createStub = sandbox.stub(CustomerService, 'create').yields(null, validCustomer);

			response.on('end', function() {
				var data = JSON.parse(response._getData());

				assert(createStub.calledWith(request.body));
				assert.equal(response.statusCode, 201);
				assert.equal(data.name, validCustomer.name);
				assert.equal(data.number, validCustomer.number);

				done();
			});

			router.handle(request, response);
		});

		it('empty body error while POST new customer', function(done) {
			request.body = null;

			response.on('end', function() {
				done(new Error('Uncatched error', genericError));
			});

			router.handle(request, response, function(err) {
				assert.equal(err.status, 400);
				assert.equal(err.message, 'Create Customer: no properties');
				assert.equal(err.name, 'customer.create.set.properties');

				done();
			});
		});

		it('generic error while POST new customer', function(done) {
			var genericError = 'internal server error';
			sandbox.stub(CustomerService, 'create').yields(genericError);

			response.on('end', function() {
				done(new Error('Uncatched error', genericError));
			});

			router.handle(request, response, function(err) {
				assert.equal(err, genericError);

				done();
			});
		});
	});

	describe('GET all active customers', function() {
		beforeEach(function() {
			request = buildRequest('GET', '/active');
			response = buildResponse();
		});

		it('GET active customers with success', function(done) {
			var validCustomer = {};
			validCustomer.name = 'Master Cars';
			validCustomer.number = 1;
			sandbox.stub(CustomerService, 'findAllActive').yields(null, [validCustomer]);

			response.on('end', function() {
				var data = JSON.parse(response._getData());

				assert.equal(response.statusCode, 200);
				assert.equal(data.length, 1);
				assert.equal(data[0].name, validCustomer.name);
				assert.equal(data[0].number, validCustomer.number);

				done();
			});

			router.handle(request, response);
		});

		it('generic error while GET active customers', function(done) {
			var genericError = 'internal server error';
			sandbox.stub(CustomerService, 'findAllActive').yields(genericError);

			response.on('end', function() {
				done(new Error('Uncatched error', genericError));
			});

			router.handle(request, response, function(err) {
				assert.equal(err, genericError);

				done();
			});
		});
	});

	describe('GET customer by id', function() {
		beforeEach(function() {
			request = buildRequest('GET', '/1234567');
			response = buildResponse();
		});

		it('GET customer by id with success', function(done) {
			var validCustomer = {};
			validCustomer.name = 'Master Cars';
			validCustomer.number = 1;
			var findStub = sandbox.stub(CustomerService, 'findById').yields(null, validCustomer);

			response.on('end', function() {
				var data = JSON.parse(response._getData());

				assert.equal(response.statusCode, 200);
				assert(findStub.calledWith('1234567'));
				assert.equal(data.name, validCustomer.name);
				assert.equal(data.number, validCustomer.number);

				done();
			});

			router.handle(request, response);
		});

		it('no customer found while GET customer by id', function(done) {
			var findStub = sandbox.stub(CustomerService, 'findById').yields(null, null);

			response.on('end', function() {
				var data = response._getData();

				assert.equal(response.statusCode, 204);
				assert(findStub.calledWith('1234567'));
				assert.equal(data, '');

				done();
			});

			router.handle(request, response);
		});

		it('generic error while GET customer by id', function(done) {
			var genericError = 'internal server error';
			sandbox.stub(CustomerService, 'findById').yields(genericError);

			response.on('end', function() {
				done(new Error('Uncatched error', genericError));
			});

			router.handle(request, response, function(err) {
				assert.equal(err, genericError);

				done();
			});
		});
	});

	describe('PUT customer by id', function() {
		beforeEach(function() {
			request = buildRequest('PUT', '/1234567');
			response = buildResponse();
		});

		it('PUT customer by id with success', function(done) {
			var validCustomer = {};
			validCustomer.name = 'Master Cars';
			validCustomer.number = 1;
			var updateStub = sandbox.stub(CustomerService, 'update').yields(null, validCustomer);

			response.on('end', function() {
				var data = JSON.parse(response._getData());

				assert.equal(response.statusCode, 200);
				assert(updateStub.calledWith('1234567'));
				assert.equal(data.name, validCustomer.name);
				assert.equal(data.number, validCustomer.number);

				done();
			});

			router.handle(request, response);
		});

		it('generic error while PUT customer by id', function(done) {
			var genericError = 'internal server error';
			sandbox.stub(CustomerService, 'update').yields(genericError);

			response.on('end', function() {
				done(new Error('Uncatched error', genericError));
			});

			router.handle(request, response, function(err) {
				assert.equal(err, genericError);

				done();
			});
		});
	});
});
