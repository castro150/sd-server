var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var passport = require('passport');
var jwt = require('express-jwt');

var properties = require('properties-reader')('./config/application.properties');
var SecurityService = require('services/security.js');

var User = mongoose.model('User');

// userProperty defines what propertie will receive the token on 'req'
var auth = jwt({ secret: properties.get('jwt.secret'), userProperty: 'payload' });

router.get('/health', function(req, res, next) {
  res.json('Simple-Docfy Server alive!');
});

router.get('/safe', auth, function(req, res, next) {
  res.json('Simple-Docfy Server alive and safe.');
});

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

var jwt = require('jsonwebtoken');
router.post('/token', function(req, res, next) {
  jwt.verify(req.body.token, properties.get('jwt.secret'), function(err, user) {
    if (err) { return next(err); }

    var today = new Date();
    var exp = new Date(today);
    exp.setMinutes(today.getMinutes() + 20);
    user.exp = parseInt(exp.getTime() / 1000);
    var newToken = jwt.sign(user, properties.get('jwt.secret'));

    res.json({ token: newToken });
  });
});

module.exports = router;
