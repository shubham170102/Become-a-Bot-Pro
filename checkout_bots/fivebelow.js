const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const xlsx = require('xlsx');
puppeteer.use(StealthPlugin());

const locateChrome = require('chrome-location');
const PRODUCT_URL = "https://www.fivebelow.com/products/multicolor-touch-reactive-mushroom-lamp-10in";
var numPerOrder = "2";

var masterMap;
var numProfile = 0;

function registerProfiles(){
    //email, cc#, exp month, exp year, cvv
    let path = "output.xlsx";
    const workbook = xlsx.readFile(path);

    // Assuming that your data is in the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert the data into JSON
    const data = xlsx.utils.sheet_to_json(worksheet);

    // Structure to store the data
    let structuredData = data.map((row) => ({
        email: row.Email,
        creditCardNumber: row['Credit card number'],
        cardExpMonth: row['card exp month'],
        cardExpYear: row['card exp year'],
        cvv: row.cvv
    }));

    return structuredData;

}

async function tryType(page, selector, value){
    console.log('typing');
    try{
        await page.type(selector, value);
    } catch (ex){
        console.log(ex);
    }
}


async function givePage(){
    const browser = await puppeteer.launch({headless: false, executablePath: locateChrome});
    const page = await browser.newPage();
    return page;
}

async function addtoCart(page){

    await page.waitForSelector("button[data-cy='buyBox__addToCartButton']");

    await page.click("input[name='qty']", {clickCount: 3});
    await page.waitForTimeout(500);
    await page.type("input[name='qty']", numPerOrder);
    
    await page.evaluate(() => document.querySelector("#shipToHome").click());
    await page.waitForTimeout(200);

    console.log("Adding item to cart");
    await page.evaluate(() => document.querySelector("button[data-cy='buyBox__addToCartButton']").click());

    return true
}

async function billing(page){

    await page.goto("https://www.fivebelow.com/checkout");
    await page.waitForSelector("#custEmailId");
    console.log("ENTERED BILLING STAGE");

    await page.type("#custEmailId", masterMap[numProfile].email);
    await page.type("#fname", "Ritesh");
    await page.type("#lname", "Verma");
    await page.type("#custAddress", "6252 Gilston Park Road");
    await page.waitForTimeout(1500);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    await page.type("#phoneNo", "4437645725");
    //await page.type("#custCity", "Catonsville");
    //await page.type("#custZipcode", "21228");

    await page.evaluate(() => document.getElementsByTagName("button")[0].click());
}

async function submitOrder(page){

    console.log("Entered PAYMENT stage");
    //VISA, 4485139376074441, 9/2025, 354
    await page.waitForSelector('#eProtect-iframe');
    let iframeElement = await page.$('#eProtect-iframe'); 
    let frame = await iframeElement.contentFrame();
    await page.waitForTimeout(1500)


    await tryType(frame, "input[id='accountNumber']", masterMap[numProfile].creditCardNumber)
    await frame.type("#cvv", masterMap[numProfile].cvv);
    await frame.select("#expMonth", masterMap[numProfile].cardExpMonth);
    await frame.select("#expYear", masterMap[numProfile].cardExpYear);
    
    await page.waitForTimeout(500)
    await page.evaluate(() => document.getElementsByTagName("button")[0].click());



    await page.waitForTimeout(15000);
}

async function outOfStock(page){
    await page.waitForSelector("button[data-cy='buyBox__addToCartButton']");

    let outOfStock = await page.evaluate(() => {
        return document.querySelector("button[data-cy='buyBox__addToCartButton']").innerText == "sold out";
    });


    return outOfStock;
}


async function run(){

    masterMap = registerProfiles();

    while(true){
        var page = await givePage();
        await page.goto(PRODUCT_URL);
        let res = await outOfStock(page);

        while(res){
            await page.goto(PRODUCT_URL);
            res = await outOfStock(page);
        }

        await addtoCart(page);
        await billing(page);
        await submitOrder(page);
        await page.close();
        numProfile += 1;
        if(numProfile >= masterMap.length){
            numProfile = 0;
        }
        
    }
}


run();


