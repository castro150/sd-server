const sinon = require('sinon');

const mongoose = require('mongoose');

const logger = require('config/logger.js');
const CustomerStatus = require('models/CustomerStatus.js');
const Customer = mongoose.model('Customer');
const CustomerService = require('services/customer.js');
const factories = require('specs/helpers/factories').customers;

describe('Customer Service', function() {
	let sandbox;

	beforeEach(function() {
		sandbox = sinon.sandbox.create();
	});

	afterEach(function() {
		sandbox.restore();
	});

	describe('create customer', function() {
		it('create new customer with success', function(done) {
			let customerProperties = factories.validCustomer;

			let loggerStub = sandbox.stub(logger, 'debug');
			let findCustomerStub = sandbox.stub(Customer, 'find').returns({
				exec: sandbox.stub().yields(null, [])
			});
			sandbox.stub(Customer.prototype, 'save').yields(null);

			CustomerService.create(customerProperties, function(err, savedCustomer) {
				assert(findCustomerStub.calledWith({
					number: customerProperties.number,
					status: CustomerStatus.ACTIVE
				}));
				assert(loggerStub.calledWith('New customer created: ' + customerProperties.number + ' - ' + customerProperties.name));

				assert.isNotNull(savedCustomer);
				assert.equal(savedCustomer.number, customerProperties.number);
				assert.equal(savedCustomer.name, customerProperties.name);

				done();
			});
		});

		it('error creating customer with existing number', function(done) {
			let customerProperties = factories.validCustomer;

			let loggerStub = sandbox.stub(logger, 'debug');
			let findCustomerStub = sandbox.stub(Customer, 'find').returns({
				exec: sandbox.stub().yields(null, [{}])
			});

			CustomerService.create(customerProperties, function(err, savedCustomer) {
				assert(findCustomerStub.calledWith({
					number: customerProperties.number,
					status: CustomerStatus.ACTIVE
				}));
				assert.isFalse(loggerStub.called);

				assert.isUndefined(savedCustomer);
				assert.isNotNull(err);
				assert.equal(err.name, 'customer.create.active.number.exists');
				assert.equal(err.status, 400);
				assert.equal(err.message, 'Create Customer: number ' + customerProperties.number + ' in use for active customer');

				done();
			});
		});

		it('error to execute query while creating customer', function(done) {
			let queryError = 'query error'
			let customerProperties = factories.validCustomer;

			let loggerStub = sandbox.stub(logger, 'debug');
			let findCustomerStub = sandbox.stub(Customer, 'find').returns({
				exec: sandbox.stub().yields(queryError)
			});

			CustomerService.create(customerProperties, function(err, savedCustomer) {
				assert(findCustomerStub.calledWith({
					number: customerProperties.number,
					status: CustomerStatus.ACTIVE
				}));
				assert.isFalse(loggerStub.called);

				assert.isUndefined(savedCustomer);
				assert.isNotNull(err);
				assert.equal(err, queryError);

				done();
			});
		});

		it('error to save customer while creating customer', function(done) {
			let saveError = 'save error'
			let customerProperties = factories.validCustomer;

			let loggerStub = sandbox.stub(logger, 'debug');
			let findCustomerStub = sandbox.stub(Customer, 'find').returns({
				exec: sandbox.stub().yields(null, [])
			});
			sandbox.stub(Customer.prototype, 'save').yields(saveError);

			CustomerService.create(customerProperties, function(err, savedCustomer) {
				assert(findCustomerStub.calledWith({
					number: customerProperties.number,
					status: CustomerStatus.ACTIVE
				}));
				assert.isFalse(loggerStub.called);

				assert.isUndefined(savedCustomer);
				assert.isNotNull(err);
				assert.equal(err, saveError);

				done();
			});
		});
	});

	describe('find all active customers', function() {
		it('find all active customers with success', function(done) {
			let validCustomer = factories.validCustomer;

			let loggerStub = sandbox.stub(logger, 'debug');
			let findCustomerStub = sandbox.stub(Customer, 'find').returns({
				sort: function() {
					return this;
				},
				select: function() {
					return this;
				},
				exec: sandbox.stub().yields(null, [validCustomer])
			});

			CustomerService.findAllActive(function(err, customers) {
				assert(findCustomerStub.calledWith({
					status: CustomerStatus.ACTIVE
				}));
				assert(loggerStub.calledWith('Finding all active customers'));
				assert(loggerStub.calledWith('1 active customers found'));

				assert.isNotNull(customers);
				assert.equal(customers.length, 1);
				assert.equal(customers[0].number, validCustomer.number);
				assert.equal(customers[0].name, validCustomer.name);

				done();
			});
		});

		it('error to execute query while finding all active customers', function(done) {
			let queryError = 'query error'
			let validCustomer = factories.validCustomer;

			let loggerStub = sandbox.stub(logger, 'debug');
			let findCustomerStub = sandbox.stub(Customer, 'find').returns({
				sort: function() {
					return this;
				},
				select: function() {
					return this;
				},
				exec: sandbox.stub().yields(queryError)
			});

			CustomerService.findAllActive(function(err, customers) {
				assert(findCustomerStub.calledWith({
					status: CustomerStatus.ACTIVE
				}));
				assert(loggerStub.calledWith('Finding all active customers'));

				assert.isUndefined(customers);
				assert.equal(err, queryError);

				done();
			});
		});
	});

	describe('find customer by id', function() {
		it('find customer by id with success', function(done) {
			let id = '1234567';
			let validCustomer = factories.validCustomer;

			let loggerStub = sandbox.stub(logger, 'debug');
			let findByIdStub = sandbox.stub(Customer, 'findById').returns({
				exec: sandbox.stub().yields(null, validCustomer)
			});

			CustomerService.findById(id, function(err, customer) {
				assert(findByIdStub.calledWith(id));
				assert(loggerStub.calledWith('User found for id ' + id));

				assert.isNotNull(customer);
				assert.equal(customer.number, validCustomer.number);
				assert.equal(customer.name, validCustomer.name);

				done();
			});
		});

		it('customer not found while finding by id', function(done) {
			let id = '1234567';

			let loggerStub = sandbox.stub(logger, 'debug');
			let findByIdStub = sandbox.stub(Customer, 'findById').returns({
				exec: sandbox.stub().yields(null)
			});

			CustomerService.findById(id, function(err, customer) {
				assert(findByIdStub.calledWith(id));
				assert(loggerStub.calledWith('User not found for id ' + id));

				assert.isUndefined(customer);

				done();
			});
		});

		it('error to execute query while finding by id', function(done) {
			let id = '1234567';
			let queryError = 'query error'

			let loggerStub = sandbox.stub(logger, 'debug');
			let findByIdStub = sandbox.stub(Customer, 'findById').returns({
				exec: sandbox.stub().yields(queryError)
			});

			CustomerService.findById(id, function(err, customers) {
				assert(findByIdStub.calledWith(id));
				assert(loggerStub.calledWith('Finding customer with id ' + id));

				assert.isUndefined(customers);
				assert.equal(err, queryError);

				done();
			});
		});
	});

	describe('update customer', function() {
		it('update customer with success', function(done) {
			let id = '1234567';
			let validCustomer = factories.validCustomer;

			let loggerStub = sandbox.stub(logger, 'debug');
			let updateCustomerStub = sandbox.stub(Customer, 'findByIdAndUpdate').yields(null, validCustomer);

			CustomerService.update(id, validCustomer, function(err, updatedCustomer) {
				assert(loggerStub.calledWith('Updating customer with id ' + id));

				assert.isNotNull(updatedCustomer);
				assert.equal(updatedCustomer.number, validCustomer.number);
				assert.equal(updatedCustomer.name, validCustomer.name);

				done();
			});
		});

		it('error to execute query while updating customer', function(done) {
			let id = '1234567';
			let queryError = 'query error'

			let loggerStub = sandbox.stub(logger, 'debug');
			let updateCustomerStub = sandbox.stub(Customer, 'findByIdAndUpdate').yields(queryError);

			CustomerService.update(id, {}, function(err, updatedCustomer) {
				assert(loggerStub.calledWith('Updating customer with id ' + id));

				assert.isUndefined(updatedCustomer);
				assert.equal(err, queryError);

				done();
			});
		});
	});
});
