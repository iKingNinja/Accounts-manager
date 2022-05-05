async function isCurrentTabRoblox() {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});

    if (tabs[0].url.includes('.roblox.com')) {
        return true;
    } else {
        return false;
    }
}

async function getCurrentUserCookie() {
    const roblosecurityCookie = await chrome.cookies.get({
        name: '.ROBLOSECURITY',
        url: 'https://www.roblox.com/'
    })

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
        })

        const userSettingsJson = await userSettingsResponse.json();

        const userId = userSettingsJson.UserId;
        const username = userSettingsJson.Name;
        const userAvatarHeadshot = await fetch(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=48&height=48&format=png`);

        return userData = {
            userId: userId,
            username: username,
            avatarURL: userAvatarHeadshot.url
        }
    } catch (error) {
        
    }
}

async function isUseAllowed() {
    const data = {
        isUseAllowed: false
    };

    const tabs = await chrome.tabs.query({active: true, currentWindow: true});

    await tabs[0];

    const tabUrl = tabs[0].url;

    if (!tabUrl.includes('.roblox.com')) {
        data.error = 'not-roblox';
    } else {
        const roblosecurityCookie = await getCurrentUserCookie();

        if (!roblosecurityCookie) {
            const cookies = await chrome.cookies.getAll({url: 'https://www.roblox.com/'});

            if (cookies.find(cookie => cookie.name.includes('AM.ROBLOSECURITY'))) {
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

const tabsWithPopupJSInjected = [];

function injectPopupJS() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0].url.includes('.roblox.com')) {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                files: ['popup.js']
            })

            tabsWithPopupJSInjected.push(tabs[0].id);
        }
    })
}

function isPopupInjected(tabId) {
    if (tabsWithPopupJSInjected.find(id => id == tabId)) {
        return true;
    } else {
        return false;
    }
}

var isPromptSaveShown = false;

async function promptSave(tabId) {
    const amAccounts = await chrome.storage.sync.get('amAccounts').then((data) => {return data.amAccounts}) || [];

    if (amAccounts.map(d => d.userId).find(id => id == userData.userId) || isPromptSaveShown) {
        return;
    }

    isPromptSaveShown = true;

    chrome.scripting.executeScript({
        target: {tabId: tabId},
        func: function() {
            return confirm('Do you want to save this account?');
        }
    }, async function(result) {
        const save = result[0].result;

        if (save) {
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
            })

            if (!amAccounts[userData.userId]) {

                amAccounts.push(userData);
            }

            chrome.storage.sync.set({'amAccounts': amAccounts});
        }

        isPromptSaveShown = false;
        chrome.tabs.onUpdated.removeListener(promptSave);
    })
}

function clearStorages(tabs) {
    chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: function() {
            window.localStorage.clear();
            window.sessionStorage.clear();
        }
    })

    chrome.tabs.onUpdated.removeListener(clearStorages);
}

async function removeAccount() {
    userData = await getCurrentUserData(await getCurrentUserCookie());

    const amAccounts = await chrome.storage.sync.get('amAccounts').then((data) => { return data.amAccounts }) || [];
    const account = amAccounts.find(account => account.userId == userData.userId);
    const index = amAccounts.indexOf(account);

    amAccounts.splice(index, 1);

    chrome.storage.sync.set({ 'amAccounts': amAccounts });

    const amRoblosecurityCookie = await chrome.cookies.get({ name: `AM.ROBLOSECURITY.${userData.userId}`, url: 'https://www.roblox.com/' });

    if (amRoblosecurityCookie) {
        chrome.cookies.remove({ name: `AM.ROBLOSECURITY.${userData.userId}`, url: 'https://www.roblox.com/' });
    }
}

(async () => {
    try {
        userData = await getCurrentUserData(await getCurrentUserCookie())
    } catch (error) {
        
    }
    
})()

chrome.runtime.onInstalled.addListener(async () => {
    if (userData == {}) {
        userData = await getCurrentUserData(await getCurrentUserCookie());
    }
})

chrome.webNavigation.onCompleted.addListener(async function(details) {
    if(details.frameId === 0) {
        const isPopupInjectedInTab = isPopupInjected(details.tabId);

        if (isPopupInjectedInTab) {
            return;
        }

        chrome.tabs.get(details.tabId, function(tab) {
            if(tab.url === details.url) {
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

chrome.tabs.onActivated.addListener(async function(details) {
    if (isPopupInjected(details.tabId)) {
        return;
    }

    if (!await isCurrentTabRoblox()) {
        return;
    }

    injectPopupJS();

    if (userData == {}) {
        userData = await getCurrentUserData(await getCurrentUserCookie());
    }
})

chrome.tabs.onRemoved.addListener(function(tabId) {
    if (isPopupInjected(tabId)) {
        const index = tabsWithPopupJSInjected.indexOf(tabId);

        if (index > -1) {            
            tabsWithPopupJSInjected.splice(index, 1);
        }
    }
})

//Detect login/logout

chrome.webRequest.onCompleted.addListener(async function(details) {
    if (details.statusCode == 200) {
        userData = await getCurrentUserData(await getCurrentUserCookie());

        return chrome.tabs.onUpdated.addListener(promptSave);
    }
}, {urls: ['https://auth.roblox.com/v2/login']})

chrome.webRequest.onBeforeRequest.addListener(async function() {
    const roblosecurityCookie = await chrome.cookies.get({name: '.ROBLOSECURITY', url: 'https://www.roblox.com/'});

    if (roblosecurityCookie) {
        const amRoblosecurityCookie = await chrome.cookies.get({name: `AM.ROBLOSECURITY.${userData.userId}`, url: 'https://www.roblox.com/'});

        if (amRoblosecurityCookie) {
            const amAccounts = await chrome.storage.sync.get('amAccounts').then((data) => {return data.amAccounts}) || [];
            const currentAccount = amAccounts.find(account => account.userId == userData.userId);

            const index = amAccounts.indexOf(currentAccount);

            amAccounts.splice(index, 1);

            chrome.storage.sync.set({'amAccounts': amAccounts});
            chrome.cookies.remove({name: `AM.ROBLOSECURITY.${userData.userId}`, url: 'https://www.roblox.com/'});
        }
    }
}, {urls: ['https://auth.roblox.com/v2/logout']})

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.command) {
        if (request.command == 'get-user-data') {
            (async () => {
                const data = await chrome.storage.sync.get('amAccounts').then((data) => {return data.amAccounts});

                sendResponse(data);
            })()

            return true;
        } else if (request.command == 'is-use-allowed') {
            (async () => {
                const data = await isUseAllowed();

                sendResponse(data);
            })()

            return true;
        } else if (request.command == 'add-account') {
            (async () => {
                userData = {};

                await chrome.cookies.remove({
                    name: '.ROBLOSECURITY',
                    url: 'https://www.roblox.com'
                })

                chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
                    await tabs[0];

                    chrome.scripting.executeScript({
                        target: {tabId: tabs[0].id},
                        func: function() {
                            location.reload();
                        }
                    })
                })
            })()

            sendResponse(true);

            return true;
        } else if (request.command == 'remove-account') {
            (async () => {
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.scripting.executeScript({
                        target: {tabId: tabs[0].id},
                        func: function() {
                            return confirm('Are you sure that you want to remove this account? This action cannot be undone.');
                        }
                    }, function(result) {
                        const remove = result[0].result;

                        if (remove) {
                            removeAccount();
                        }
                    })
                })

                sendResponse(true);
            })()

            return true;
        }
    } else if (request.data) {
        if (request.data.command) {
            if (request.data.command == 'switch-account') {
                (async () => {
                    const userId = request.data.userId;
                    var currentUserId;

                    userData ? currentUserId = userData.userId : undefined;

                    if (userId == currentUserId || !userId) {
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

                    const oldSessionCookies = await chrome.cookies.getAll({url: 'https://www.roblox.com/'});

                    for (const cookie of oldSessionCookies) {
                        if (cookie.name.includes('AM.ROBLOSECURITY.')) {
                            continue;
                        }

                        chrome.cookies.remove({
                            name: cookie.name,
                            url: 'https://www.roblox.com/'
                        })
                    }

                    chrome.cookies.set({
                        domain: '.roblox.com',
                        expirationDate: amRoblosecurityCookie.expirationDate,
                        httpOnly: true,
                        name: '.ROBLOSECURITY',
                        value: amRoblosecurityCookie.value,
                        url: 'https://www.roblox.com/'
                    })

                    sendResponse(true);

                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                        if (tabs[0]) {
                            chrome.tabs.reload(tabs[0].id);

                            chrome.tabs.onUpdated.addListener(clearStorages(tabs));
                        }
                    })

                    userData = await getCurrentUserData(await getCurrentUserCookie());
                })()

                return true;
            }
        }
    }
})