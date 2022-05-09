async function isCurrentTabRoblox() {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true}); -//get all open tabs in current window

    if (tabs[0].url.includes('.roblox.com')) { //check if the url of the current tab is a roblox url (domain or subdomain) 
        return true;
    } else {
        return false;
    }
}

async function getCurrentUserCookie() {
    const roblosecurityCookie = await chrome.cookies.get({
        name: '.ROBLOSECURITY',
        url: 'https://www.roblox.com/'
    }) //get the .ROBLOSECURITY cookie of the current user

    return roblosecurityCookie;
}

var userData = {};

async function getCurrentUserData(cookieValue) {
    try {
        const userSettingsResponse = await fetch('https://www.roblox.com/my/settings/json', {
            method: 'GET',
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookieValue}`
            }
        }) //fetch data from user settings to retrieve user ID and username

        const userSettingsJson = await userSettingsResponse.json(); //convert response to JSON

        const userId = userSettingsJson.UserId;
        const username = userSettingsJson.Name;
        const userAvatarHeadshot = await fetch(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=48&height=48&format=png`); //fetch user avatar heads hot from thumbnails api

        return userData = {
            userId: userId,
            username: username,
            avatarURL: userAvatarHeadshot.url
        } //build user data
    } catch (error) {
        
    }
}

async function isUseAllowed() {
    const data = {
        isUseAllowed: false
    };

    const tabs = await chrome.tabs.query({active: true, currentWindow: true});

    await tabs[0]; //wait for the current tab

    const tabUrl = tabs[0].url;

    if (!tabUrl.includes('.roblox.com')) { //check if the url of the current tab is a roblox url (domain or subdomain) 
        data.error = 'not-roblox';
    } else {
        const roblosecurityCookie = await getCurrentUserCookie(); //get THE .ROBLOSECURITY cookie of the current user

        if (!roblosecurityCookie) { //if the returned cookie is null check for a saved account's cookie
            const cookies = await chrome.cookies.getAll({url: 'https://www.roblox.com/'}); //get all roblox cookies

            if (cookies.find(cookie => cookie.name.includes('AM.ROBLOSECURITY'))) { //AM.ROBLOSECURITY is the cookie name format used by the extension for saved cookies
                data.isUseAllowed = true;
            } else {
                data.error = 'not-logged-in';
            }
        } else {
            data.isUseAllowed = true;
        }
    }

    return data;
}

const tabsWithPopupJSInjected = []; //array with popup.js injected

function injectPopupJS() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) { //get all tabs
        if (tabs[0].url.includes('.roblox.com')) {
            chrome.scripting.executeScript({ //execute (inject) popup.js in the current tab
                target: {tabId: tabs[0].id},
                files: ['popup.js']
            })

            tabsWithPopupJSInjected.push(tabs[0].id); //add tab to array to avoid multiple injections
        }
    })
}

function isPopupInjected(tabId) { //check if a tab already has popup.js injected by checking for tab ID presence in array
    if (tabsWithPopupJSInjected.find(id => id == tabId)) {
        return true;
    } else {
        return false;
    }
}

var isPromptSaveShown = false;

async function promptSave(tabId) { //prompt the user to save the logged in account
    const amAccounts = await chrome.storage.sync.get('amAccounts').then((data) => {return data.amAccounts}) || []; //get saved accounts from storage or an empty array if no data was never saved to storage

    if (amAccounts.map(d => d.userId).find(id => id == userData.userId) || isPromptSaveShown) { //map accounts by userId and find the one that matches the current userId. If userId is found then the account is already saved and the prompt must not appear
        return;
    }

    isPromptSaveShown = true;

    chrome.scripting.executeScript({ //execute function in the current tab
        target: {tabId: tabId},
        func: function() {
            return confirm('Do you want to save this account?'); //make a confirm prompt appear and return the user response
        }
    }, async function(result) {
        const save = result[0].result; //get bool user choice returned by the prompt result

        if (save) { //if the user has clicked OK then save will be true and so the account must be saved
            const roblosecurityCookie = await getCurrentUserCookie();

            if (!roblosecurityCookie) {
                return;
            }

            chrome.cookies.set({
                domain: '.roblox.com',
                expirationDate: roblosecurityCookie.expirationDate,
                httpOnly: true,
                name: `AM.ROBLOSECURITY.${userData.userId}`,
                value: roblosecurityCookie.value,
                url: 'https://www.roblox.com/'
            }) //set new AM.ROBLOSECURITY cookie for future use (account switching) 

            if (!amAccounts[userData.userId]) {
                amAccounts.push(userData); //add user to saved users array
            }

            chrome.storage.sync.set({'amAccounts': amAccounts}); //set (update) users array to storage
        }

        isPromptSaveShown = false;
        chrome.tabs.onUpdated.removeListener(promptSave); //remove listener after tab finishes loading
    })
}

