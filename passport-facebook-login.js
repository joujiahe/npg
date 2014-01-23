// Server Configuration
var https = require('https');
var express = require('express');
var app = express();
var redis = require('redis');
var pub = redis.createClient();
var uuid = require('uuid');

// Global Configuration
var port = 8080;
var clientID = '';
var clientSecret = '';
var callbackURL = '/auth/facebook/callback';

// Passport Module Configuration
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Facebook profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new FacebookStrategy({
    clientID: clientID,
    clientSecret: clientSecret,
    callbackURL: callbackURL,
    passReqToCallback: true
  },
  function(req, accessToken, refreshToken, profile, done) {
    //User.findOrCreate(..., function(err, user) {
    //  if (err) { return done(err); }
    //  done(null, user);
    //});
    console.log('Access Token: ' + accessToken);
    console.log('Refresh Token: ' + refreshToken);
    console.log('Profile: ' + profile);
    console.log('Done: ' + done);

    https.get('https://graph.facebook.com/oauth/access_token?' +             
             'client_id=' +  clientID +
             '&client_secret=' + clientSecret +
             '&grant_type=fb_exchange_token' +
             '&fb_exchange_token=' + accessToken, function(res) {

      var body = '';
      res.on('data', function(chunk) {
        body += chunk;
      });
      res.on('end', function(chunk) {
        console.log("Long Lived Token: " + body);
      });

    }).on('error', function(e) {
      console.log("error: " + e.message);
    });
    req.session.profile = profile;
    return done(null, profile);
  }
));

// Server Configuration
app.configure(function() {
  //app.use(express.static('public'));
  app.use(express.cookieParser());
  //app.use(express.bodyParser());
  app.use(express.session({ secret: '1234567890' }));
  app.use(passport.initialize());
  app.use(passport.session());
  //app.use(app.router);
});

app.get('/', function(req, res) {
  res.send('Hello World');
});

app.get('/sub', function(req, res) {
  var sub = redis.createClient();
  var channel = uuid.v1();

  sub.subscribe(channel);
  sub.on('message', function(channel, message) {
    console.log(channel + ': ' + message);
  });

  res.send('Subscribe: ' + channel);
});

app.get('/pub/:channel', function(req, res) {
  pub.publish(req.params.channel, 'do pub');
  res.send('Publish');
});

app.get('/login', function(req, res) {
  //res.send('Login');
  req.session.uuid = uuid.v1();

  res.redirect('/auth/facebook');
});

app.get('/check', function(req, res) {
  console.log(req.session.uuid);

  var channel = req.session.uuid;
  var sub = redis.createClient();
  sub.subscribe(channel);
  sub.on('message', function(message){
    res.send(channel + ': ' + message);
  })
});

app.get('/successed', function(req, res) {
  var body = '';
  if (req.session.profile) {
    body += 'Hi, ' + req.session.profile.displayName;

    var channel = req.session.uuid;
    pub.publish(channel, 'done');
  } else
    body += 'nothing...';
  res.send(body);
});

app.get('/failed', function(req, res) {
  res.send('Failed');
});

app.get('/session', function(req, res) {
  res.send(JSON.stringify(req.session));
});

// Redirect the user to Facebook for authentication.  When complete,
// Facebook will redirect the user back to the application at
//     /auth/facebook/callback
app.get('/auth/facebook', passport.authenticate('facebook'));

// Facebook will redirect the user to this URL after approval.  Finish the
// authentication process by attempting to obtain an access token.  If
// access was granted, the user will be logged in.  Otherwise,
// authentication has failed.
app.get(callbackURL, 
  passport.authenticate('facebook', { successRedirect: '/successed',
                                      failureRedirect: '/failed' }));

app.listen(port);

console.log('Listening at port ' + port);
