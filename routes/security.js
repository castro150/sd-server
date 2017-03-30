var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var passport = require('passport');
var jwt = require('express-jwt');

var properties = require('properties-reader')('./config/application.properties');
var SecurityService = require('services/security.js');

// userProperty defines what propertie will receive the token on 'req'
var auth = jwt({ secret: properties.get('jwt.secret'), userProperty: 'payload' });

router.post('/register', function(req, res, next) {
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ message: 'Please fill out all fields.' });
  }

  SecurityService.register(req.body.username, req.body.password, function(err, user) {
    if (err) { return next(err); }

    return res.json({ token: user.generateJWT() });
  });
});

router.post('/login', function(req, res, next) {
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ message: 'Please fill out all fields.' });
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
