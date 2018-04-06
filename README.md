# SlackBot
AI bot for scheduling in Slack.

4 main files:
- bot.js which is the interaction between DM of Sybil and user
- oAuth.js which handles connecting user to his/her Google account
- express.js which serves as middleware between Slack DM and DialogFlow (formerly API.AI)
- cron.js which is hosted on Heroku to check between time criterion if there are pending reminders the day of or the day before
