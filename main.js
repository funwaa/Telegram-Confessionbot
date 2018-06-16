'use strict';

const config = require('./config.json')

const Telegraf = require('telegraf');
const app = new Telegraf(config.token);
const Datastore = require('nedb-promises');

const confessions = Datastore.create('data/confessions')

function submitConfession(message, text) {
    if(!text) return app.telegram.sendMessage(message.chat.id, "I cant save a empty confession!");
    if(text.length > 240) app.telegram.sendMessage(message.chat.id, 'Max character limit reached: ' + text.length + '/240');
    confessions.count({})
        .then(res => {
            let data = {
                id: res,
                text: text
            };
            confessions.insert(data)
            .then(function() {
                app.telegram.sendMessage(message.chat.id, 'Successfully submitted.');
            }).catch(err => console.log(err));
        });
};

function randomConfession(message) {
    confessions.count({})
        .then(res => {
            const random = Math.floor(Math.random() * res);
            confessions.findOne({ id: random })
                .then(res => {
                    if(res === null) return app.telegram.sendMessage(message.chat.id, 'Looks like nobody confessed their sin yet.')
                    app.telegram.sendMessage(message.chat.id, res.text)
                        .catch(err => console.log(err));
                }).catch(err => console.log(err));
        }).catch(err => console.log(err));
};

app.on('message', ({ message, reply }) => {
    if(!message.text) return app.telegram.sendMessage(message.chat.id, "I can't media yet, sorry.")
    let command = message.text.split(" ", 1);
    let text = message.text.replace(command, '').trim();
    if(command[0].toLowerCase() == '/submit') return submitConfession(message, text);
    if(command[0].toLowerCase() == '/confession') return randomConfession(message);
})

app.startPolling();