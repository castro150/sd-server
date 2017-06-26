'use strict'

const mongoose = require('mongoose');

const msg = require('properties-reader')('./config/messages.properties');
const logger = require('config/logger.js');
const Customer = mongoose.model('Customer');
const CustomerStatus = require('models/CustomerStatus.js');

let activeNumberExistsMsg = msg.get('customer.create.active.number.exists');

exports.create = function(customerProperties, callback) {
	let newCustomer = new Customer(customerProperties);

	validateExistisActiveNumber(newCustomer, function(err) {
		if (err) {
			return callback(err);
		}

		newCustomer.save(function(err) {
			if (err) {
				return callback(err);
			}

			logger.debug('New customer created: ' + newCustomer.number + ' - ' + newCustomer.name);
			return callback(null, newCustomer);
		});
	});
};

exports.findAllActive = function(callback) {
	let query = Customer.find({
		status: CustomerStatus.ACTIVE
	}).sort({
		number: 1
	}).select({
		number: 1,
		alterNumber: 1,
		name: 1,
		type: 1,
		cpf: 1,
		cnpj: 1
	});

	logger.debug('Finding all active customers');
	query.exec(function(err, customers) {
		if (err) {
			return callback(err);
		}

		logger.debug(customers.length + ' active customers found');
		return callback(null, customers);
	});
};

exports.findById = function(id, callback) {
	let query = Customer.findById(id);

	logger.debug('Finding customer with id ' + id);
	query.exec(function(err, customer) {
		if (err) {
			return callback(err);
		}

		if (customer) logger.debug('User found for id ' + id);
		else logger.debug('User not found for id ' + id);
		return callback(null, customer);
	});
};

exports.update = function(id, customer, callback) {
	validateExistisActiveNumber(customer, function(err) {
		if (err) {
			return callback(err);
		}

		logger.debug('Updating customer with id ' + id);
		Customer.findByIdAndUpdate(id, {
			$set: customer
		}, {
			new: true
		}, function(err, customer) {
			if (err) {
				return callback(err);
			}

			logger.debug('Customer with id ' + id + ' updated');
			callback(null, customer);
		});
	});
};

let validateExistisActiveNumber = function(checkCustomer, callback) {
	let query = Customer.findOne({
		number: checkCustomer.number,
		status: CustomerStatus.ACTIVE
	});

	query.exec(function(err, customer) {
		if (err) {
			return callback(err);
		}
		if (customer !== null && checkCustomer._id.toString() !== customer._id.toString()) {
			return callback(createError(activeNumberExistsMsg, 'Customer number ' + customer.number + ' in use for active customer', 400));
		}

		return callback(null);
	});
};

let createError = function(name, msg, status) {
	let err = new Error(msg);
	err.name = name;
	err.status = status;
	return err;
};