function clearStorages(tabs) { //clear all session storage and local storage data to not mix accounts data
    chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: function() {
            window.localStorage.clear();
            window.sessionStorage.clear();
        }
    })

    chrome.tabs.onUpdated.removeListener(clearStorages); //remove listener after tab finishes loading
}

async function removeAccount() { //remove an account from the saved accounts array
    userData = await getCurrentUserData(await getCurrentUserCookie()); //get current user data

    const amAccounts = await chrome.storage.sync.get('amAccounts').then((data) => { return data.amAccounts }) || [];
    const account = amAccounts.find(account => account.userId == userData.userId); //find the current user in in the saved users array
    const index = amAccounts.indexOf(account); //get the index of the user data in the saved users array

    amAccounts.splice(index, 1); //remove the index from the saved accounts array

    chrome.storage.sync.set({ 'amAccounts': amAccounts }); //set (update) saved users array in storage

    const amRoblosecurityCookie = await chrome.cookies.get({ name: `AM.ROBLOSECURITY.${userData.userId}`, url: 'https://www.roblox.com/' }); //get the AM.ROBLOSECURITY cookie of the target account

    if (amRoblosecurityCookie) { //if cookie exists (it has not been manually deleted) then remove it from the cookies
        chrome.cookies.remove({ name: `AM.ROBLOSECURITY.${userData.userId}`, url: 'https://www.roblox.com/' });
    }
}

(async () => {
    try {
        userData = await getCurrentUserData(await getCurrentUserCookie())
    } catch (error) {
        
    }
})() //on startup build userData

chrome.runtime.onInstalled.addListener(async () => {
    if (userData == {}) {
        userData = await getCurrentUserData(await getCurrentUserCookie());
    }
})

chrome.webNavigation.onCompleted.addListener(async function(details) { //listen for every navigation made by the user to detect if the user navigates to a roblox domain and if it happens in a new tab then inject popup.js
    if(details.frameId === 0) { //check for current tab
        const isPopupInjectedInTab = isPopupInjected(details.tabId); //check if popup.js has already been injected

        if (isPopupInjectedInTab) { //if popup.js had already been injected then return
            return;
        }

        chrome.tabs.get(details.tabId, function(tab) { //get current tab
            if(tab.url === details.url) { //ensure that the current tab is the same of the one in which the user navigated, below the same code of injectPopupJS is executed 
                if (tab.url.includes('.roblox.com')) {
                    chrome.scripting.executeScript({
                        target: {tabId: details.tabId},
                        files: ['popup.js']
                    })

                    tabsWithPopupJSInjected.push(details.tabId);
                }
            }
        });

        if (userData == {}) {
            userData = await getCurrentUserData(await getCurrentUserCookie());
        }
    }
});

chrome.tabs.onActivated.addListener(async function(details) { //detect tab changes (if a user clicks on another tab) 
    if (isPopupInjected(details.tabId)) { //check if popup.js had already been injected
        return;
    }

    if (!await isCurrentTabRoblox()) { //if the current tab is not a roblox tab then return
        return;
    }

    injectPopupJS(); //if all the above checks have passed then the current tab is a roblox tab and popup.js has not already been injected in it and so inject it

    if (userData == {}) {
        userData = await getCurrentUserData(await getCurrentUserCookie());
    }
})

chrome.tabs.onRemoved.addListener(function(tabId) { //detect tabs removal (when a tab is closed) 
    if (isPopupInjected(tabId)) {
        const index = tabsWithPopupJSInjected.indexOf(tabId); //get the index of tabId in the array

        if (index > -1) {            
            tabsWithPopupJSInjected.splice(index, 1); //remove the tab from the array as it no longer exists
        }
    }
})

//Detect login/logout

chrome.webRequest.onCompleted.addListener(async function(details) { //detect requests to https://auth.roblox.com/v2/login (the api used by roblox when logging in) 
    if (details.statusCode == 200) { //check if request it successfull as two are made because the first one must fail to retrieve the X-CSRF-TOKEN
        userData = await getCurrentUserData(await getCurrentUserCookie());

        return chrome.tabs.onUpdated.addListener(promptSave); //add listener for tab updates so that once it loads the user is prompted to save the account
    }
}, {urls: ['https://auth.roblox.com/v2/login']}) //specified url to limit detection to only that one

