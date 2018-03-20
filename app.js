'use strict'

require('app-module-path').addPath(__dirname + '/');

/**
 * External dependencies
 */
const properties = require('properties-reader')('./config/application.properties');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const cors = require('cors');

/**
 * Internal dependencies
 */
require('./models/User');
require('./models/Contact');
require('./models/Customer');
require('./models/ContactBox');
require('./config/passport');
const logger = require('./config/logger');
const index = require('./routes/index');

let app = express();

require('events').EventEmitter.defaultMaxListeners = 200;

app.use(cors());
app.use(require('morgan')('short', {
	'stream': logger.stream
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(passport.initialize());

app.use('/', index);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	let err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handler
app.use(function(err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};
	logger.warn(err.message);

	res.status(err.status || 500);
	res.json({
		name: err.name,
		message: err.message
	});
});

module.exports = app;

mongoose.Promise = global.Promise;
let dbConnection = process.env.MONGODB_URI || properties.get('mongodb.db.uri');
mongoose.connect(dbConnection, { useMongoClient: true });
