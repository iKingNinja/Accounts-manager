importScripts('./loadCached.js');

//Functions

async function getCurrentCookie() {
    return chrome.cookies.get({name: '.ROBLOSECURITY', url: 'https://www.roblox.com'});
}

async function getToken() {
    const cookie = await getCurrentCookie();

    if (!cookie) {
        return undefined;
    }

    const tokenRes = await fetch('https://auth.roblox.com/', {
        method: 'POST',
        headers: {
            'Cookie': `.ROBLOSECURITY=${cookie.value}`
        }
    }).catch(() => {
        console.log('Failed to fetch x-csrf-token');
    })

    if (!tokenRes.ok) {
        return tokenRes.headers.get('x-csrf-token');
    }
}

var userData = {};

async function getCurrentUserData(cookie) {
    if (!cookie) {
        return userData = {};
    }

    const userDataRes = await fetch('https://www.roblox.com/my/account/json', {
        headers: {
            'Cookie': `.ROBLOSECURITY=${cookie.value}`
        }
    }).catch((error) => {
        return console.log(error);
    })

    const data = await userDataRes.json();

    return data;
}

function isCurrentTabRoblox(tabUrl) {
    if (!tabUrl) {
        return false;
    }

    if (tabUrl.includes('.roblox.com')) {
        return true;
    }
}

const tabsWithPopup = [];

function isPopupInjectedInTab(tabId) {
    return tabsWithPopup.find(id => id == tabId);
}

async function injectPopup() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({currentWindow: true}, async (tabs) => {
            for (const tab of tabs) {
                if (isPopupInjectedInTab(tab.id)) {
                    continue;
                }
    
                if (isCurrentTabRoblox(tab.url)) {
                    chrome.scripting.executeScript({
                        target: {tabId: tab.id},
                        files: ['./popup.js']
                    })
    
                    tabsWithPopup.push(tab.id);
                }
            }

            resolve(true);
        })
    })
}

async function getSavedAccounts() {
    return chrome.storage.sync.get('accounts');
}

