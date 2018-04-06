var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;

var token = process.env.SLACK_API_TOKEN || '';
var web = new WebClient(token);

var rtm = new RtmClient(token);
rtm.start();

var { axios } = require('./slackBot');

function getQueryFromAI(message, session) {

    // example message:  schedule a meeting <@U69RUTB42> <@A19RUTB11> tomorrow 9am
    var matches = message.match(/<@(\w+)>/g);
    var matchesClean = matches ? [...matches] : [];
    for (let i = 0; i< matchesClean.length; i++){
        matchesClean[i] = matchesClean[i].substring(2,11);
    }
    // matches =  ["<@U69RUTB42>", "<@A19RUTB11>"]
    // matchesClean = ["U69RUTB42", "A19RUTB11"]

    for (let i = 0; i< matchesClean.length; i++){
        var user = rtm.dataStore.getUserById(matchesClean[i]);
        console.log('USER', user)
        var firstName = user.profile.first_name
        // console.log('test message 3', user.profile.first_name, user.profile.email)
        userList.push({
          displayName: user.profile.first_name || user.profile.real_name,
          email: user.profile.email
        })
        // console.log('USER LIST <<<<>>>>>>>>>', userList)

        message = message.replace(matches[i], firstName);
        console.log('MESSAGE MESSAGE ##', message)
    }

    return axios.get('https://api.api.ai/api/query', {
        params: {
            v: 20150910,
            lang: 'en',
            timezone: '2017-07-17T16:55:51-0700',
            query: message,
            sessionId: session
        },
        headers : {
            Authorization: `Bearer ${process.env.API_AI_TOKEN}`
        }
    })
}

