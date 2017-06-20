'use strict'

const mongoose = require('mongoose');
const google = require('googleapis');
const OAuth2Client = google.auth.OAuth2;
const GoogleContacts = require('google-contacts').GoogleContacts;
const properties = require('properties-reader')('./config/application.properties');

const ContactBox = mongoose.model('ContactBox');

const CLIENT_ID = properties.get('google.contacts.client.id');
const CLIENT_SECRET = properties.get('google.contacts.client.secret');
const REDIRECT_URL = properties.get('google.contacts.redirect.url');
const SCOPES = [
	'https://www.googleapis.com/auth/plus.me',
	'https://www.googleapis.com/auth/userinfo.email',
	'https://www.google.com/m8/feeds/contacts/default/full'
];

exports.generateAuthUrl = function() {
	let oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
	return oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES
	});
};

exports.authenticate = function(code, callback) {
	let oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
	oauth2Client.getToken(code, function(err, tokens) {
		if (err) {
			return callback(err);
		}

		oauth2Client.setCredentials(tokens);
		google.plus('v1').people.get({
			userId: 'me',
			auth: oauth2Client
		}, function(err, profile) {
			if (err) {
				return callback(err);
			}

			return callback(null, profile.emails[0].value, tokens);
		});
	});
};

exports.getContacts = function(contactBox, callback) {
	var now = new Date();
	if (now.getTime() >= contactBox.tokens.expiry_date) {
		refreshToken(contactBox, function(err, refreshedContactBox) {
			if (err) {
				return callback(err);
			}

			return exports.getContacts(refreshedContactBox, callback);
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
	let oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
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
