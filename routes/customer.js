'use strict'

const express = require('express');
const router = express.Router();
const jwt = require('express-jwt');

const properties = require('properties-reader')('./config/application.properties');
const msg = require('properties-reader')('./config/messages.properties');
const CustomerService = require('services/customer.js');

let auth = jwt({
	secret: properties.get('jwt.secret'),
	userProperty: 'payload'
});

let setPropertiesMsg = msg.get('customer.create.set.properties');

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

		let status = customer ? 200 : 204;
		return res.status(status).json(customer);
	});
});

router.put('/:id', auth, function(req, res, next) {
	CustomerService.update(req.params.id, req.body, function(err, customer) {
		if (err) {
			return next(err);
		}

		return res.status(200).json(customer);
	});
});

let createError = function(name, msg, status) {
	let err = new Error(msg);
	err.name = name;
	err.status = status;
	return err;
};

module.exports = router;
