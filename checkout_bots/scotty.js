/* scotty v5*/

const HTMLParser = require('node-html-parser');
const puppeteer = require('puppeteer-extra');
const { createCursor } = require( "ghost-cursor")
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const tls = require('tls');
const { https } = require('follow-redirects');
const tunnel = require('tunnel');
const proxyChain = require('proxy-chain');
const {spawn} = require('child_process');
const fs = require("fs"); // Or import fs from "fs"; with ESM
const ac = require("@antiadmin/anticaptchaofficial");
const { ConsoleMessage } = require('puppeteer');

//#region global variables and functions

const dC = tls.DEFAULT_CIPHERS.split(':');

const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const sC = [
    dC[0],
    // Swap the 2nd & 3rd ciphers:
    dC[2],
    dC[1],
    dC[3],
    dC[4],
    dC[6],
    dC[5],
    ...dC.slice(7)
    //...shuffle(...dC.slice(3))
].join(':');

const PUTTERS_URL = "https://www.scottycameron.com/store/gallery-putters/";

const SITE_KEY = "55159327-40d2-4fdb-b5c7-aeefe3139ceb"
const PAYMENT_URL = "https://www.scottycameron.com/store/checkout/index/"

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const RANDOM_PAGES = [
    'https://www.scottycameron.com/store/',
    'https://www.scottycameron.com/store/cart/',
    'https://www.scottycameron.com/store/gallery-putters/',
    'https://www.scottycameron.com/store/accessories/',
    'https://www.scottycameron.com/store/apparel/',
    'https://www.scottycameron.com/store/user/dashboard/'
]

function randInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const keypress = async () => {
  process.stdin.setRawMode(true)
  return new Promise(resolve => process.stdin.once('data', data => {
    const byteArray = [...data]
    if (byteArray.length > 0 && byteArray[0] === 3) {
      console.log('^C')
      process.exit(1)
    }
    process.stdin.setRawMode(false)
    resolve()
  }))
}

function timestamp(){
    function pad(n) {return n<10 ? "0"+n : n}
    d=new Date()
    dash="-"
    colon=":"
    return pad(d.getHours())+colon+
    pad(d.getMinutes())+colon+
    pad(d.getSeconds())//d.getFullYear()+dash+
    //pad(d.getMonth()+1)+dash+
    //pad(d.getDate())+" "+  
}
    
async function detectAllBrowsers() {//callback) {
    const browsers = [
        'Chromium',
        'Firefox',
        'Google Chrome',
        'Opera',
        'Safari',
        'TextEdit'
    ]

    var detectedBrowsers = [];
    var promises = [];

    browsers.forEach(function(browserName, index) {
        // /Applications/Google\ Chrome.app/Contents/Info.plist
        var path = '/Applications/' + browserName + '.app';
        var aPromise = new Promise(function(resolve, reject) {
        if (fs.existsSync(path)) {
            var aBrowser = {
            name: browserName,
            path: path
            }

            var sp = spawn('/usr/libexec/PlistBuddy', ['-c', 'print :CFBundleShortVersionString', path + '/Contents/Info.plist']);
            sp.stdout.setEncoding('utf8')
            sp.stdout.on('data', data => {
            aBrowser.version = data.trim();
            });

            sp.on('close', code => {
            detectedBrowsers.push(aBrowser);
            resolve('done');
            });
        } else {
            resolve('done');
        }
        });

        promises.push(aPromise);
    });

    return Promise.all(promises).then(data => {
        return detectedBrowsers; //callback(detectedBrowsers);
    });
}

function getTime() {
    var date_nz = new Date(); 
    date_nz.toLocaleString('en-US', { timeZone: 'America/New_York' });
    var hour = parseInt(("0" + date_nz.getHours()).slice(-2));
    var minute = parseInt(("0" + date_nz.getMinutes()).slice(-2));
    var seconds = parseInt(("0" + date_nz.getSeconds()).slice(-2));     
    return {
        hour,
        minute,
        seconds
    }
}

//#end region

