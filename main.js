'use strict';

const config = require('./config.json')

const Telegraf = require('telegraf');
const app = new Telegraf(config.token);
const Datastore = require('nedb-promises');

const confessions = Datastore.create('data/confessions')

app.start(({reply}) => reply('Hello my child, what do you want to confess today?.'));

function submitConfession(message, text) {
    if(!text) return app.telegram.sendMessage(message.chat.id, 'I do not have time for a empty confession!');
    if(text.length > 240) return app.telegram.sendMessage(message.chat.id, 'Max character limit reached: ' + text.length + '/240');
    confessions.count({})
        .then(res => {
            let data = {
                id: res,
                text: text
            };
        confessions.insert(data)
            .then(function() {
                app.telegram.sendMessage(message.chat.id, 'Your confession has been recieved 🙏');
            });
    });

};

function randomConfession(message) {
    confessions.count({})
        .then(res => {
            const random = Math.floor(Math.random() * res);
            confessions.findOne({ id: random })
                .then(res => {
                    if(res === null) return app.telegram.sendMessage(message.chat.id, 'Looks like nobody confessed their sins yet.');
                    app.telegram.sendMessage(message.chat.id, res.text);
                });
        });
};

function newestConfession(message) {
    confessions.find({}).sort({ id: -1 })
        .then(res => {
            app.telegram.sendMessage(message.chat.id, res[0].text);
        })
}

app.on('message', ({ message, reply }) => {
    if(!message.text && message.chat.type == 'private') return reply("I can't handle media yet, sorry.");
    if(!message.text) return null;
    let command = message.text.split(" ", 2);
    let text = message.text.replace(command[0], '').trim();
    if(message.chat.type !== 'private' && command[0] == '/confess') return reply('You are only able to confess in a private chat.');
    if(command[0].toLowerCase() == '/confess') return submitConfession(message, text);
    if(command[0].toLowerCase() == '/confessions') {
        if(!command[1]) return reply('Please provide a valid option: newest, random');
        if(command[1].toLowerCase() == 'random') return randomConfession(message);
        if(command[1].toLowerCase() == 'newest') return newestConfession(message);
        app.telegram.sendMessage(message.chat.id, 'Not a valid option try: random, newest');
    };
})

app.startPolling()
    .catch(err => console.log(err));