chrome.webRequest.onBeforeRequest.addListener(async function() { //detect request to https://auth.roblox.com/v2/logout (the api used by roblox to logout a user and invalidate the .ROBLOSECURITY cookie. Requests must be intercepted before they are completed because after completstiom the .ROBLOSECURITY cookie is deleted but it's needed
    const roblosecurityCookie = await chrome.cookies.get({name: '.ROBLOSECURITY', url: 'https://www.roblox.com/'}); //get the current roblosecurity cookie

    if (roblosecurityCookie) {
        const amRoblosecurityCookie = await chrome.cookies.get({name: `AM.ROBLOSECURITY.${userData.userId}`, url: 'https://www.roblox.com/'});

        if (amRoblosecurityCookie) {
            const amAccounts = await chrome.storage.sync.get('amAccounts').then((data) => {return data.amAccounts}) || [];
            const currentAccount = amAccounts.find(account => account.userId == userData.userId);

            const index = amAccounts.indexOf(currentAccount);

            amAccounts.splice(index, 1);

            chrome.storage.sync.set({'amAccounts': amAccounts});
            chrome.cookies.remove({name: `AM.ROBLOSECURITY.${userData.userId}`, url: 'https://www.roblox.com/'}); //remove the AM.ROBLOSECURITY cookie as it is no longer valid because the .ROBLOSECURITY will be invalidated
        }
    }
}, {urls: ['https://auth.roblox.com/v2/logout']}) //specified url to limit detection to only that one

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) { //listen for runtime messages
    if (request.command) { //if the request contains a command parameter then check what command has been fired
        if (request.command == 'get-user-data') {
            (async () => {
                const data = await chrome.storage.sync.get('amAccounts').then((data) => {return data.amAccounts}); //get saved accounts

                sendResponse(data); //send that to popup.js (the requester) 
            })()

            return true; //return true because function is asynchronous 
        } else if (request.command == 'is-use-allowed') {
            (async () => {
                const data = await isUseAllowed(); //check if at least one condition is satisfied to allow the use of the extension

                sendResponse(data); //send result to popup.js
            })()

            return true; //return  true because function is asynchronous 
        } else if (request.command == 'add-account') {
            (async () => {
                userData = {};

                await chrome.cookies.remove({
                    name: '.ROBLOSECURITY',
                    url: 'https://www.roblox.com'
                }) //remove the current .ROBLOSECURITY cookie so that after the page is reloaded the user can access the login page

                chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
                    await tabs[0]; //wait for current tab

                    chrome.scripting.executeScript({
                        target: {tabId: tabs[0].id},
                        func: function() {
                            location.reload();
                        }
                    }) //execute code to reload the current tab
                })
            })()

            sendResponse(true);

            return true; //return true because function is asynchronous 
        } else if (request.command == 'remove-account') {
            (async () => {
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.scripting.executeScript({
                        target: {tabId: tabs[0].id},
                        func: function() {
                            return confirm('Are you sure that you want to remove this account? This action cannot be undone.'); //prompt user to confirm account removal and return the result
                        }
                    }, function(result) {
                        const remove = result[0].result; /get user choice (bool) 

                        if (remove) { //if user clicked OK the remove the account from the list
                            removeAccount();
                        }
                    })
                })

                sendResponse(true);
            })()

            return true; //return true because function is asynchronous 
        }
    } else if (request.data) { //if the request does not include a command then check if the request includes a data parameter
        if (request.data.command) {
            if (request.data.command == 'switch-account') {
                (async () => {
                    const userId = request.data.userId; //get userId sent by popup.js
                    var currentUserId;

                    userData ? currentUserId = userData.userId : undefined; //if userData is not undefined then set currentUserId to userData.userId

                    if (userId == currentUserId || !userId) { //if userId is equal to currentUserId then the user wants to switch to the already selected account and nothing must happen 
                        return sendResponse(false);
                    }

                    const roblosecurityCookie = await getCurrentUserCookie();

                    if (roblosecurityCookie) {
                        chrome.cookies.remove({
                            name: '.ROBLOSECURITY',
                            url: 'https://www.roblox.com/'
                        })
                    }

                    const amRoblosecurityCookie = await chrome.cookies.get({name: `AM.ROBLOSECURITY.${userId}`, url: 'https://www.roblox.com'});

                    if (!amRoblosecurityCookie) {
                        return sendResponse(false);
                    }

                    const oldSessionCookies = await chrome.cookies.getAll({url: 'https://www.roblox.com/'}); //get all roblox cookies of the account that is being removed

                    for (const cookie of oldSessionCookies) {
                        if (cookie.name.includes('AM.ROBLOSECURITY.')) { //if cookie is an AM.ROBLOSECURITY then continue (skip) 
                            continue;
                        }

                        chrome.cookies.remove({
                            name: cookie.name,
                            url: 'https://www.roblox.com/'
                        }) //remove the cookie
                    }

                    chrome.cookies.set({
                        domain: '.roblox.com',
                        expirationDate: amRoblosecurityCookie.expirationDate,
                        httpOnly: true,
                        name: '.ROBLOSECURITY',
                        value: amRoblosecurityCookie.value,
                        url: 'https://www.roblox.com/'
                    }) //set new .ROBLOSECURITY with value equal to the one stored in the copy (AM.ROBLOSECURITY) 

                    sendResponse(true);

                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                        if (tabs[0]) {
                            chrome.tabs.reload(tabs[0].id); //reload the current tab

                            chrome.tabs.onUpdated.addListener(clearStorages(tabs)); //clear storages
                        }
                    })

                    userData = await getCurrentUserData(await getCurrentUserCookie()); //get new userData
                })()

                return true; //return true because function is asynchronous 
            }
        }
    }
})
