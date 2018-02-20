#!/usr/bin/env node


const puppeteer = require('puppeteer');
const moment = require('moment');
const docopt = require('docopt');
const fs = require('fs');
const os = require('os');
const yml = require('js-yaml');


const fill = async (page, selector, value) => {
    await page.focus(selector);
    await page.click(selector, {clickCount: 3});
    await page.waitFor(50);
    await page.keyboard.type(value);
};


const select = async (page, selector, value) => {
    await page.click(selector);
    await page.evaluate((selector, value) => {
        const options = document.querySelectorAll(`${selector} > option`);
        options.forEach(option => {
            if (option.innerHTML.indexOf(value) > -1) {
                option.selected = true;
            }
        });
        element = document.querySelector(selector);
        const event = new Event('change', { bubbles: true });
        event.simulated=true;
        element.dispatchEvent(event);
    }, selector, value);
}


const login = async (page, credentials) => {
    const usernameSelector = '#ctl00_ContentPlaceHolder_UserNameTextBox';
    const passwordSelector = '#ctl00_ContentPlaceHolder_PasswordTextBox';
    const loginButtonSelector = '#ctl00_ContentPlaceHolder_LoginButton';
    const {username, password} = credentials;
    await fill(page, usernameSelector, username);
    await fill(page, passwordSelector, password);
    await page.click(loginButtonSelector);
    await page.waitForNavigation({waitUntil: 'networkidle2'});
};


const track = async (page, {
    date,
    project,
    assignment,
    hours,
    focal,
    description,
    latency,
}) => {
    const outside = '#ctl00_ContentPlaceHolder_FechaLabel';
    const dateSelector = '#ctl00_ContentPlaceHolder_txtFrom';
    const projectSelector = '#ctl00_ContentPlaceHolder_idProyectoDropDownList';
    const hoursSelector = '#ctl00_ContentPlaceHolder_TiempoTextBox';
    const assignmentSelector = '#ctl00_ContentPlaceHolder_idTipoAsignacionDropDownList';
    const descriptionSelector = '#ctl00_ContentPlaceHolder_DescripcionTextBox';
    const focalPointSelector = '#ctl00_ContentPlaceHolder_idFocalPointClientDropDownList';
    const acceptButtonSelector = '#ctl00_ContentPlaceHolder_btnAceptar';

    const dateInput = date.format('DD/MM/YYYY');
    await fill(page, dateSelector, dateInput);
    await page.waitFor(latency);
    await page.click(outside);
    await select(page, projectSelector, project);
    await page.click(outside);
    await page.waitFor(latency);
    await select(page, assignmentSelector, assignment);
    await page.click(outside);
    await page.waitFor(latency);
    await fill(page, hoursSelector, hours);
    await page.click(outside);
    await page.waitFor(latency);
    await page.click(focalPointSelector);
    await select(page, focalPointSelector, focal);
    await page.click(outside);
    await page.waitFor(latency);
    await fill(page, descriptionSelector, description);
    await page.click(outside);
    await page.waitFor(latency);

    // await page.click(acceptButtonSelector);
    // await page.waitForNavigation({waitUntil: 'networkidle2'});
}


/**
 * Fetch the loaded dates from the main timetracker page
 */
const fetchDates = async (page) => {
    const dateTexts = await page.evaluate(() => {
        const elements = document.querySelectorAll('tr>td:first-child')
        return Array.prototype.map.call(elements, e => e.textContent);
    });
    // The last is not a date but an empty string
    const dates = dateTexts.slice(0, -1).map(dt => moment(dt, 'DD-MM-YYYY'));
    return dates;
};


const timeTrackerPage = async (browser, credentials) => {
    const page = await browser.newPage();
    await page.goto('http://timetracker.bairesdev.com');
    await login(page, credentials);
    await page.goto('http://timetracker.bairesdev.com/CargaTimeTracker.aspx');
    page.on('console', msg => console.log('TIME TRACKER:', msg.text()));
    return page;
}



const usage = `
load-tt

A comand line utility to make our lifes a bit easier.

Usage:
    load-tt [options] <message>

Options:
    --date=<date>     Date for the tt load.

`;


(async () => {
    try {
        const arguments = docopt.docopt(usage, {version: 1.0});
        const configStr = fs.readFileSync(os.homedir() + '/.timetracker/config.yml');
        const config = await yml.safeLoad(configStr);
        const browser = await puppeteer.launch({headless: true});
        const timeTracker = await timeTrackerPage(browser, config.credentials);
        const toTrack = {
            ...config.options,
            date: moment(arguments['--date']),
            description: arguments['<message>'],
        };
        await track(timeTracker, toTrack);
        await timeTracker.screenshot({path: 'page.png'});
        await browser.close();
    } catch(e) {
        console.log(e);
        await browser.close();
    }
})();