module.exports = (function() {
    return class Scotty {
        constructor(config){
            //Optionally override these in the config 
            this.pinging_delay = 1000 //in milliseconds
            this._sec_ch_ua = `" Not A;Brand";v="99", "Chromium";v="102", "Google Chrome";v="102"`;
            this.macUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.61 Safari/537.36"
            this.winUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'
            this.force_user_confirm_login = false;

            Object.assign(this, config);
            if(!this.userN) {
                throw new Error("Construtor config missing userN")
            }
            if(!this.passW) {
                throw new Error("Construtor config missing passW")
            }
            if(!this.order_post_data) {
                throw new Error("Construtor config missing order_post_data")
            }
            if(!this.test_Product_URL && isNaN(this.targetPutterNumber)) {
                throw new Error("Construtor config missing test_Product_URL or targetPutterNumber. THE CODE WILL ATTEMPT BUY THE TEST PRODUCT INSTEAD IF test_Product_URL IS NOT EMPTY!")
            }
            if(this.targetPutterNumber > 5 || this.targetPutterNumber < 1) {
                throw new Error("Config error - targetPutterNumber must be a number 1-5")
            }
            if(!this.anti_key) {
                throw new Error("Construtor config missing anti_key")
            }
            if(this.proxy_host) {
                if(!this.proxy_port) {
                    throw new Error("proxy_host was set but proxy_port was not!")
                }
                if(this.proxy_user) {
                    if(!this.proxy_pass) {
                        throw new Error("proxy_user was set but proxy_port was not!")
                    }
                }
            }

            this.cookieJar = {}     
            this.h_tokens = []
            this.proxy = {
                host: this.proxy_host,
                port: this.proxy_port
            }
            if(this.proxy_user) {
                this.proxy['proxyAuth'] = this.proxy_user + ":" + this.proxy_pass
            }
            this.tunnelling_agent = this.proxy_host ? tunnel.httpsOverHttp({
                proxy: this.proxy
            }) : null;
            //var dataid, datasku, parentproductid, requestverificationtoken, xpid
            this.selectedProductURL = ""
        }

        log() {
            return timestamp() + " | " + this.userN + " | "
        }

        getCookieString() {
            var cookiesString = ""
            for (const [key, value] of Object.entries(this.cookieJar)) {
                cookiesString += key + "=" + value + "; ";
            }
            if(cookiesString.lastIndexOf("; ") > -1) {
                cookiesString = cookiesString.substring(0, cookiesString.lastIndexOf("; "));
            }  
            return cookiesString;
        }
        
        updateCookieJar(resContainer) {
            resContainer.res.headers['set-cookie'].forEach((raw,i) => {
                let name = raw.substring(0,raw.indexOf('='))
                let value = raw.substring(raw.indexOf('=') + 1,raw.indexOf(';'))
                this.cookieJar[name] = value;
                //console.log("Setting cookie: " + name +"="+value)
            })
        }

        async get(url, headers) {
            const options = {
                method: "GET",
                headers: headers, 
                ciphers: sC,
                gzip: true, // This fixes the response body from apearing as ���9��▲�/ weird characters    
            }
        
            //options.agent = new https.Agent(options);
            options.agent = this.tunnelling_agent ?? new https.Agent(options);
        
            return new Promise((resolve, reject) => {
                const req = https.request(url,options, (res) => {
                    if (res.statusCode < 200 || res.statusCode > 299) {
                        //    console.log(this.log() + "Pinging error code: " + res.statusCode )
                        return reject(new Error(`HTTP status code ${res.statusCode}`))
                    }
        
                    //console.log(this.log() + '\nServer encoded the data as: ' + (res.headers['content-encoding'] || 'identity') + "\n\n")    
                    const body = []
                    //res.setEncoding('utf8');
                    res.on('data', (chunk) => body.push(chunk))
                    res.on('end', () => {
                        //const content = body.join('')
                        const content = Buffer.concat(body).toString()
                        //console.log("RESULT: " + content)
                        resolve({res, content})
                    })
                })
            
                req.on('error', (err) => {
                    //console.log(this.log() + "Pinging failed: " + err)
                    reject(err)
                })
            
                req.on('timeout', () => {
                    req.destroy()
                    //console.log(this.log() + "Pinging request timed out")
                    reject(new Error('Request time out'))
                })
            
                //req.write(postData)
                req.end()
            })
        }
        
        async post(url, headers, postData) {
            const options = {
                method: "POST",
                headers: headers,  
                ciphers: sC,  
                gzip: true
            }
        
            //options.agent = new https.Agent(options);
            options.agent = options.agent = this.tunnelling_agent ?? new https.Agent(options);
            
            return new Promise((resolve, reject) => {
                const req = https.request(url, options, (res) => {
                    if (res.statusCode < 200 || res.statusCode > 299) {
                        //console.log("ATC failed status code: " + res.statusCode )
                        return reject(new Error(`HTTP status code ${res.statusCode}`))
                    }
            
                    const body = []
                    res.on('data', (chunk) => body.push(chunk))
                    res.on('end', () => {
                        const content = Buffer.concat(body).toString()
                        //console.log("ATC Success: " + res.statusCode)
                        //console.log("Data: " + content);
                        resolve({res, content})
                    })
                })
            
                req.on('error', (err) => {
                    //console.log("ATC failed: " + err)
                    reject(err)
                })
            
                req.on('timeout', () => {
                    req.destroy()
                    //console.log("ATC failed: Request time out")
                    reject(new Error('Request time out'))
                })
            
                req.write(postData)
                req.end()
            })
        }
        
        tokenHandler() {
            let createRequest = false
            let {hour, minute, seconds} = getTime()
            let dropPending = (hour == 11 && minute >= 27 && minute < 32)

            if(minute % 3 == 0) {
                console.log(this.log() + "Running token handler...")
            }

            if(!this.last_token_time) {
                createRequest = true
            }else{
                if(dropPending) {
                    let start = this.last_token_time
                    let end = new Date()
                    let elapsedSec = (end.getTime() - start.getTime())/1000
                    if(elapsedSec > 25) {
                        createRequest = true
                    }
                }
            }

            if(!this.task_complete) {               
                if(createRequest) {
                    this.last_token_time = new Date()
                    this.getHCaptchaToken()
                }
                setTimeout(this.tokenHandler.bind(this), 1900);
            }
        }
        
        async getHCaptchaToken(){
            let start = new Date()
            console.log(this.log() + 'Captcha token requested...')
        
            ac.setAPIKey(this.anti_key);
            return ac.solveHCaptchaProxyless(PAYMENT_URL, SITE_KEY)
                .then(gresponse => {
                    //console.log('g-response: '+gresponse);
                    this.h_tokens.push(gresponse.trim());
                    let end = new Date()
                    let elapsed = end.getTime() - start.getTime()
                    this.last_token_time = end
                    console.log(this.log() + 'Token received in: ' + elapsed/1000 + " seconds")
                })
                .catch(error => console.log(this.log() + 'Token error: '+ error));        
        } 
        
        




        

        simulateActivity() {
            let {hour, minute, seconds}  = getTime()

            if(this.task_complete) {    
                console.log(this.log() + "Activity simulation closed.")           
                return;
            }

            if(hour == 11 && minute >= 27 && seconds % 8 == 0) {
                console.log(this.log() + "Updating Cookie Jar")
                this.page._client.send('Network.getAllCookies').then(networkCookies => {
                    networkCookies.cookies.forEach((cookieData, index, arr) => { 
                        if(PUTTERS_URL.toLowerCase().includes(cookieData.domain.toLowerCase())) {
                            this.cookieJar[cookieData.name] = cookieData.value
                        }      
                    }); 
                })
                console.log(this.log() + "Cookie jar updated.")
                if(minute >= 31) {
                    console.log(this.log() + "Activity simulation complete")
                    return
                }
            }
        
            if( ((hour == 11 && ((minute == 27 && seconds > 35) || minute == 28)) 
            || (hour == 11 && minute == 29 && seconds < 40))
            ) {
                if(!this.startedSimulation) {
                    this.startedSimulation = true
                    console.log(this.log() + "Starting activity simulation...")
                }
                const index = randInt(0, RANDOM_PAGES.length - 1)
                const url = RANDOM_PAGES[index]
                const cursor = createCursor(this.page)
                console.log(this.log() + "[Simulating activity] Navigating to: " + url)
                try{
                    this.page.goto(url, { waitUntil: 'networkidle2' }).then(() => {
                        //this.page.waitForFunction(() => document.readyState === "complete").then(() => {
                            this.page.waitForSelector('ul[data-nav-link="nav"]').then(() => {
                                cursor.move('ul[data-nav-link="nav"]').then(() => {
                                    sleep(randInt(500,2000)).then(() => {
                                        cursor.move('.siteheader__logo').then(() => {
                                            this.page.evaluate(() => new Promise((resolve) => {
                                                var scrollTop = -1;
                                                let startTime = new Date();
                                                let randInt = (min, max) =>  {
                                                    min = Math.ceil(min);
                                                    max = Math.floor(max);
                                                    return Math.floor(Math.random() * (max - min + 1)) + min;
                                                }
                                                const interval = setInterval(() => {
                                                    window.scrollBy(0, randInt(10, 70));
                                                    let endTime = new Date();
                                                    var timeDiff = endTime - startTime;
                                                    timeDiff /= 1000;
                                                    var seconds = Math.round(timeDiff);
                                                    console.log(seconds + " seconds")
                                                    if(seconds > 7) {
                                                        resolve()
                                                    }else if(document.documentElement.scrollTop !== scrollTop) {
                                                        scrollTop = document.documentElement.scrollTop;
                                                    }else{
                                                        clearInterval(interval);
                                                        resolve();
                                                    }
                                                }, 50);
                                            })).then(() => {
                                                this.page.mouse.move(randInt(0,700), randInt(0,700)).then(() => {
                                                    sleep(randInt(500,1000)).then(() => {
                                                        this.page.mouse.move(randInt(0,700), randInt(0,700)).then(() => {
                                                            cursor.move('.siteheader__logo').then(() => {
                                                                setTimeout(this.simulateActivity.bind(this), randInt(1000,2500));
                                                            })
                                                        })
                                                    });
                                                })
                                            })
                                        })
                                    })
                                })
                            })
                        //})
                    })
                }catch(err) {
                    console.log(this.log() + "Simulating activity error: " + err)
                    setTimeout(this.simulateActivity.bind(this), 1000);
                }
            }else{
                if(this.startedSimulation !== false) {
                    this.startedSimulation = false
                    console.log(this.log() + "Activity simulation paused")
                }
                setTimeout(this.simulateActivity.bind(this), 1000);
            }
        }

        autoShutdown() {
            let {hour, minute, seconds} = getTime()
            if(hour == 11 && minute > 32) {
                console.log(this.log() + "Auto shuting down the program...");
                process.exit(0)
            }else {
                setTimeout(this.autoShutdown.bind(this), 10000);
            }
        }
        
        async login(){
            const login_URL = "https://www.scottycameron.com/store/user/login/";
            const browser = this.browser
            const page = this.page

            console.log(this.log() + "Logging in with " + this.userN + " - " + this.passW);
        
            try{
                await page.goto(login_URL, { waitUntil: 'networkidle2' });    
                const pages = await browser.pages()
                if(pages.length > 1) { 
                    await pages[1].close();
                }
                await page.waitForFunction(() => document.readyState === "complete");
                await page.waitForSelector('.login-form #login_username')
                await page.type('.login-form #login_username', this.userN)
                await page.waitForSelector('.login-form #login_password') 
                await page.type('.login-form #login_password', this.passW)
                await page.waitForTimeout(1300)
                await page.click('.col-xs-12 #loginButton')

                if(this.force_user_confirm_login) {         
                    console.log(this.log() + "Please confirm the login is complete, also check the cart, then press any key to continue...")               
                    await keypress()
                }else{
                    console.log(this.log() + "Delaying for 8 seconds max to ensure login success...")
                    let start = new Date()
                    let url = page.url();
                    let elapsed = 0;
                    while(elapsed < 8 && url.toLowerCase().includes('store/user/login')) {                    
                        let end = new Date()
                        elapsed = (end.getTime() - start.getTime()) / 1000
                        await sleep(1000)
                        url = page.url();
                    }
                }

                let url = page.url();
    
                console.log(this.log() + "Url change: " + url)

                let incrementFails = () => {
                    if(typeof this.failed_logins == 'undefined') {
                        this.failed_logins = 0
                    }
                    this.failed_logins += 1
                }

                if(url.toLowerCase().includes('store/user/login')) {
                    incrementFails()
                    if(this.failed_logins > 2) {
                        console.log(this.log() + `Login has failed ${this.failed_logins} times. You have to manually login and confirm the login now.`);
                        this.force_user_confirm_login = true
                    }else{
                        console.log(this.log() + "The login seems to have failed. Attempting again...");
                    }
                    console.log(this.log() + "Clearing browser cookies...");
                    const client = await page.target().createCDPSession();
                    await client.send('Network.clearBrowserCookies');
                    await client.send('Network.clearBrowserCache');
                    return false
                }
            }catch(err) {
                incrementFails()
                console.log(this.log() + "Login error: " + err);
                return false;
            }     

            console.log(this.log() + "Login complete.");

            console.log(this.log() + "Gathering cookies...");

            const networkCookies = await page._client.send('Network.getAllCookies');
        
            networkCookies.cookies.forEach((cookieData, index, arr) => { 
                if(PUTTERS_URL.toLowerCase().includes(cookieData.domain.toLowerCase())) {
                    this.cookieJar[cookieData.name] = cookieData.value
                }      
            });  
        
            this.simulateActivity()

            return true
        }
        
        async pinging() {
            const headers = {
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "referrer": "https://www.scottycameron.com/",
                "referrerPolicy": "no-referrer-when-downgrade",  
                "User-Agent": this.user_agent, 
                //"Accept-Encoding": "gzip, deflate, br", // leave this out or data will come out as  ���
                "Upgrade-Insecure-Requests": "1",
                //"Cookie": cookies_list
            }
        
            if(this.test_Product_URL) {
                //console.log(this.log() + "Using hard coded product url...")
                //selectedProductURL = test_Product_URL
                return true;
            }
        
            let initPlaceholders = []
            while(initPlaceholders.length == 0) {
                try{
                    initPlaceholders = []
                    console.log(this.log() + "Initial ping...")
                    let res = await this.get(PUTTERS_URL, headers);
                    let content = res.content
                    let root = HTMLParser.parse(content);
                    let nodes = root.querySelectorAll("h4[class='title']")
                    for (let x in nodes) {
                        let link = nodes[x].firstChild.getAttribute("href");
                        console.log(this.log() + `Detected placeholder product #${parseInt(x) + 1}: ` + link);
                        initPlaceholders.push(link)
                    }
                }catch(err) {
                    console.log(this.log() + "Inital ping error: " + err)
                }
                await sleep(1000)
            }

            while(this.selectedProductURL == "") {
                try{
                    console.log(this.log() + "Pinging...")
                    let res = await this.get(PUTTERS_URL, headers);
                    let root = HTMLParser.parse(res.content);
                    this.updateCookieJar(res)
                    let nodes = root.querySelectorAll("h4[class='title']")
                    let newLinks = []
                    for (let x in nodes) {
                        let link = nodes[x].firstChild.getAttribute("href");
                        newLinks.push(link)
                    }
                
                    if(newLinks && Array.isArray(newLinks) && newLinks.length > 0 && (initPlaceholders[0] !== newLinks[0])) {
                        for (let i in newLinks) {
                            let link = newLinks[i]
                            console.log(this.log() + `Detected NEW product #${parseInt(i) + 1}: ` + link)
                        }
                        
                        let targetIndex = this.targetPutterNumber - 1
                        
                        if(targetIndex > newLinks.length - 1) {
                            targetIndex = randInt(0, newLinks.length - 1);
                        }
        
                        this.selectedProductURL = newLinks[targetIndex]

                        if(this.selectedProductURL) {
                            console.log(this.log() + `Selected product #${targetIndex+1}: ` + this.selectedProductURL)
                            return true;
                        } else{
                            initPlaceholders = newLinks
                            console.log(this.log() + `Selected product is NOT VALID: #${targetIndex+1}: ` + this.selectedProductURL)
                        }
                    }
                }catch(err) {
                    console.log(this.log() + "Pinging error: " + err)
                }
                await sleep(this.pinging_delay)
            }

            return false;
        }
        
        async productpage(){
            //await page.goto(selectedProductURL || test_Product_URL, { waitUntil: 'networkidle2' }); 
            if(!this.selectedProductURL.endsWith("/")) {
                this.selectedProductURL += "/"
            }
            console.log(this.log() + "Going to product page: " + this.selectedProductURL);
        
            const headers = {
                "Upgrade-Insecure-Requests": "1",
                "User-Agent": this.user_agent, 
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-User": "?1",
                "Sec-Fetch-Dest": "document",
                "sec-ch-ua": this._sec_ch_ua,
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": this._sec_ch_ua_platform,
                "Referer": (this.selectedProductURL != this.test_Product_URL ? PUTTERS_URL : "https://www.scottycameron.com/"),
                //"Accept-Encoding": "gzip, deflate, br",// leave this out or data will come out as  ���
                "Accept-Language": "en-US,en;q=0.9",
                "Cookie": this.getCookieString()
            }
        
            const parsePageContent = (content) => {
                console.log(this.log() + "Parsing product page content...");
                {
                    var target = "data-id=";
                    var index = content.indexOf(target);
                    var start = index + target.length + 1;
                    var data = content.substr(start);
                    var len = data.indexOf("\"");
                    this.dataid = data.substr(0, len);
                    console.log(this.log() + "dataid = " + this.dataid)
                }
                {
                    var target = "data-sku=";
                    var index = content.indexOf(target);
                    var start = index + target.length + 1;
                    var data = content.substr(start);
                    var len = data.indexOf("\"");
                    this.datasku = data.substr(0, len);
                    console.log(this.log() + "datasku = " + this.datasku)
                }
                {
                    //var target = "data-parentProductId=";
                    //var index = content.indexOf(target);
                    //var start = index + target.length + 1;
                    //var data = content.substr(start);
                    //var len = data.indexOf("\"");
                    this.parentproductid = this.dataid;// data.substr(0, len);
                    console.log(this.log() + "parentproductid = " + this.dataid)
                }
                {
                    var target = "__RequestVerificationToken";
                    var index = content.indexOf(target);
                    var start = index + target.length + 1;
                    var updatedContent = content.substr(start);
        
                    target = "value=";
                    index = updatedContent.indexOf(target);
                    start = index + target.length + 1;
                    var data = updatedContent.substr(start);
        
                    var len = data.indexOf("\"");// min - 1;
                    this.requestverificationtoken = data.substr(0, len);
                    console.log(this.log() + "requestverificationtoken = " + this.requestverificationtoken)
                }
                {
                    var target = "xpid:";
                    var index = content.indexOf(target);
                    var start = index + target.length + 1;
                    var data = content.substr(start);
                    var len = data.indexOf("\"");
                    this.xpid = data.substr(0, len);
                    console.log(this.log() + "xpid = " + this.xpid)
                }
            }
        
            try{
                let res = await this.get(this.selectedProductURL, headers); 
                parsePageContent(res.content)
                this.updateCookieJar(res)
                console.log(this.log() + "Product page processed.");
                return true;
            }catch(err) {
                console.log(this.log() + "Product page error: " + err)
            }
            return false
        }
        
        async atc(){
            const _ATC_URL = 'https://www.scottycameron.com/store/scottyproduct/addtocartproduct';  
            console.log(this.log() + "Adding to cart...");
            const headers = {
                "Connection": "keep-alive", //?? needed??
                "sec-ch-ua": this._sec_ch_ua,
                "X-NewRelic-ID": this.xpid,
                "sec-ch-ua-mobile": '"?0"',
                "User-Agent": this.user_agent, 
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "*/*",
                "X-Requested-With": "XMLHttpRequest",
                "sec-ch-ua-platform": this._sec_ch_ua_platform,   
                "Origin": "https://www.scottycameron.com",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "document",
                "Referrer": this.selectedProductURL,
                //"Accept-Encoding": "gzip, deflate, br",// leave this out or data will come out as  ���
                "Accept-Language": "en-US,en;q=0.9",
                "Cookie": this.getCookieString()  
            }
            const postData = `ProductId=${this.dataid}&SKU=${this.datasku}&ProductType=SimpleProduct&Quantity=1&ParentProductId=${this.parentproductid}&ConfigurableProductSKUs=&AddOnProductSKUs=&PersonalisedCodes=&PersonalisedValues=&IsRedirectToCart=False&__RequestVerificationToken=${this.requestverificationtoken}&IsProductEdit=undefined&X-Requested-With=XMLHttpRequest`;         
        
            try{
                const res = await this.post(_ATC_URL, headers, postData);       
                this.updateCookieJar(res);
                console.log(this.log() + "ATC complete.");
                return true;
            }catch(err) {
                console.log(this.log() + "ATC error: "+ err);
                return false;
            }
        }
        
        async fastCheckout(){
            const CHECKOUT_URL = 'https://www.scottycameron.com/store/checkout/index/';  
            console.log(this.log() + "Accessing fast checkout...");
            const headers = {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "Accept-Language": "en-US,en;q=0.9",
                "Connection": "keep-alive", //?? needed??
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-User": "?1",
                "Referrer": this.selectedProductURL,
                "User-Agent": this.user_agent, 
                //"Accept-Encoding": "gzip, deflate, br",// leave this out or data will come out as  ���
                "Upgrade-Insecure-Requests": "1",
                "Cookie": this.getCookieString()      
            }
                
            try{
                const res = await this.get(CHECKOUT_URL, headers);       
                this.updateCookieJar(res);
                console.log(this.log() + "Fast Checkout complete.");
                return true;
            }catch(err) {
                console.log(this.log() + "Fast Checkout error: "+ err);
                return false;
            }
        }
        
        async submitOrder(){
            const ORDER_URL = 'https://www.scottycameron.com/store/checkout/submitorder/';  
            console.log(this.log() + "Submitting order...");
            const cookiesString = this.getCookieString() 
            let formatedCookiesString = ''
            //for (let property in this.cookieJar){
                //formatedCookiesString += '\t' + property + ": " + this.cookieJar[property] + "\n\n";
            //}
            //console.log(this.log() + 'Submit order cookies: ')
            //console.log(formatedCookiesString)
            console.log(this.log() + 'SSubmit order cookie string: ' + cookiesString)
            console.log()

            const headers = {
                "Connection": "keep-alive", //?? needed??
                "sec-ch-ua": this._sec_ch_ua,
                "X-NewRelic-ID": this.xpid,
                "sec-ch-ua-mobile": '"?0"',
                "User-Agent": this.user_agent, 
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "*/*",
                "X-Requested-With": "XMLHttpRequest",
                "sec-ch-ua-platform": this._sec_ch_ua_platform,   
                "Origin": "https://www.scottycameron.com",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
                "Referrer": "https://www.scottycameron.com/store/checkout/index/",
                //"Accept-Encoding": "gzip, deflate, br",// leave this out or data will come out as  ���
                "Accept-Language": "en-US,en;q=0.9",
                "Cookie": cookiesString
            }
        
            var postData = this.order_post_data
        
            try{
                var token = "";
                if(this.h_tokens.length == 0) {
                    this.getHCaptchaToken()
                    console.log(this.log() + "Waiting for token...")
                    while(this.h_tokens.length == 0) {
                        await sleep(400)
                    }
                }
                token = this.h_tokens.pop();
                postData += "&Custom1=" + token;
                postData += "&Custom2=1";
                const res = await this.post(ORDER_URL, headers, postData);  
                console.log(this.log() + "Order Response:\n\n" + res.content + "\n\n") 
                this.task_complete = true
                return true;
            }catch(err) {
                console.log(this.log() + "Order error: "+ err);
                this.task_complete = true
                return false;
            }
        }
        
        async run(){
            console.log(">>> PRESS Ctrl-C to terminate the program at any time <<<<")
            console.log(">>> PRESS Ctrl-C to terminate the program at any time <<<<")
            console.log(">>> Running Scotty v5 <<<")

            if(this.test_Product_URL) {
                this.selectedProductURL = this.test_Product_URL
                console.log(this.log() + "Checking out test product: " + this.test_Product_URL)
                console.log(this.log() + "Starting checkout in...")
                console.log(this.log() + "3...")
                await sleep(1000)
                console.log(this.log() + "2...")
                await sleep(1000)
                console.log(this.log() + "1...")
                await sleep(1000)
            } else{
                console.log(this.log() + `Aiming for putter #${this.targetPutterNumber}.`)

                if(!this.force_user_confirm_login) {
                    console.log(this.log() + "HANDS FREE MODE INITAITED (no need to confirm login)")

                    const programResumeMessage = "Program will resume at 11:27:30"
                    
                    let canStart = () => {
                        let {hour, minute, seconds}  = getTime() 
                        if(hour == 11 && minute >= 27 && seconds >= 30) {
                            return true
                        }
                        if(((minute == 30 || minute == 0) && seconds == 0) && (minute != this.pausedMin && seconds != this.pausedSec)) {
                            console.log(this.log() + programResumeMessage)
                            this.pausedMin = minute
                            this.pausedSec = seconds
                        }
                        return false
                    }

                    console.log(this.log() + "Program will auto shutdown at 11:32:00")
                    this.autoShutdown()

                    if(!canStart()) {
                        console.log(this.log() + 'PAUSED. ' + programResumeMessage)
                        while(!canStart()) {
                            await sleep(900)
                        }
                    }
                }
            }

            console.log(this.log() + "Program resumed.")
        
            this.user_agent = this.winUserAgent;
            this._sec_ch_ua_platform = '"Windows"';
            var isMac = false
            let useMacChrome = false
            if (process.platform == 'darwin') {
                isMac = true
                this._sec_ch_ua_platform = '"macOS"';
                console.log(this.log() + `MacOS Detected`)
                this.user_agent = this.macUserAgent
                const browsers = await detectAllBrowsers()
                for(let i in browsers) {
                    let b = browsers[i]
                    if(b.name == 'Google Chrome') {
                        useMacChrome = true
                        break;
                    }
                }
            }

            const windowsChromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
            const macChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" //Found at chrome://version  
        
            let proxyUrl = ""
            if(this.proxy_host) {
                proxyUrl = this.proxy_host + ":" + this.proxy_port;
                if(this.proxy_user) {
                    const oldProxyUrl = "http://" + this.proxy_user + ":" + this.proxy_pass + "@" + this.proxy_host + ":" + this.proxy_port;
                    proxyUrl = await proxyChain.anonymizeProxy(oldProxyUrl);
                }
            }
            
            const options = {
                headless: false,
                args: [ '--no-sandbox',
                '--disable-setuid-sandbox',
                (this.proxy_host ? `--proxy-server=${proxyUrl}` : ''),
                `--window-size=${randInt(950,1200)},${randInt(700,850)}`],             
            }
            
            let usingWindowsChrome = false
            if(useMacChrome) {
                console.log(this.log() + `Launching the system installed Google Chrome for Mac`)
                options['executablePath'] = macChromePath
            }else{
                if(fs.existsSync(windowsChromePath)){
                    console.log(this.log() + `Launching the system installed Google Chrome for Windows`)
                    usingWindowsChrome = true
                    options['executablePath'] = windowsChromePath
                }else{
                    console.log(this.log() + `Launching default Chromium build`)
                }
            }
            
            const stealth = StealthPlugin()
        
            if(useMacChrome || usingWindowsChrome) {
                stealth.enabledEvasions.delete('chrome.app')
                stealth.enabledEvasions.delete('chrome.csi')
                stealth.enabledEvasions.delete('chrome.loadTimes')
                stealth.enabledEvasions.delete('chrome.runtime')
                //stealth.enabledEvasions.delete('defaultArgs')
                //stealth.enabledEvasions.delete('iframe.contentWindow')
                stealth.enabledEvasions.delete('media.codecs')
                stealth.enabledEvasions.delete('navigator.hardwareConcurrency')
                stealth.enabledEvasions.delete('navigator.languages')
                stealth.enabledEvasions.delete('navigator.permissions')
                stealth.enabledEvasions.delete('navigator.plugins')
                //stealth.enabledEvasions.delete('navigator.webdriver')
                //stealth.enabledEvasions.delete('sourceurl')
                //stealth.enabledEvasions.delete('user-agent-override')
                stealth.enabledEvasions.delete('webgl.vendor')
                //stealth.enabledEvasions.delete('window.outerdimensions')
            }
        
            stealth.enabledEvasions.delete('user-agent-override')
        
            puppeteer.use(stealth)
            
            const UserAgentOverride = require('puppeteer-extra-plugin-stealth/evasions/user-agent-override')
            puppeteer.use(UserAgentOverride({
                userAgent: this.user_agent,
                locale: 'en-US,en'
            }))
        
            if((isMac && !useMacChrome) || (!usingWindowsChrome)) {
                const webGlVendor = require('puppeteer-extra-plugin-stealth/evasions/webgl.vendor')
                if(!useMacChrome) {
                    //this means using mac chromium
                    puppeteer.use(webGlVendor({
                        vendor: 'Google Inc. (Apple)',
                        renderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)'
                    }))
                }else if(!isMac && !usingWindowsChrome){
                    //this means using windows chromium
                    puppeteer.use(webGlVendor({
                        vendor: 'Google Inc. (Intel)',
                        renderer: 'ANGLE (Intel(R) HD Graphics 630 Direct3D11 vs_5_0 ps_5_0)'
                    }))
                }
            }
        
            const browser = await puppeteer.launch(options);
        
            const page = (await browser.pages())[0];
        
            //await page.goto('https://pixelscan.net/', { waitUntil: 'networkidle2' });   
            //await page.goto('http://f.vision/', { waitUntil: 'networkidle2' });         
            //return
        
            console.log(this.log() + 'Starting task')
        
            try{
                if(this.proxy_host) {
                    console.log(this.log() + 'Using proxy: ' + this.proxy_host)
                    this.get("https://api.my-ip.io/ip",{}).then(res => {
                        console.log(this.log() + "Proxy IP: " + res.content)
                    }).catch( err=> {
                        console.log(err)
                    });    
                }else{
                    console.log(this.log() + 'No proxy. Using localhost')
                }
            }catch(err) {
                console.log(err)
            }
        
            this.browser = browser
            this.page = page

            while(!(await this.login())) {
                await sleep(400)
            }
        
            if(await this.pinging()) {
                    if(await this.productpage()) {
                        if(await this.atc()) {
                            if(await this.fastCheckout()) {
                                if(await this.submitOrder()) {
                                    console.log(this.log() + 'Task Complete')
                                    console.log()
                                }
                            }
                        }
                    }
            }
        
            await browser.close()
            console.log('Program ended.')
        }
    }
})()




