import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import {Job, JobManager} from './job.js';

dotenv.config();
const token = process.env.TOKEN;
const users = process.env.USERS.split(',').map(x => Number(x));
const interval = Number(process.env.INTERVAL);

const dataFile = process.env.DATA_FILE;
const dataInterval = process.env.DATA_INTERVAL;

const jobmanager = new JobManager(interval, dataFile, dataInterval);
const bot = new TelegramBot(token, {polling: true});

function replyTo(msg) {
    return {reply_to_message_id: msg.message_id};
}

function renderPrice(price) {
    if (price === null)
        return 'نامشخص'
    if (price === 0)
        return 'ناموجود';
    return `${price.toLocaleString('fa-IR')} تومان`;
}

jobmanager.on('change', (job, currentPrice) => {
    const resp =
        `<a href="${job.url}">تغییر قیمت کالا</a>\n` +
        `از ${renderPrice(job.lastPrice)}\n` +
        `به ${renderPrice(currentPrice)}\n` +
        `غیرفعال کردن با /rm_${job.id}`;
    bot.sendMessage(job.owner, resp, {parse_mode: 'HTML'});
});

jobmanager.on('show', (joblist) => {
    for (const job of joblist) {
        const resp = `<a href="${job.url}">کالای ${job.id}:</a> ${renderPrice(job.lastPrice)}`;
        bot.sendMessage(job.owner, resp, {parse_mode: 'HTML'});
    }
});

function userGuard(func) {
    return function(msg, match) {
        const chatId = msg.chat.id;
        if (users.includes(chatId))
            return func(msg, match);
    };
}

const startCommand = (msg, match) => {
    bot.sendMessage(msg.chat.id, 'سلام', replyTo(msg));
};

const addLink = userGuard((msg, match) => {
    const chatId = msg.chat.id;
    const url = match[0];
    const job = new Job(chatId, url);
    jobmanager.addJob(job);
    const resp = `اضافه شد\nغیرفعال کردن با /rm_${job.id}`;
    bot.sendMessage(chatId, resp, replyTo(msg));
});

const removeLink = userGuard((msg, match) => {
    const chatId = msg.chat.id;
    const jobId = Number(match[1]);
    const job = jobmanager.getJob(jobId);
    if (job?.owner !== chatId) {
        bot.sendMessage(chatId, 'دستور غیرمجاز', replyTo(msg));
    } else {
        jobmanager.removeJob(jobId);
        bot.sendMessage(chatId, 'حذف شد', replyTo(msg));
    }
});

const showJobs = userGuard(msg => {
    const joblist = jobmanager.getUserJobs(msg.chat.id);
    jobmanager.emit('show', joblist);
});

(async () => {
    // notify members
    for (const chatId of users) {
        bot.sendMessage(chatId, 'بات ریستارت شد');
    }

    bot.onText(/^\/start/, startCommand);
    bot.onText(/^https?:\/\/[^ ]*$/, addLink);
    bot.onText(/^\/rm_(\d+)$/, removeLink);
    bot.onText(/^\/all/, showJobs);

    jobmanager.start();
})();