'use strict'

var mongoose = require('mongoose');
var jwtoken = require('jsonwebtoken');

var properties = require('properties-reader')('./config/application.properties');
var msg = require('properties-reader')('./config/messages.properties');

var User = mongoose.model('User');

var userAlreadyExists = msg.get('security.register.user.already.exists');

exports.register = function(username, password, callback) {
  var user = new User();

  user.username = username;
  user.setPassword(password);

  user.save(function(err) {
    if (err) {
      err.message = err.code === 11000 ? userAlreadyExists : err.message;
      return callback(err);
    }

    return callback(null, user);
  });
};

exports.renewToken = function(oldToken, callback) {
  jwtoken.verify(oldToken, properties.get('jwt.secret'), function(err, user) {
    if (err) { return callback(err); }

    var today = new Date();
    var exp = new Date(today);
    exp.setMinutes(today.getMinutes() + 20);
    user.exp = parseInt(exp.getTime() / 1000);
    var newToken = jwtoken.sign(user, properties.get('jwt.secret'));

    return callback(null, newToken);
  });
};
