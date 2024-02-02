const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const prompt = require('prompt-sync')();

puppeteer.use(StealthPlugin())
const outOfStockProduct = "https://www.walmart.com/ip/PlayStation-5-Horizon-Forbidden-West-Console-with-Accessory-Set/195988614?from=/search";
const inStockProduct = "https://www.walmart.com/ip/Hisense-58-Class-4K-UHD-LED-LCD-Roku-Smart-TV-HDR-R6-Series-58R6E3/587182688?athbdg=L1200&adsRedirect=true";


//This was created by a bot mentorship student - Priyanshu Jha


async function launchProductPage(){
    const launchPuppeteer = await puppeteer.launch({headless: false});
    const productPage = await launchPuppeteer.newPage();
    //reload page
    //try catch for page not loading
    //sign in first thing if product requires sign in, or manually sign in
    try {
        await productPage.goto(inStockProduct);
    }
    catch (error) {
        console.error("The initial launch of the page was unsuccessful: ", error);
    }
    return productPage;
}

async function productInStock(page){
    let inStock = await page.evaluate(() => {
        let h2Elements = document.querySelectorAll("h2");
        for (let i = 0; i < h2Elements.length; i++){
            if (h2Elements[i].innerText.indexOf("out of stock") > -1){
                return false;
            }
        }
        return true;
    });
    return inStock;
}

async function checkoutProduct(page, protectionPlan){
    const addToCart = await page.waitForSelector("div[data-testid='add-to-cart-section'] > * > * > * > * > * > *");
    await addToCart.click();

    await new Promise(resolve => setTimeout(resolve, 2000));
    const protectionPlanCheckbox = await page.waitForSelector("#ld_checkbox_7");
    if (protectionPlan){
        await protectionPlanCheckbox.click();
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    const addNewAddress = await page.waitForSelector("a[link-identifier='addNewAddress']");
    await addNewAddress.click();

    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.waitForSelector("input[name='firstName']");
    await page.type("input[name='firstName']", "Thon");
    await page.type("input[name='lastName']", "Maker");
    await page.type("#addressLineOne", "2645 Woodward Avenue");
    await page.$eval("input[name='city']", (input) => input.value = "");
    await page.type("input[name='city']", "Detroit");
    await page.$eval("input[name='postalCode']", (input) => input.value = "");
    await page.type("input[name='postalCode']", "48201");
    await page.select("select[name='state']", "MI");
    await page.type("input[name='phone']", "2029182132");
    await page.click("button[type='submit']");
    await enterPaymentDetails(page);
}

async function enterPaymentDetails(page){

    await new Promise(resolve => setTimeout(resolve, 5000));
    const addPaymentMethod = await page.waitForSelector("span[class='underline ws-normal']");
    await addPaymentMethod.click();  

    await new Promise(resolve => setTimeout(resolve, 5000));
    await page.waitForSelector("iframe[title='wallet window']");
    await new Promise(resolve => setTimeout(resolve, 5000));
    let iframeWallet = await page.$("iframe[title='wallet window']");
    let iframeContent = await iframeWallet.contentFrame();
    await iframeContent.type("#cc-number", "6011280856817129");
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    await iframeContent.waitForSelector("select[autocomplete='cc-exp-month']");
    await iframeContent.select("select[autocomplete='cc-exp-month']", "05");
    await iframeContent.select("select[autocomplete='cc-exp-year']", "2029");
    await iframeContent.type("input[name='cvv']", "855");
    await iframeContent.click("button[type='submit']");

}

async function login(page, email, password){
    //document.getElementById("react-aria-1").value = email; does not work
    const account = await page.waitForSelector("a[link-identifier='Account']");
    await account.click();

    await new Promise(resolve => setTimeout(resolve, 2000));
    const signIn = await page.waitForSelector("button[data-testid='sign-in']"); //best results
    await signIn.click();

    await new Promise(resolve => setTimeout(resolve, 12000));
    const emailInput = await page.waitForSelector("#react-aria-1");
    await emailInput.type(email);

    await page.waitForTimeout(1000);
    const continueButton = await page.waitForSelector("#login-continue-button");
    await continueButton.click();

    await new Promise(resolve => setTimeout(resolve, 3000));
    const passwordInput = await page.waitForSelector("#react-aria-4");
    await passwordInput.type(password);

    await page.waitForTimeout(1000);
    const signInButton = await page.waitForSelector("#withpassword-sign-in-button");
    await signInButton.click();
}

//console logs
//page wait

async function run(){
    //let email = prompt("Enter your Walmart account email: ");
    //let password = prompt("Enter your Walmart account password: ");
    let email = "thonmaker344@gmail.com";
    let password = "PistonsAreGarbo123!";
    email = email.trim();
    password = password.trim();
    let productPage = await launchProductPage();
    await new Promise(resolve => setTimeout(resolve, 5000));
    await login(productPage, email, password);
    await new Promise(resolve => setTimeout(resolve, 5000));
    let inStock = false;
    while (!inStock){
        inStock = await productInStock(productPage);
        if (!inStock){
            console.log("This product is out of stock");
            try {
                await productPage.reload();
            }
            catch (error) {
                console.error("A refresh of the page was unsuccessful: ", error);
            }
            await new Promise(resolve => setTimeout(resolve, 7000));
        }
        else{
            console.log("This product is in stock!");
        }
    }
    await checkoutProduct(productPage, true);

}
run();