var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var sha1 = require('sha1');
var bcrypt = require('bcrypt');
var passport = require('passport');
var GitHubStrategy = require('passport-github2').Strategy;


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GitHubStrategy({
  clientID: 'cffcc7effb04ee247ed8',
  clientSecret: '265d40eea1c890a3ada818d8bf4e4ea2cf4da7bd',
  callbackURL: 'http://127.0.0.1:4568/callback'
}, function(accessToken, refreshToken, profile, done) {

  // console.log('accessToken', accessToken, 'refreshToken', refreshToken, 'profile', profile);

  process.nextTick(function() {
    console.log('process next tick');
    done(null, profile);
  });
}));

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: 'superSecret',
  resave: false,
  saveUninitialized: false,
  cookie: {}
}));

app.use(passport.initialize());
app.use(passport.session());

var restrict = function (req, res, next) {
  // console.log('HELLLLLLLLO USER', req.user);
  // console.log('rq.isauth', req.isAuthenticated());
  if (req.user) {
    return next();
  }
  console.log('redirecting to login');
  res.redirect(301, '/login');
};

app.get('/auth/github', passport.authenticate('github', { scope: [ 'user:email' ] }), function(req, res) {
  // redirect user to github, so this callback will not be called
});

app.get('/callback', passport.authenticate('github', {failureRedirect: '/auth/github'}), function (req, res) {
  // , Object.keys(req), req.user);
  // req.session.name = req.user.username;
  // console.log('session name', passport);
  // console.log('response', res.body);
  res.redirect('/');
});

app.get('/', restrict,
function(req, res) {
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', restrict, 
function(req, res) {
  // Users.reset().fetch().then(function(users) {
  //   // console.log(users.models);
  //   var userId;
  //   users.models.forEach(function(user) {
  //     if (user.attributes.username === req.session.name) {
  //       userId = user.attributes.id;
  //     }
  //   });
  Links.reset().fetch().then(function(links) {
    // console.log('links', links.models);
    res.status(200).send(links.models);
  });
  // });
  // Users.where('id', 5).then(function(user) {
    // console.log('user', user.attributes);
  // });
});

app.post('/links', restrict,
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }
        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/login',
function(req, res) {
  res.render('login');
});

app.get('/signup', function (req, res) {
  res.render('signup');
});
/********************* HASHED PASSWORDS ***************************/
app.post('/signup', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var salt = bcrypt.genSaltSync(10);
  var hash = bcrypt.hashSync(password, salt);

  new User({ username: username }).fetch().then(function(found) {
    if (found) {
      console.log('Username already exists.');
      res.redirect(201, '/login');
    } else {
      // console.log('salt', salt);
      Users.create({
        username: username,
        password: hash,
        salt: salt
      })
      .then(function(newUser) {
        req.session.name = username;
        console.log('A new user is created', newUser.attributes);
        res.status(200).redirect('/');
      });
    }
  });
});

app.post('/login', 
function (req, res) {
  res.redirect('/auth/github');
  // var username = req.body.username;
  // var password = req.body.password;
  // new User({ username: username }).fetch().then(function(user) {
  //   if (user) {
  //     // console.log('user', user.attributes);
  //     // console.log(password, user.attributes.salt);

  //     var hash = bcrypt.hashSync(password, user.attributes.salt);

  //     if (hash === user.attributes.password) {
  //       console.log('logging in');
  //       req.session.name = username;
  //       res.redirect('/');
  //     }
  //   } else {
  //     res.redirect('/login');
  //   }


  // });
});

/********************* PLAINTEXT PASSWORDS ***************************/
// app.post('/signup', function (req, res) {
//   var username = req.body.username;
//   var password = req.body.password;

//   new User({ username: username }).fetch().then(function(found) {
//     if (found) {
//       console.log('Username already exists.');
//       res.redirect(201, '/login');
//     } else {
//       Users.create({
//         username: username,
//         password: password,
//       })
//       .then(function(newUser) {
//         req.session.name = username;
//         // console.log('A new user is created', newUser.attributes);
//         res.status(200).redirect('/');
//       });
//     }
//   });
// });

// app.post('/login', 
// function (req, res) {
//   var username = req.body.username;
//   var password = req.body.password;
//   new User({ username: username }).fetch().then(function(user) {
//     if (user) {

//       if (password === user.attributes.password) {
//         // console.log('logging in');
//         req.session.name = username;
//         res.redirect('/');
//       }
//     } else {
//       res.redirect('/login');
//     }
//   });
// });

app.get('/logout', function (req, res) {
  console.log('logging out');
  req.logout();
  // req.session.destroy(function () {
  res.redirect('/login');
  // });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

app.post('/*', function(req, res) {
  res.redirect('/');
});

console.log('Shortly is listening on 4568');
app.listen(4568);
