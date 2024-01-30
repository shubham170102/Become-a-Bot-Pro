const puppeteer = require('puppeteer-extra');
const { createCursor } = require( "ghost-cursor")
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const HOME_URL = "https://www.bestbuy.com/"
const LOGIN_URL = 'https://www.bestbuy.com/identity/signin?token=tid%3Af7f231d9-3215-11ed-a7fd-0ac9086885a9'
const PRODUCT_URL = 'https://www.bestbuy.com/site/dell-inspiron-3515-15-6-non-touch-laptop-amd-ryzen-5-8gb-memory-256gb-solid-state-drive-carbon-black/6508652.p?skuId=6508652'

const EMAIL = ''
const PASSWORD = ''
const CARD_NUMBER = '376742560751078'
const CVV = '9195'


//document.querySelector("input[class='tb-input tb-input']")

async function givePage(){
    const browser = await puppeteer.launch({headless: false})
    const page = await browser.newPage()
    return [browser, page]
}

async function login(page) {
    await page.goto(HOME_URL, {waitUntil: 'networkidle0'})
    await page.evaluate(() => document.querySelector("a[href='/identity/global/signin']").click())

    await page.waitForNavigation({waitUntil:'networkidle0'})
    await page.type('#fld-e', EMAIL)
    await page.type('#fld-p1', PASSWORD)

    let res = false
    res = await page.evaluate(() => {
        document.getElementsByClassName('c-button c-button-secondary c-button-lg c-button-block c-button-icon c-button-icon-leading cia-form__controls__submit')[0].click()
        return true
    })    
    
    await page.waitForNavigation({waitUntil: 'networkidle0'})
    return res
}

async function atc(page) {
    await page.goto(PRODUCT_URL, {waitUntil: 'networkidle2'})

    const cursor = createCursor(page)

    let selector = "button[class='c-button c-button-primary c-button-lg c-button-block c-button-icon c-button-icon-leading add-to-cart-button']"
    await page.waitForSelector(selector)
    await cursor.move(selector)

    console.log('Clicking ATC button now...\n')
    try {
        await page.click(selector)
    } catch (ex){
        console.error(ex)
        return false
    }

    await page.waitForNavigation()
    await page.goto("https://www.bestbuy.com/cart", {waitUntil: 'networkidle2'})
    return true
}

async function shipping(page){
    await page.waitFor(2000)
    let cursor = createCursor(page)

    let selector = "input[class='tb-input tb-input']"

    try {
        await page.waitForSelector(selector)
        await cursor.move(selector)
        await page.click("input[class='tb-input tb-input']", {clickCount: 2})
        await page.type("input[class='tb-input tb-input']", "3")
    } catch (ex) {
        console.error(ex)
        return false
    }

    await page.waitForNavigation({waitUntil: 'networkidle2'})

    selector = "button[data-track='Checkout - Top']"
    
    try {
        await page.waitForSelector(selector)
        await cursor.move(selector)
        await page.click(selector)
    } catch(ex) {
        console.error(ex)
        return false
    }
    
    return true
}

async function payment(page){
    await page.waitFor(3000)

    let cursor = createCursor(page)
    /*let selector = "#number"
    await page.waitForSelector(selector)
    await cursor.move(selector)
    await page.type(selector, CARD_NUMBER)*/

    let selector = "input[id='remember-this-information-for-next-time-taxexmept']"
    try {
        await page.waitForSelector(selector)
        await cursor.move(selector)
        await page.evaluate((selector) => {
            document.getElementsByClassName('c-accordion-trigger-label')[1].click()
            document.querySelector(selector).click()
        }, selector)
        await page.click(selector)
    } catch(ex) {
        console.error(ex)
    }


    selector = "#cvv"
    await page.waitForSelector(selector)
    await cursor.move(selector)
    await page.type(selector, CVV)

    
    selector = "button[class='btn btn-lg btn-block btn-primary']"
    try{
        await page.waitFor(selector)
        await cursor.move(selector)
        await page.click(selector)
        await page.evaluate((s) => document.querySelector(s).click(), selector)
    } catch (ex){
        console.error(ex)
        return false
    }
    
    await page.waitFor(4000)
    return true

}



async function run() {
    var team = await givePage()
    var browser = team[0]
    var page = team[1]

    if(await login(page)) {
        if(await atc(page)) {
            if(await shipping(page)){
                if(await payment(page)){
                    console.log("ORDER SUCCESS!!")
                }
            }
        }
    }

    await page.waitForNavigation({waitUntil:'networkidle2'})
    await page.waitFor(5000)
    await page.close()
    await browser.close()
    await run()
}


run()

