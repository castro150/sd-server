'use strict'

const mongoose = require('mongoose');
const GoogleContacts = require('google-contacts').GoogleContacts;
const properties = require('properties-reader')('./config/application.properties');
const OAuth2Client = require('googleapis').auth.OAuth2;

const logger = require('config/logger.js');
const ContactBox = mongoose.model('ContactBox');

const CLIENT_ID = properties.get('google.contacts.client.id');
const CLIENT_SECRET = properties.get('google.contacts.client.secret');
const REDIRECT_URL = properties.get('google.contacts.redirect.url');
const mainEmail = properties.get('google.contacts.main.email');

// TODO mover lógicas para o google service e testar ele
let oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

exports.registerContactBox = function(email, googleTokens, callback) {
	let newBox = new ContactBox({
		email: email,
		tokens: googleTokens
	});

	newBox.save(function(err) {
		if (err) {
			return callback(err);
		}

		logger.debug('New contact box registered for email: ' + newBox.email);
		return callback(null, newBox);
	});
};

exports.watchMainEmail = function() {
	if (!mainEmail) {
		logger.debug('Missing google.contacts.main.email property.');
		return;
	}

	ContactBox.findOne({
		email: mainEmail
	}).exec(function(err, mainBox) {
		if (err) {
			logger.debug('Error to get main email box.');
			logger.debug(err);
			return;
		}
		if (!mainBox) {
			logger.debug(mainEmail + ' (main email) not registered.');
			return;
		}

		getContacts(mainBox, function(err, contacts) {
			if (err) {
				logger.debug('Error to get contacts from google.');
				logger.debug(err);
				return;
			}

			logger.debug(contacts);
		});
	});
};

let getContacts = function(contactBox, callback) {
	var now = new Date();
	if (now.getTime() >= contactBox.tokens.expiry_date) {
		refreshToken(contactBox, function(err, refreshedContactBox) {
			if (err) {
				return callback(err);
			}

			return getContacts(refreshedContactBox, callback);
		});
	} else {
		let contactsApi = new GoogleContacts({
			consumerKey: CLIENT_ID,
			consumerSecret: CLIENT_SECRET,
			token: contactBox.tokens.access_token,
			refreshToken: contactBox.tokens.refresh_token
		});

		contactsApi.getContacts(function(err, contacts) {
			if (err) {
				return callback(err);
			}

			return callback(null, contacts);
		});
	}
};

let refreshToken = function(contactBox, callback) {
	oauth2Client.setCredentials(contactBox.tokens);
	oauth2Client.refreshAccessToken(function(err, newTokens) {
		if (err) {
			return callback(err);
		}

		ContactBox.findOneAndUpdate({
			email: contactBox.email
		}, {
			$set: {
				tokens: newTokens
			}
		}, {
			new: true
		}, function(err, updatedContactBox) {
			if (err) {
				return callback(err);
			}

			return callback(null, updatedContactBox);
		});
	});
};
