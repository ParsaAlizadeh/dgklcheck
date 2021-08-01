import axios from 'axios';
import EventEmitter from 'events';
import fs from 'fs';

export class Job {
    static priceReg = /"price": ?(\d+)/;
    static index = 1;

    constructor(owner, url, lastPrice=null) {
        this.id = Job.index++;
        this.owner = owner;
        this.url = url;
        this.lastPrice = lastPrice;
    }
    async getPriceUpdate() {
        try {
            const resp = await axios.get(this.url);
            const match = resp.data.match(Job.priceReg);
            const price = Number(match[1]) / 10;
            return price;
        } catch (err) {
            console.error(err);
            return 0;
        }
    }
    async run(callback) {
        console.log(new Date, `Job ${this.id} started`);
        const currentPrice = await this.getPriceUpdate();
        const commit = () => {
            if (this.lastPrice !== currentPrice)
                callback(this, currentPrice);
            this.lastPrice = currentPrice;
        }
        commit();
        console.log(new Date, `Job ${this.id} ended`);
    }
    toJSON() {
        return {
            owner: this.owner,
            url: this.url,
            lastPrice: this.lastPrice
        }
    }
    static fromJSON(json) {
        return new Job(json.owner, json.url, json.lastPrice);
    }
}

export class JobManager extends EventEmitter {
    constructor(interval, dataFile, dataInterval) {
        super();
        this.jobs = [];
        this.interval = interval;
        this.dataFile = dataFile;
        this.dataInterval = dataInterval;
    }
    addJob(job) {
        this.jobs.push(job);
        this.runJob(job);
    }
    getJob(jobId) {
        for (const job of this.jobs) {
            if (job.id == jobId)
                return job;
        }
        return null;
    }
    removeJob(jobId) {
        this.jobs = this.jobs.filter(job => job.id != jobId);
    }
    runJob(job) {
        job.run((...args) => this.emit('change', ...args));
    }
    getUserJobs(owner) {
        return this.jobs.filter(job => job.owner == owner);
    }
    toJSON() {
        let result = [];
        for (const job of this.jobs) {
            result.push(job.toJSON());
        }
        return result;
    }
    loadJSON(jobList) {
        for (const jobJSON of jobList) {
            this.addJob(Job.fromJSON(jobJSON));
        }
    }
    loadFile(dataFile) {
        fs.readFile(dataFile, 'utf8', (err, data) => {
            if (err)
                console.error(err);
            else {
                const json = JSON.parse(data);
                this.loadJSON(json);
            }
        });
    }
    start() {
        /* load prev file */
        this.loadFile(this.dataFile);
        /* save */
        setInterval(() => {
            const json = this.toJSON();
            const data = JSON.stringify(json, null, 2);
            fs.writeFile(this.dataFile, data, 'utf8', err => {
                if (err) console.error(err);
            });
        }, this.dataInterval * 1000);
        /* run */
        setInterval(() => {
            console.log(new Date, 'JobManager Running')
            this.jobs.forEach(job => this.runJob(job));
        }, this.interval * 1000);
    }
}
