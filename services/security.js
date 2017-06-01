'use strict'

const mongoose = require('mongoose');
const jwtoken = require('jsonwebtoken');

const properties = require('properties-reader')('./config/application.properties');
const msg = require('properties-reader')('./config/messages.properties');
const logger = require('config/logger.js');

const User = mongoose.model('User');

let userAlreadyExists = msg.get('security.register.user.already.exists');

exports.register = function(username, password, callback) {
	let user = new User();

	user.username = username;
	user.setPassword(password);

	user.save(function(err) {
		if (err) {
			err.name = err.code === 11000 ? userAlreadyExists : err.name;
			return callback(err);
		}

		logger.debug('New user registered: ' + user.username);
		return callback(null, user);
	});
};

exports.renewToken = function(oldToken, callback) {
	jwtoken.verify(oldToken, properties.get('jwt.secret'), function(err, user) {
		if (err) {
			return callback(err);
		}

		let today = new Date();
		let exp = new Date(today);
		exp.setMinutes(today.getMinutes() + 1000);
		user.exp = parseInt(exp.getTime() / 1000);
		let newToken = jwtoken.sign(user, properties.get('jwt.secret'));
		logger.debug('New token for user: ' + user.username);

		return callback(null, newToken);
	});
};
