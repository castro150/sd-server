var express = require('express');
var router = express.Router();

var mongoose = require('mongoose');
var passport = require('passport');
var jwt = require('express-jwt');

var User = mongoose.model('User');

var auth = jwt({ secret: 'SECRET', userProperty: 'payload' });
// TODO é recomendável deixar o secret em uma variável de ambiente
// (igual ao de Users.js), fora da base do código, porque é o segredo
// usado para gerar os tokens. "userProperty" define qual propriedade
// em "req" vai ser colocado os payload do token.

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

  var user = new User();

  user.username = req.body.username;

  user.setPassword(req.body.password);

  user.save(function(err) {
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

module.exports = router;
