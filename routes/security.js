var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var passport = require('passport');
var jwt = require('express-jwt');

var properties = require('properties-reader')('./config/application.properties');
var msg = require('properties-reader')('./config/messages.properties');
var SecurityService = require('services/security.js');

// userProperty defines what propertie will receive the token on 'req'
var auth = jwt({ secret: properties.get('jwt.secret'), userProperty: 'payload' });

var fillAllFields = msg.get('security.login.fill.all.fields');

router.post('/register', function(req, res, next) {
  if (!req.body.username || !req.body.password) {
    var err = new Error(fillAllFields);
    err.status = 400;
    return next(err);
  }

  SecurityService.register(req.body.username, req.body.password, function(err, user) {
    if (err) { return next(err); }

    return res.json({ token: user.generateJWT() });
  });
});

router.post('/login', function(req, res, next) {
  if (!req.body.username || !req.body.password) {
    var err = new Error(fillAllFields);
    err.status = 400;
    return next(err);
  }

  passport.authenticate('local', function(err, user, info) {
    if (err) { return next(err); }

    if (user) {
      return res.json({ token: user.generateJWT() });
    } else {
      return res.status(401).json(info);
    }
  })(req, res, next);
});

router.post('/token', auth, function(req, res, next) {
  SecurityService.renewToken(req.body.token, function(err, newToken) {
    if (err) { return next(err); }

    return res.json({ token: newToken });
  });
});

module.exports = router;
