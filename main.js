'use strict';

const config = require('./config.json')

const Telegraf = require('telegraf');
const Markup = require('telegraf/markup');
const app = new Telegraf(config.token);
const Datastore = require('nedb-promises');

const confessions = Datastore.create('data/confessions');
const users = Datastore.create('data/users');

app.start(({reply}) => reply('Hello my child, what do you want to confess today?.'));

function countConfessions() {
    return confessions.count({});
};

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
    if(!message.text) return reply("My child i am blind, i can't see what you are showing me.");
    if(message.text.startsWith('/') == true) return reply("I don't understand what you are trying to tell me!");
    if(message.text.length > 240) return reply("Pardon, that's too much for me to remember " + message.text.length + '/240');
    return countConfessions()
        .then(res => ({
            id: res,
            postids: [],
            text: message.text,
            up: [],
            down: []
        }))
        .then(submitData =>
            confessions.insert(submitData))
        .then(()=> {
            return users.update({ _id: message.from.id }, {$set: {last: Date.now()}})})
        .then(() => { return reply('Your Confession has been recieved, your sins have been forgiven.') });
};

function sendConfessions(message, reply) {
    const commandOptions = message.text.split(" ", 2);
    if(!commandOptions[1]) return reply('Do you want to hear: new, top or random confessions?');
    if(commandOptions[1].toLowerCase() == 'random') {
        return countConfessions()
            .then((res) => {
                const random = Math.floor(Math.random() * res);
                return confessions.findOne({ id: random })
                    .then((res) => {
                        users.update({ _id: message.from.id }, {$set: { last_post: res.id }}).then(() => {return reply(`I recieved this message:\n${res.text}\n${res.up.length} UP ${res.down.length} DOWN`,
                        Markup.inlineKeyboard([
                            Markup.selective(message.from.id, true),
                            Markup.callbackButton('Like', 'like'),
                            Markup.callbackButton('Dislike', 'dislike')
                        ]).extra()
                        )})
                    })
            })
    };
    if(commandOptions[1].toLowerCase() == 'new') {

    };
    if(commandOptions[1].toLowerCase() == 'top') {

    };
    return reply('Do you want to hear: new, top or random confessions?');
};

app.command('confessions', ({ reply, message }) => {
    reply(message)
    checkUser(message).then(() => {
        console.log(message.text)
        return sendConfessions(message, reply);
    });
});

app.on('message', ({ reply, message }) => {
    if(message.chat.type !== 'private') return null;
    checkUser(message).then((res) => {
        if(Date.now() < res.last + 60000) return reply('I have other people to talk to come back in a minute');
        return submitConfession(message, reply);
    });
});

app.action('like', (ctx) => {
    return users.findOne({ _id: ctx.update.callback_query.from.id })
        .then((res) => {
            return confessions.findOne({ id: res.last_post })
                .then((res) => {
                    if(res.up.indexOf(ctx.update.callback_query.from.id) == -1 && res.down.indexOf(ctx.update.callback_query.from.id) !== -1){
                        const index = res.down.indexOf(ctx.update.callback_query.from.id);
                        res.up.push(ctx.update.callback_query.from.id);
                        res.down.splice(index, 1);
                        return confessions.update({ id: res.id }, {$set: { up: res.up, down: res.down }})
                        .then(() => {
                            return ctx.reply('Changed vote to downvote')
                        })
                    };
                    if(res.up.indexOf(ctx.update.callback_query.from.id) !== -1) {
                        return ctx.reply('Already Upvoted')
                    }
                    res.up.push(ctx.update.callback_query.from.id);
                    return confessions.update({ id: res.id }, {$set: { up: res.up }})
                        .then(() => {
                            return ctx.reply('Upvoted')
                        })
                })
        })
});

app.action('dislike', (ctx) => {
    return users.findOne({ _id: ctx.update.callback_query.from.id })
        .then((res) => {
            return confessions.findOne({ id: res.last_post })
                .then((res) => {
                    if(res.down.indexOf(ctx.update.callback_query.from.id) == -1 && res.up.indexOf(ctx.update.callback_query.from.id) !== -1){
                        const index = res.up.indexOf(ctx.update.callback_query.from.id);
                        res.down.push(ctx.update.callback_query.from.id);
                        res.up.splice(index, 1)
                        return confessions.update({ id: res.id }, {$set: { down: res.down, up: res.up }})
                        .then(() => {
                            return ctx.reply('Changed vote to downvote')
                        })
                    };
                    if(res.down.indexOf(ctx.update.callback_query.from.id) !== -1) {
                        return ctx.reply('Already Downvoted')
                    }
                    res.down.push(ctx.update.callback_query.from.id);
                    return confessions.update({ id: res.id }, {$set: { down: res.down }})
                        .then(() => {
                            return ctx.reply('Downvoted')
                        })
                })
        })
});

app.startPolling()
    .catch(err => console.log(err));