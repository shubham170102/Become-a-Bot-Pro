const puppeteer = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
const prompt = require('prompt-sync')();
const { createCursor } = require('ghost-cursor');
const { PageEmittedEvents } = require('puppeteer');

const locateChrome = require("chrome-location");


puppeteer.use(stealthPlugin());


var REFRESH_DELAY = 5000;
var PAST_DELAY = 30000



var prompter;
var decision_player_1 = "more";
var decision_player_2 = "more";
var BET_AMOUNT = "1";
var START_BET_AMOUNT = BET_AMOUNT;


var URL_LOGIN = 'https://app.prizepicks.com/login';
var URL_DASH = 'https://app.prizepicks.com/';
var URL_PAST = 'https://app.prizepicks.com/my-entries/past-entries'

async function getPage(){
    const browser = await puppeteer.launch({ headless: false, executablePath:locateChrome});
    const page = await browser.newPage();
    return page;
}




//Past

async function handleResult(page){
    await page.goto(URL_PAST);
    await page.waitForTimeout(PAST_DELAY)
    console.log("Bot has arrived at URL_PAST");

    let last_entry = await page.evaluate(() => {
        return document.getElementsByClassName("entry-placed-date")[0].innerText;
    })

    let curr_entry = last_entry
    while(curr_entry === last_entry){
        console.log("Waiting for result...");
        await page.reload();
        console.log("Reloading page...");
        await page.waitForTimeout(PAST_DELAY);
        console.log("Past delay timeout over");
        curr_entry = await page.evaluate(() => {
            return document.getElementsByClassName("entry-placed-date")[0].innerText;
        })
        if(curr_entry == null){
            curr_entry = last_entry;
        }
    }

    //check win, loss , draw

    let result = await page.evaluate(() => {
        return document.getElementsByClassName("status")[0].innerText.toLowerCase()
    })



    if(result == "loss"){
        console.log("Bet lost! Doubling bet amount.");
        BET_AMOUNT *= 2;
        BET_AMOUNT = BET_AMOUNT.toString();

        let flip_player_1 = await page.evaluate(() => {
            let bar = document.getElementsByClassName('progress-indicator')[0];
            if(bar.className.indexOf("loss") >= 0){
                return true;
            } else {
                return false;
            }
        });

        let flip_player_2 = await page.evaluate(() => {
            let bar = document.getElementsByClassName('progress-indicator')[1];
            if(bar.className.indexOf("loss") >= 0){
                return true;
            } else {
                return false;
            }
        });

        if(flip_player_1){
            flipDecision1();
        }

        if(flip_player_2){
            flipDecision2();
        }
        
    } else if (result == "win!"){
        console.log("Bet won! Resetting bet amount to " + START_BET_AMOUNT);
        BET_AMOUNT = START_BET_AMOUNT;
        BET_AMOUNT = BET_AMOUNT.toString();
    } else {
        //Refunded
        console.log("Bet refunded!");
        BET_AMOUNT = BET_AMOUNT.toString();

        let flip_player_1 = await page.evaluate(() => {
            let bar = document.getElementsByClassName('progress-indicator')[0];
            if(bar.className.indexOf("loss") >= 0){
                return true;
            } else {
                return false;
            }
        });

        let flip_player_2 = await page.evaluate(() => {
            let bar = document.getElementsByClassName('progress-indicator')[1];
            if(bar.className.indexOf("loss") >= 0){
                return true;
            } else {
                return false;
            }
        });

        if(flip_player_1){
            flipDecision1();
        }

        if(flip_player_2){
            flipDecision2();
        }
    }

    await page.goto(URL_DASH);
    await monitor(page);
}

function flipDecision1(){
    if(decision_player_1 == "more"){
        decision_player_1  = "less";
    } else {
        decision_player_1  = "more";
    }
}

function flipDecision2(){
    if(decision_player_2  == "more"){
        decision_player_2  = "less";
    } else {
        decision_player_2  = "more";
    }
}


async function placeBet(page){
    console.log("Placing bet...")

    const cursor = createCursor(page);

    await page.evaluate((decision_player_1, decision_player_2) => {

        async function run(){
            let players = document.getElementsByClassName("projection-li");
            let teamsAdded = new Set()

            for(let i = 1; i < players.length; i++){
                let team_name = players[i].querySelector("p[class='team-position']").innerText.split("-")[0].trim();
                if(!teamsAdded.has(team_name)){
                    teamsAdded.add(team_name);
                    if(teamsAdded.size == 1){
                        players[i].querySelector("button[class='" + decision_player_1 + "']").click();
                    }
                    if(teamsAdded.size == 2){
                        players[i].querySelector("button[class='" + decision_player_2 + "']").click();
                        return
                    }
                    await sleep(2000);
                }
            }
        }

        async function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        run();
    }, decision_player_1, decision_player_2)

    console.log("Waiting for bet amount box...");
    try{
        await page.waitForSelector("#entry-input");
        console.log("Entering bet amount...")
    } catch(ex){
        console.error(ex);
    }

    await page.waitForTimeout(3000);
    await cursor.move("input[max='1000']");
    await cursor.click("input[max='1000']");
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    
    await page.type("input[max='1000']", BET_AMOUNT);

    await page.waitForTimeout(3000);
    await page.evaluate(() => {
        document.getElementsByClassName('place-entry-button-container')[0].firstElementChild.click();
    })

    console.log("Bet placed!");
    await page.waitForTimeout(15000);
    await handleResult(page);
}


//document.getElementsByClassName("projection-li")[6].querySelector("button[class='more']").click()
async function monitor(page){
    await page.waitForTimeout(REFRESH_DELAY);
    await page.waitForTimeout(4000);
    console.log("Waiting for players list...")

    await page.evaluate(() => {
        document.getElementsByClassName("league")[1].click();
    })

    await page.waitForTimeout(1200);
   
    let players_available = await page.evaluate(() => {
        return document.getElementsByClassName("projection-li").length > 3;
    });

    if(!players_available) {
        console.log("No players available");
        await page.reload();
        //await page.waitForNavigation();
        await monitor(page);
        return;
    }

    let players_diff_teams = await page.evaluate(() => {
        let teams = new Set();
        let players = document.getElementsByClassName("projection-li");
        for(let i = 1; i < players.length; i++){
            let team_name = players[i].querySelector("p[class='team-position']").innerText.split("-")[0].trim()
            teams.add(team_name);
            if(teams.size >= 2){
                return true
            }
        }

        return false
    })

    if(!players_diff_teams){
        console.log("No players on two different teams available");
        await page.reload();
        await page.waitForNavigation();
        await monitor(page);
        return;
    }

    await placeBet(page);
}


async function run(){

    //let category = prompt("Enter category you want to place a bet for (i.e. points, rebounds): ");
    //let num_entries = prompt("Enter number of entries you want to place at a time: ");
    //num_entries = 1;
    //category = category.toLowerCase().trim();

    /*const page = await getPage();
    await page.goto(URL_LOGIN);
    await page.waitForTimeout(30000);
    await page.waitForTimeout(30000);
    prompter = prompt("Enter key to continue bot once setup is complete: ");

    console.log("Monitoring...")
    await monitor(page);*/

}


run();