const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const url_13 = "https://www.apple.com/shop/buy-iphone/iphone-13";

async function givePage(){
    const browser = await puppeteer.launch({headless: false})
    const page = await browser.newPage();
    return [browser, page];
}

async function atc(page){

    let selector = 'form-selector-input'
    await page.evaluate((s) => document.getElementsByClassName(s)[1].click(), selector)
    await page.waitForTimeout(1000);
    
    selector = "input[value='blue']"
    await page.evaluate((s) => document.querySelector(s).click(), selector)
    await page.waitForTimeout(1000);

    selector = "input[value='128gb']"
    await page.evaluate((s) => document.querySelector(s).click(), selector)
    await page.waitForTimeout(1000);

    selector = "input[value='noTradeIn']"
    await page.evaluate((s) => document.querySelector(s).click(), selector)
    await page.waitForTimeout(1500);

    await page.waitForSelector("input[name='purchase_option_group']")
    await page.evaluate(() => document.querySelectorAll("input[name='purchase_option_group']")[0].click())
    await page.waitForTimeout(2000);

    selector = "input[value='UNLOCKED/US']"
    await page.evaluate((s) => document.querySelector(s).click(), selector)
    await page.waitForTimeout(1500);

    selector = "input[id='applecareplus_59_noapplecare']"
    await page.waitForSelector(selector)
    await page.click(selector, {clickCount: 2})
    
    await page.waitForTimeout(1000);
    await page.click("button[value='add-to-cart']")
    await page.waitForTimeout(3000)
    
    await page.click("button[name='proceed']")
    await page.waitForTimeout(3000)

    await page.click("button[id='shoppingCart.actions.navCheckout']")
    await page.waitForTimeout(3000)

    await page.click("button[id='signIn.guestLogin.guestLogin']")
    await page.waitForTimeout(3000)

    await page.waitForSelector('#rs-checkout-continue-button-bottom')
    await page.waitForTimeout(500)
    await page.evaluate(() => document.getElementById('rs-checkout-continue-button-bottom').click());
}


async function delivery(page) {
    await page.waitForTimeout(3000);
    await page.type("input[name='firstName']", 'Ritesh');
    await page.waitForTimeout(500);
    await page.type("input[name='lastName']", 'Verma');
    await page.waitForTimeout(1000);
    await page.type("input[name='street']", '1820 S.W. 5th Avenue');
    await page.waitForTimeout(1000);

    //Zip code handling
    const input = await page.$("input[name='postalCode']");
    await input.click({clickCount: 3})
    await input.type("97201")

    await page.waitForTimeout(1000)
    await page.type("input[id='checkout.shipping.addressContactEmail.address.emailAddress']", 'rvbusiness1m@gmail.com')
    await page.waitForTimeout(500);
    await page.type("input[id='checkout.shipping.addressContactPhone.address.fullDaytimePhone']", '4437645725')

    await page.waitForTimeout(500)
    await page.evaluate(() => document.querySelector("button[id='rs-checkout-continue-button-bottom']").click());


}


async function payment(page){
    await page.waitForTimeout(2000)
    await page.evaluate(() => document.querySelector("input[name='checkout.billing.billingOptions.selectBillingOption']").click())
    
    let selector = "input[id='checkout.billing.billingOptions.selectedBillingOptions.creditCard.cardInputs.cardInput-0.cardNumber']"
    await page.waitForSelector(selector)
    await page.type(selector,'4263982640269299')

    selector = "input[id='checkout.billing.billingOptions.selectedBillingOptions.creditCard.cardInputs.cardInput-0.expiration']"
    await page.type(selector,'02/26')

    selector = "input[id='checkout.billing.billingOptions.selectedBillingOptions.creditCard.cardInputs.cardInput-0.securityCode']"
    await page.type(selector,'887')

    await page.waitForSelector("button[id='rs-checkout-continue-button-bottom']")
    await page.evaluate(() => document.querySelector("button[id='rs-checkout-continue-button-bottom']").click())

    await page.waitForTimeout(3000)
    await page.evaluate(() => document.querySelector("button[id='rs-checkout-continue-button-bottom']").click())

}

async function run() {
    var arr = await givePage()
    var page = arr[1]
    await page.waitForTimeout(30000)
    await page.goto(url_13, {waitUntil: 'networkidle0' });
    await atc(page)
    await delivery(page)
    await payment(page)
}

run()