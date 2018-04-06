var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var app = express();

function getGoogleAuth() {
    return new OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.DOMAIN + '/connect/callback'
    )
}

const GOOGLE_SCOPE = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email'
];

app.get('/connect', function(req, res){
    var userId = req.query.user;
    if (!userId) {
        res.status(400).send('Missing user id');
    }
    else{ // if userID exists (logged in)
        User.findById(userId)
        .then(function(user){
            if (!user){
                res.status(404).send('Cannot find user');
            }
            else { //connect to Google
                var googleAuth = getGoogleAuth();
                var url = googleAuth.generateAuthUrl({
                    access_type: 'offline',
                    prompt: 'consent',
                    scope: GOOGLE_SCOPE,
                    state: userId
                });
                res.redirect(url);
            }
        });
    }
});

app.get('/connect/callback', function(req, res){
    var googleAuth = getGoogleAuth();
    googleAuth.getToken(req.query.code, function (err, tokens) {
        if (err){
            res.status(500).json({error: err});
        }
        else {
            googleAuth.setCredentials(tokens);
            var plus = google.plus('v1');
            plus.people.get({auth: googleAuth, userId: 'me'}, function(err, googleUser){
                if (err) {
                    res.status(500).json({error: err});
                }
                else {
                    User.findById(req.query.state)
                    .then(function(mongoUser) {
                        mongoUser.google = tokens;
                        mongoUser.google.profile_id = googleUser.id;
                        mongoUser.google.profile_name = googleUser.displayName;
                        mongoUser.google.email = googleUser.emails[0].value;
                        return mongoUser.save();
                    })
                    .then(function(mongoUser) {
                        res.send(`Hey ${mongoUser.google.profile_name}, this is Sybil again. I am connected to your Google Calendar and now ready to take your requests! Come meet me back within Slack!`)
                        rtm.sendMessage(`Welcome back, ${mongoUser.google.profile_name}! I am now ready to take your requests!`, mongoUser.slackDMId)
                    });
                }
            });
        }
    })
});

var port = process.env.PORT || '3000';
app.listen(port, function() {
    console.log('Server is up!');
});

module.exports = {
  OAuth2: OAuth2,
  google: google
}