async function promptSave(details, tabId) {
    const cookie = await getCurrentCookie();
    const userDataRes = await fetch('https://www.roblox.com/my/account/json', {
        headers: {
            'Cookie': `.ROBLOSECURITY=${cookie.value}`
        }
    }).catch((error) => {
        console.log(error);

        return retrySave(details, tabId);
    })

    if (!userDataRes.ok) {
        retrySave(details, tabId);
    }

    userData = await userDataRes.json();

    const amCookie = await chrome.cookies.get({name: `AM.ROBLOSECURITY.${userData.UserId}`, url: 'https://www.roblox.com'});
    const savedAccountsCheck = await getSavedAccounts();

    if (amCookie && savedAccountsCheck) {
        if (savedAccountsCheck.accounts && savedAccountsCheck.accounts[userData.UserId]) return;
    }

    const saveDecision = await chrome.scripting.executeScript({
        target: {tabId: details.tabId},
        func: function() {
            const result = window.confirm('Do you want to save this account?');
            return result;
        }
    })

    if (saveDecision[0]) {
        const userId = userData.UserId;
        const avatarRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=48x48&format=Png&isCircular=false`).catch((error) => {
            console.log(error);

            return retrySave(details, tabId);
        });

        if (!avatarRes.ok) {
            return retrySave(details, tabId);
        }

        const fetchedAvatar = await avatarRes.json();
        const savedAccountsSave = await getSavedAccounts() || {};
        const savedAccountsSaveData = savedAccountsSave.accounts || {};
        const dataToSave = {
            userId: userId,
            username: userData.Name,
            avatarHeadshotURL: fetchedAvatar.data[0].imageUrl
        }

        savedAccountsSaveData[userId] = dataToSave;

        await chrome.cookies.set({
            domain: cookie.domain,
            expirationDate: cookie.expirationDate,
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            name: `AM.ROBLOSECURITY.${userId}`,
            value: cookie.value,
            url: 'https://www.roblox.com/',
            path: '/'
        })
        chrome.storage.sync.set({accounts: savedAccountsSaveData});
    }
}

async function retrySave(details, tabId) {
    const retryResponse = await chrome.scripting.executeScript({
        target: {tabId: tabId},
        func: function() {
            const result = window.confirm('Could not fetch account data, do you want to retry?');
            return result;
        }
    })

    if (retryResponse[0]) {
        promptSave(details, tabId);
    }
}

async function removeAccount(removeCookie, userId) {
    const id = userId || userData.UserId;
    const savedAccountsData = await getSavedAccounts() || {};
    const accountsData = savedAccountsData.accounts || {};

    if (removeCookie) {
        chrome.cookies.remove({
            name: `AM.ROBLOSECURITY.${id}`,
            url: 'https://www.roblox.com/'
        })
    }
    
    delete accountsData[id];

    chrome.storage.sync.set({accounts: accountsData});
}

async function isUseAllowed() {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});

    if (!isCurrentTabRoblox(tabs[0].url)) {
        return {
            allowed: false,
            reason: 'not_roblox'
        };
    }

    const cookie = await getCurrentCookie();
    const savedAccountsData = await getSavedAccounts() || {};
    const accounts = savedAccountsData.accounts;

    if (!cookie && (!accounts || Object.keys(accounts).length < 1)) {
        return {
            allowed: false,
            reason: 'login_no_account'
        }
    }

    return {
        allowed: true
    }
}

async function reloadCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: function() {
            location.reload();
        }
    })
}

async function logoutIfNotSaved() {
    const savedAccountsData = await getSavedAccounts() || {};
    const savedAccounts = savedAccountsData.accounts || {};
    const cookie = await getCurrentCookie();
    const token = await getToken();

    if (!savedAccounts[userData.UserId]) {
        console.log('Adding/switching account, the current account was not saved: logging the current account out.');

        const logoutRes = await fetch('https://auth.roblox.com/v1/logout', {
            method: 'POST',
            headers: {
                'Cookie': `.ROBLOSECURITY.${cookie.value}`,
                'x-csrf-token': token
            }
        }).catch(() => {
            return console.log('Failed to logout user: could not start add_account process.');
        })

        if (!logoutRes.ok) {
            return console.log('Failed to logout user: could not start add_account process.');
        }
    }
}

async function clearStorages() { //clear all session storage and local storage data to not mix accounts data
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});

    chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: function() {
            window.localStorage.clear();
            window.sessionStorage.clear();
        }
    })
}

function logWarning() {
    console.log('%c ATTENTION!', 'color: red; font-size: 70px;');
    console.log('%c Editing data here can lead to the extension to not work correctly.', 'color: white; font-size: 27px;');
    console.log('%c Do NOT paste code that you do not understand here as it can be malicious and lead to your accounts getting compromised!', 'color: white; font-size: 27px;');
}

//Events

chrome.runtime.onInstalled.addListener(async () => {
    const oldCookiesFound = await scanForOldCookies();

    if (oldCookiesFound) {
        chrome.tabs.query({currentWindow: true}, async (tabs) => {
            const robloxTabs = tabs.filter(tab => tab.url.includes('https://www.roblox.com'));
            
            if (robloxTabs.length > 0) {
                const firstTab = robloxTabs[0];
                const tabId = firstTab.id;
    
                const restoreDecision = await chrome.scripting.executeScript({
                    target: {tabId: tabId},
                    func: function() {
                        return window.confirm('Previously saved accounts were found: do you want to restore them?')
                    }
                })
    
                if (restoreDecision[0].result) {
                    restoreOldAccounts();
                }
            }
        })
    }
})

chrome.tabs.onUpdated.addListener((id, info) => {
    if (info.status == 'complete') {
        injectPopup();
    }
});

chrome.tabs.onAttached.addListener(injectPopup);

chrome.tabs.onRemoved.addListener((tabId) => {
    if (isPopupInjectedInTab(tabId)) {
        tabsWithPopup.splice(tabsWithPopup.indexOf(tabId));
    }
})

chrome.webRequest.onCompleted.addListener(async (details) => {
    const id = details.tabId;

    if (details.statusCode !== 200) {
        return;
    }

    async function onLoginUpdated(tabId, info) {
        if (info.status == 'complete' && tabId == id) {
            chrome.tabs.onUpdated.removeListener(onLoginUpdated);

            promptSave(details, tabId);
        }
    }
    
    chrome.tabs.onUpdated.addListener(onLoginUpdated);
}, {urls: ['https://auth.roblox.com/v2/login']});

chrome.webRequest.onBeforeRequest.addListener(() => {
    removeAccount(true);
}, {urls: ['https://auth.roblox.com/v2/logout']});

chrome.cookies.onChanged.addListener((info) => {
    if (info.removed && info.cookie.name.includes('AM.ROBLOSECURITY.') && info.cause != 'overwrite') {
        const userId = info.cookie.name.split('AM.ROBLOSECURITY.')[1];

        removeAccount(false, userId);
    }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type == 'is_use_allowed') {
        (async () => {
            const isAllowed = await isUseAllowed();

            sendResponse(isAllowed);
        })()

        return true;
    } else if (message.type == 'get_accounts_data') {
        (async () => {
            const savedAccountsData = await getSavedAccounts() || {};
            const accountsData = savedAccountsData.accounts || {};

            sendResponse(accountsData);
        })();

        return true;
    } else if (message.type == 'add_account') {
        (async () => {
            await logoutIfNotSaved();

            chrome.cookies.remove({name: '.ROBLOSECURITY', url: 'https://www.roblox.com'});
            userData = await getCurrentUserData();

            clearStorages();
            reloadCurrentTab();

            sendResponse(true);
        })();

        return true;
    } else if (message.type == 'switch_account') {
        (async () => {
            const userId = message.userId;

            const amCookie = await chrome.cookies.get({name: `AM.ROBLOSECURITY.${userId}`, url: 'https://www.roblox.com/'});

            if (!amCookie) {
                return sendResponse(false);
            }

            await logoutIfNotSaved();
            clearStorages();
            
            const cookie = await chrome.cookies.set({
                domain: amCookie.domain,
                expirationDate: amCookie.expirationDate,
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                name: `.ROBLOSECURITY`,
                value: amCookie.value,
                url: 'https://www.roblox.com/',
                path: '/'
            })

            userData = await getCurrentUserData(cookie);

            reloadCurrentTab();

            sendResponse(true);
        })();

        return true;
    } else if (message.type == 'remove_account') {
        removeAccount(true);
    }
});

//Initialization

(async () => {
    injectPopup();

    const cookie = await getCurrentCookie();

    if (cookie) {
        userData = await getCurrentUserData(cookie);
    }

    logWarning()
    setInterval(logWarning, 3 * 6000);
})()