// when I receive message from SlackBot
rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
    console.log('MESSAGE HERE TO DEBUG', message)
    var dm = rtm.dataStore.getDMByUserId(message.user);

    console.log("!!@@MESSAGE: ", message.subtype);
    // console.log('!!@@DM_ID', dm.id)
    // if it is NOT a direct message between bot and a user
    if (!dm || dm.id !== message.channel) {
      console.log("Message not sent to DM, ignoring");
      console.log('DM IS: ', dm, message.type)
      // console.log("dm" , dm);
      // console.log('NOT Direct Message: ', message);
      return;
    }
    console.log('Direct Message: ', message);
    //if it is DM.

    User.findOne({ slackId: message.user})
    .then(function(user){
        if (!user) {
            return new User({
                slackId: message.user,
                slackDMId: message.channel,
                pending: {}
            }).save();
        }
        return user;
    })
    .then(function(user) {
        // console.log(user); //printing out from MongoDB.
        // new Date().toLocaleString.slice(10) will yield real current time in 12 HR format with timezone accounted for
        console.log("USER: ", user);
        if (!user.google || user.google.expiry_date < Date.now() ) {
            let pstHour = parseInt(new Date(new Date().getTime()-25200000).toISOString().slice(11, 13));
            console.log('pstHour', pstHour)
            if (pstHour < 9) {
              rtm.sendMessage( `Good early morning, this is Sybil. :wave:
                  I need access to your Google Calendar to further help you;
                  Please visit: ${process.env.DOMAIN}/connect?user=${user._id} `, message.channel);
                  return;
            } else if (pstHour >=9 && pstHour < 12) {
              rtm.sendMessage( `Good morning, this is Sybil. :wave:
                  I need access to your Google Calendar to further help you;
                  Please visit: ${process.env.DOMAIN}/connect?user=${user._id} `, message.channel);
                  return;
            } else if (pstHour >= 12 && pstHour < 17) {
              rtm.sendMessage( `Good afternoon, this is Sybil. :wave:
                  I need access to your Google Calendar to further help you;
                  Please visit: ${process.env.DOMAIN}/connect?user=${user._id} `, message.channel);
                  return;
            } else if (pstHour >= 17){
              rtm.sendMessage( `Good evening, this is Sybil. :wave:
                  I need access to your Google Calendar to further help you;
                  Please visit: ${process.env.DOMAIN}/connect?user=${user._id} `, message.channel);
                  return;
              }
            }
            // rtm.sendMessage('Your id is' + user._id, message.channel)

            getQueryFromAI(message.text, message.user)
            .then(function({data}) {
                let dateString = data.result.parameters.date;
                let newDay = new Date(dateString);

                let weekday = new Array(7);
                weekday[0] =  "Sunday";
                weekday[1] = "Monday";
                weekday[2] = "Tuesday";
                weekday[3] = "Wednesday";
                weekday[4] = "Thursday";
                weekday[5] = "Friday";
                weekday[6] = "Saturday";

                let month = new Array(12);
                month[0] =  "January";
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

                let day = weekday[newDay.getDay()];
                let month2 = month[newDay.getMonth()];
                let date = newDay.getDate();
                let year = dateString.slice(0, 4);

                var outputString = ''

                if (date === 1 || date === 21 || date === 31) {
                  outputString = (month2 + ' ' + date + 'st of '+ year + ' (' + day + ')')
                } else if (date === 2 || date === 22){
                  outputString = (month2 + ' ' + date + 'nd of '+ year + ' (' + day + ')')
                } else if (date === 3 || date === 23) {
                  outputString = (month2 + ' ' + date + 'rd of '+ year + ' (' + day + ')')
                } else {
                  outputString = (month2 + ' ' + date + 'th of '+ year + ' (' + day + ')')
                }

                console.log("DATA: ", data);
                console.log('DATA DATE HERE: <<<<<<<>>>>>>>>', data.result.parameters.date)

                console.log('DATA DATA FORMATTED HERE ####@@@@@', outputString)

                // if some input is missing,
                if (data.result.actionIncomplete) {
                    rtm.sendMessage(data.result.fulfillment.speech, message.channel);
                }

                else { //When I have everything what I need. ex. date & todo.

                    // if invitees exist
                    if (data.result.metadata.intentName === 'Meeting - Add') {
                        user.pending = {
                            subject: 'meeting',
                            invitees: userList,
                            date: data.result.parameters.date,
                            //date: moment.tz(new Date(data.result.parameters.date).getTime(), "America/Los_Angeles"),
                            time: data.result.parameters.time,
                            duration: {
                                amount: data.result.parameters.duration.amount,
                                unit: data.result.parameters.duration.unit
                            }
                        }
                        user.save();
                        console.log('<<<<<<<<<<>>>>>>>>>>', user.pending.date)
                        // console.log("@@@@@INVITEES@@@@@",  data.result.parameters.invitees);
                        var jsonBtn = {
                            // "text": "Would you like to play a game?",
                            "attachments": [
                                {
                                    // "title": "Is this reminder correct?",
                                    "fallback": "A meeting is created",
                                    "attachment_type": "default",
                                    "fields": [
                                        {
                                            "title": "Subject",
                                            "value": `Meeting with ${userList.map(function(x){return x.displayName.charAt(0).toUpperCase() + x.displayName.slice(1)}).join(', ')}`,
                                            "short": true
                                        },
                                        {
                                            "title": "Invitees",
                                            // "value": data.result.parameters.invitees.map(function(x){return x}),
                                            // "value": data.result.parameters.invitees.join(', '),
                                            value: data.result.parameters.invitees.map(function(x){return x.charAt(0).toUpperCase() + x.slice(1)}).join(', '),
                                            "short": true
                                        },
                                        {
                                            "title": "Date",
                                            "value": outputString,
                                            "short": true
                                        },
                                        {
                                            "title": "Time",
                                            "value": data.result.parameters.time,
                                            "short": true
                                        }
                                    ]
                                },
                                {
                                    // "title": "Is this reminder correct?",
                                    "fallback": "You are unable to create a schedule",
                                    "callback_id": "confirm_or_not",
                                    "color": "#3AA3E3",
                                    "attachment_type": "default",

                                    "title": "Is this reminder correct?",
                                    "actions": [
                                        {
                                            "name": "confirm",
                                            "text": "Yes",
                                            "type": "button",
                                            "value": "true"
                                        },
                                        {
                                            "name": "cancel",
                                            "text": "Cancel",
                                            "type": "button",
                                            "style": "danger",
                                            "value": "false"
                                        }
                                    ]
                                }
                            ]
                        }
                        web.chat.postMessage(message.channel, ``, jsonBtn)
                    } else if (data.result.metadata.intentName === 'Remind - Add') { // if no invitees
                        user.pending = {
                            subject: data.result.parameters.subject,
                            date: data.result.parameters.date
                            //date: moment.tz(new Date(data.result.parameters.date).getTime(), "America/Los_Angeles")
                        }
                        console.log('USER.PENDING DATE IS: ', user.pending.date)
                        user.save()
                        var jsonBtn = {
                            "attachments": [
                                {
                                    "fallback": "A reminder is created",
                                    "attachment_type": "default",
                                    "fields": [
                                        {
                                            "title": "Subject",
                                            "value": data.result.parameters.subject,
                                            "short": true
                                        },
                                        {
                                            "title": "Date",
                                            "value": outputString,
                                            "short": true
                                        }
                                    ]
                                },
                                {
                                    "fallback": "A reminder is created",
                                    "callback_id": "confirm_or_not",
                                    "color": "#3AA3E3",
                                    "attachment_type": "default",

                                    "title": "Is this reminder correct?",
                                    "actions": [
                                        {
                                            "name": "confirm",
                                            "text": "Yes",
                                            "type": "button",
                                            "value": "true"
                                        },
                                        {
                                            "name": "cancel",
                                            "text": "Cancel",
                                            "type": "button",
                                            "style": "danger",
                                            "value": "false"
                                        }
                                    ]
                                }
                            ]
                        }
                        web.chat.postMessage(message.channel,'', jsonBtn)
                        // console.log('THIS ACTION IS BEING COMPLETED')
                    }
                }
            })
            .catch(function(err){
                console.log("ERROR", err);
            })
        })
    })

    rtm.on(RTM_EVENTS.REACTION_ADDED, function handleRtmReactionAdded(reaction) {
        console.log('Reaction added:', reaction);
    });

    rtm.on(RTM_EVENTS.REACTION_REMOVED, function handleRtmReactionRemoved(reaction) {
        console.log('Reaction removed:', reaction);
    });

    rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
        // rtm.sendMessage("Hello!", channel);
        console.log("Sybil is online!");
    });
