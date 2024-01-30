const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const locateChrome = require('chrome-location');

async function givePage(){
    const browser = await puppeteer.launch({headless: false, executablePath: locateChrome});
    const page = await browser.newPage();
    return page;
}

async function addtoCart(page){

}

async function billing(page){

}

async function submitOrder(page){

}


async function run(){
    const page = await givePage();
    await page.goto();


    //await addtoCart(page);
    //await billing(page);
    //await payment(page);
    //await submitOrder(page);
}


run();