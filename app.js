'use strict'

require('app-module-path').addPath(__dirname + '/');

/**
 * External dependencies
 */
var properties = require('properties-reader')('./config/application.properties');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var passport = require('passport');

/**
 * Internal dependencies
 */
require('./models/User');
require('./models/Customer');
require('./config/passport');
var logger = require('./config/logger');
var index = require('./routes/index');

var app = express();

app.use(require('morgan')('short', { 'stream': logger.stream }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(passport.initialize());

app.use('/', index);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.json({ message: err.message });
});

module.exports = app;

var dbHost = properties.get('mongodb.db.host');
var dbName = properties.get('mongodb.db.name');
mongoose.connect('mongodb://' + dbHost + '/' + dbName);
