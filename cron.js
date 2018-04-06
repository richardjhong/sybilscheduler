"use strict";

var moment = require('moment-timezone')
var { User } = require('./models');
var { Reminder } = require('./models')
var WebClient = require('@slack/client').WebClient;
var async = require('async/waterfall');
// var { Web } = require('./slackBot')

var token = process.env.SLACK_API_TOKEN || '';
var Web = new WebClient(token);

// var date = new Date();
// var utcDate = new Date(date.toUTCString());
// var msDate = utcDate.setHours(utcDate.getHours()-7);
// var usDate = new Date(utcDate);

var today2 = moment().tz("America/Los_Angeles").format()
var today = new Date(new Date().getTime()-25200000).toISOString().substring(0, 10) // today's date in 'YYYY-MM-DD' format
var tomorrow = new Date(new Date().getTime()+147600000).toISOString() //The day after tomorrow in 'YYYYYY-MM-DDTHH:mm:ss.sssZ' format
var tomorrow2 = new Date(new Date().getTime()+147600000).toISOString().substring(0, 10) //The day after tomorrow in 'YYYY-MM-DD' format
var yesterday = new Date(new Date().getTime()-111600000).toISOString() // Yesterday in 'YYYYYY-MM-DDTHH:mm:ss.sssZ' format
var yesterday2 = new Date(new Date().getTime()-111600000).toISOString().substring(0, 10) // Yesterday in 'YYYY-MM-DD' format

console.log('TODAY2: ', today2)
console.log('TODAY: ', today)

var weekday = new Array(7);
weekday[0] =  "Sunday";
weekday[1] = "Monday";
weekday[2] = "Tuesday";
weekday[3] = "Wednesday";
weekday[4] = "Thursday";
weekday[5] = "Friday";
weekday[6] = "Saturday";

var month = new Array(12);
month[0] = "January";
month[1] = "Febuary";
month[2] = "March";
month[3] = "April";
month[4] = "May";
month[5] = "June";
month[6] = "July";
month[7] = "August";
month[8] = "September";
month[9] = "October";
month[10] = "November";
month[11] = "December";

Reminder.find({date: {$gt : yesterday2, $lt : tomorrow2}})
.then(function(reminders) { // return array of reminders functions
  reminders.sort(function(a, b) { // first sort reminders by date so that async-waterfall can be invoked correctly
    if (a.date < b.date) {
      return -1;
    } else if (b.date < a.date) {
      return 1;
    } else if (a.date === b.date) { // if same date, sort alphabetically by subject
      if (a.subject < b.subject) {
        return -1;
      } else if (b.subject < a. subject) {
        return 1;
      } else { // if for some reason the same task, order isn't important as both display same information
        return 0;
      }
    }
  })
  console.log('DAY RANGE OF REMINDERS TO FIND : (between)', yesterday2, 'through', tomorrow2)
  console.log('LIST OF REMINDERS: ', reminders)
  console.log('TODAY IS :', today)
  console.log('THE CURRENT HOUR IN 24 HOUR FORMAT WITH PST ACCOUNTED FOR IS: ', new Date(new Date().getTime()-25200000).toISOString().slice(11, 13))
  if (reminders.length === 0) {
    process.exit(0);
  } else {
    var reminderFns = reminders.map((reminder) => {
      return function (callback) {
          console.log('EACH INDIVIDUAL REMINDER : ', reminder)
          let dateString = reminder.date;
          let newDay2 = new Date(new Date(dateString).getTime()+25200000).toISOString().substring(0, 10); // 'YYYY-MM-DD' format
          let newDay = new Date(new Date(dateString).getTime()+25200000); // 'YYYYYY-MM-DDTHH:mm:ss.sssZ' format

          let day = weekday[newDay.getDay()];
          let month2 = month[newDay.getMonth()]; // month var is already declared in line 31
          let date = newDay.getDate();
          let year = dateString.slice(0, 4);
          var outputString = ''

          if (date === 1 || date === 21 || date === 31) {
            outputString = (month2 + ' ' + date + 'st of '+ year + ' (' + day + '), ')
          } else if (date === 2 || date === 22){
            outputString = (month2 + ' ' + date + 'nd of '+ year + ' (' + day + '), ')
          } else if (date === 3 || date === 23) {
            outputString = (month2 + ' ' + date + 'rd of '+ year + ' (' + day + '), ')
          } else {
            outputString = (month2 + ' ' + date + 'th of '+ year + ' (' + day + '), ')
          }

          User.findOne({slackId: reminder.user})
            .then(function(user) {
              console.log('OUTPUTSTRING IS :', outputString)
              console.log('USER IS: ', user)

              if (newDay2 === today && new Date(new Date().getTime()-25200000).toISOString().slice(11, 13) === '09') {
                Web.chat.postMessage(
                  user.slackDMId,
                  `:bell: Today on *${outputString}* you have the following reminder:
                  _${reminder.subject}_.
                (*Please note:* this will automatically be deleted off of your reminder list at 11 P.M. PST! :no_bell: )`,
                  () => { callback() }
                )
              } else if (newDay2 === today && (new Date(new Date().getTime()-25200000).toISOString().slice(11, 13) === '00')) {
                Web.chat.postMessage(
                  user.slackDMId,
                  `:bell: Today on *${outputString}* you had the following reminder:
                  ~_${reminder.subject}_~.
                  This is *now deleted off of your reminder list* as of 11 P.M. PST! :x:`,
                  function () {
                    reminder.remove();
                    callback()
                    // necessary to use callback() here as it is passed in a function in line 94
                  }
                )
              } else if (newDay2 !== today && new Date(new Date().getTime()-25200000).toISOString().slice(11, 13) === '09'){
                Web.chat.postMessage(
                  user.slackDMId,
                  `:bell: Tomorrow on *${outputString}* you have the upcoming following reminder:
                  _${reminder.subject}_.`,
                  () => { callback() }
                )
              } else {
                process.exit(0);
              }
            })
      }
    })
    async(reminderFns,
    function (err, results) {
      process.exit(0) // exits the cron.js file, necessary for deployment on heroku to close
    })
  }
})
