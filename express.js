var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var WebClient = require('@slack/client').WebClient;
var axios = require('axios');
var moment = require('moment-timezone');
var http = require('http');

var { User, Reminder } = require('./models');
var { google, OAuth2 } = require('./oAuth');

var userList = [] // storing user's emails, displayNames here and will empty on creation of Scheduling a meeting

setInterval(function() {
  http.get("http://sybil-the-scheduler.herokuapp.com/");
}, 900000)

// =========================== express ===========================

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post ('/messageReceive', function(req, res) {
    var payload = JSON.parse(req.body.payload);

    if (payload.actions[0].value === 'true'){ // when user press confirm.

        //  =============== to find invitees email ==================== */
        User.findOne({ slackId: payload.user.id})
        .then(function(user){
            console.log('TO BE SCHEDULED', user.pending)
            if (!user.pending.invitees) { // if no invitees, this implies that this must be a reminder type
                event = {
                    'summary': user.pending.subject,
                    'description': user.pending.subject,
                    'start': {
                        'date': user.pending.date
                    },
                    'end': {
                        'date': user.pending.date// same day as user.pending.date for the purpose of an all-day reminder
                    }
                }
                var newReminder = new Reminder({
                  user: payload.user.id,
                  subject: user.pending.subject,
                  date: user.pending.date
                }).save()
            } else { // with invitees

                var dat = moment.tz(user.pending.date + ' ' + user.pending.time, 'America/Los_Angeles');
                // console.log('USER LIST ##<<##', userList)
                event = {
                    // 'summary': `Meeting with $(userList.map(function(x){return x+' '}))}`,
                    'summary': `Meeting with ${userList.map(function(x){return x.displayName.charAt(0).toUpperCase() + x.slice(1)}).join(', ')}`,
                    'description': user.pending.subject,
                    'attendees' : userList,
                    'start': {
                        dateTime: dat.format()
                    },
                    'end': {
                        'dateTime': dat.add(30, 'minutes').format()
                    }
                }
            }

            var calendar = google.calendar('v3');
            let oauth2Client = new OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                process.env.DOMAIN+'/connect/callback'
            )

            let rtoken = {}
            rtoken.access_token=user.google.access_token;
            rtoken.id_token=user.google.id_token;
            rtoken.token_type=user.google.token_type;
            rtoken.expiry_date=user.google.expiry_date;

            oauth2Client.setCredentials(rtoken)
            calendar.events.insert({
                auth: oauth2Client,
                calendarId: 'primary',
                resource: event
            }, function(err,event){
                if(err){
                    console.log('errrrrr',err)
                } else {
                    user.pending = {};
                    userList = [];
                    // console.log('WORKING!!!');
                    user.save();
                    res.send('Created! :white_check_mark:');
                }
            })
        })
    } else if (payload.actions[0].value === 'false'){ //when user press cancel.

        User.findOne({ slackId: payload.user.id})
        .then(function(user){
            user.pending = {};
            userList = [];
            user.save();
        })
        res.send('Canceled! :x:');
    }
})

module.exports = {
  axios: axios
}
