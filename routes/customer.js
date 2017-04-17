'use strict'

var express = require('express');
var router = express.Router();
var jwt = require('express-jwt');

var properties = require('properties-reader')('./config/application.properties');
var msg = require('properties-reader')('./config/messages.properties');
var CustomerService = require('services/customer.js');

var auth = jwt({
	secret: properties.get('jwt.secret'),
	userProperty: 'payload'
});

var setPropertiesMsg = msg.get('customer.create.set.properties');

router.post('/', auth, function(req, res, next) {
	if (!req.body) {
		return next(createError(setPropertiesMsg, 'Create Customer: no properties', 400));
	}

	CustomerService.create(req.body, function(err, newCustomer) {
		if (err) {
			return next(err);
		}

		return res.status(201).json(newCustomer);
	});
});

router.get('/active', auth, function(req, res, next) {
	CustomerService.findAllActive(function(err, customers) {
		if (err) {
			return next(err);
		}

		return res.status(200).json(customers);
	});
});

router.get('/:id', auth, function(req, res, next) {
	CustomerService.findById(req.params.id, function(err, customer) {
		if (err) {
			return next(err);
		}

		var status = customer ? 200 : 204;
		return res.status(status).json(customer);
	});
});

var createError = function(name, msg, status) {
	var err = new Error(msg);
	err.name = name;
	err.status = status;
	return err;
};

module.exports = router;
