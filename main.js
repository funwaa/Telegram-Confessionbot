'use strict';

const config = require('./config.json')

const Telegraf = require('telegraf');
const Markup = require('telegraf/markup');
const app = new Telegraf(config.token);
const Datastore = require('nedb-promises');

const confessions = Datastore.create('data/confessions');
const users = Datastore.create('data/users');

app.start(({reply}) => reply('Hello my child, what do you want to confess today?'));

const replyText = res => {
    return `Someone told me:\n\n${res.text}\n${res.up.length} 👍 ${res.down.length} 👎`
}

function countConfessions() {
    return confessions.count({});
};

const voteButtons = res => {
    return Markup.inlineKeyboard([
        Markup.callbackButton('👍', `up ${res.id}`),
        Markup.callbackButton('👎', `down ${res.id}`)
    ]).extra()};

const checkUser = message => {
    return users.findOne({ _id: message.from.id })
        .then((res => {
            if(res === null) {
                const userData = {
                    _id: message.from.id,
                    last: Date.now() - 60000,
                    likes: [],
                    dislikes: [],
                };
                return users.insert(userData)
            }else {
                return res
            };
        }));
};

function submitConfession(message, reply) {
    if(!message.text) return reply("My child I am blind, I can't see what you are showing me.");
    if(message.text.startsWith('/') == true) return reply("I don't understand what you are trying to tell me!");
    if(message.text.length < 8) return reply('I need to know more about this, ' + message.text.length + '/8 characters');
    if(message.text.length > 420) return reply("Pardon, that's too much for me to remember, " + message.text.length + '/420');
    return countConfessions()
        .then(res => ({
            id: res,
            text: message.text,
            up: [],
            down: []
        }))
        .then(submitData =>
            confessions.insert(submitData))
        .then(()=> {
            return users.update({ _id: message.from.id }, {$set: {last: Date.now()}})})
        .then(() => { return reply('Your confession has been received, your sins have been forgiven.') });
};

function sendConfessions(message, reply) {
    const commandOptions = message.text.split(" ", 2);
    if(!commandOptions[1]) return reply('Do you want to hear: new, top or random confessions? e.g. /confessions option.');
    if(commandOptions[1].toLowerCase() == 'random') {
        return countConfessions()
            .then((res) => {
                const random = Math.floor(Math.random() * res);
                return confessions.findOne({ id: random })
                    .then((res) => {
                        return reply(replyText(res), voteButtons(res))
                    })
            })
    };
    if(commandOptions[1].toLowerCase() == 'new') {
        return confessions.find({}).sort({ id: -1 }).limit(1)
            .then((res => {
                res = res[0]
                return reply(replyText(res), voteButtons(res)) 
            }))

    };
    if(commandOptions[1].toLowerCase() == 'top') {
        return confessions.find({}).sort({ up: -1 }).limit(10)
            .then((res => {
                const random = Math.floor(Math.random() * res.length);
                res = res[random]
                return reply(replyText(res), voteButtons(res)) 
            }))
    };
    return reply('Do you want to hear: new, top or random confessions? e.g. /confessions option.');
};

app.on('callback_query', (ctx) => {
    const args = ctx.update.callback_query.data.split(' ', 2);
    const post  = Number(args[1]);
    const userID = ctx.update.callback_query.from.id;
    return confessions.findOne({ id: post })
        .then((res) => {
            if(args[0] == 'up') {
                if(res.up.indexOf(userID) == -1 && res.down.indexOf(userID) !== -1) {
                    res.up.push(userID);
                    const index = res.down.indexOf(userID);
                    res.down.splice(index, 1);
                    return confessions.update({ id: res.id }, {$set: { up: res.up, down: res.down}})
                        .then(() => {
                            return confessions.findOne({ id: res.id })
                                .then((res) => {
                                    ctx.editMessageText(replyText(res), voteButtons(res));
                                    return ctx.answerCbQuery('Changed vote to 👍')
                                })
                        })
                };
                if(res.up.indexOf(userID) !== -1) {
                    return ctx.answerCbQuery('Already 👍')
                };
                res.up.push(userID);
                return confessions.update({ id: post }, {$set: { up: res.up }})
                    .then(() => {
                        return confessions.findOne({ id: res.id })
                            .then((res) => {
                                ctx.editMessageText(replyText(res), voteButtons(res));
                                return ctx.answerCbQuery('Changed vote to 👍')
                            })
                    })
            };
            if(args[0] == 'down') {
                if(res.down.indexOf(userID) == -1 && res.up.indexOf(userID) !== -1) {
                    res.down.push(userID);
                    const index = res.up.indexOf(userID);
                    res.up.splice(index, 1);
                    return confessions.update({ id: res.id }, {$set: { down: res.down, up: res.up}})
                        .then(() => {
                            return confessions.findOne({ id: res.id })
                                .then((res) => {
                                    ctx.editMessageText(replyText(res), voteButtons(res));
                                    return ctx.answerCbQuery('Changed vote to 👎')
                                })
                        })
                };
                if(res.down.indexOf(userID) !== -1) {
                    return ctx.answerCbQuery('Already 👎')
                };
                res.down.push(userID);
                return confessions.update({ id: post }, {$set: { down: res.down }})
                    .then(() => {
                        return confessions.findOne({ id: res.id })
                            .then((res) => {
                                ctx.editMessageText(replyText(res), voteButtons(res));
                                return ctx.answerCbQuery('👎')
                            })
                    })
            };
        })
})

app.command('confessions', ({ reply, message }) => {
    checkUser(message).then(() => {
        return sendConfessions(message, reply);
    });
});

app.on('message', ({ reply, message }) => {
    if(message.chat.type !== 'private') return null;
    checkUser(message).then((res) => {
        if(Date.now() < res.last + 60000) return reply('I have other people to talk to,  come back in a minute.');
        return submitConfession(message, reply);
    });
});

app.startPolling()
    .catch(err => console.log(err));
