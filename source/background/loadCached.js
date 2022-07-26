async function getExtensionCookies() {
    return chrome.cookies.getAll({url: 'https://www.roblox.com'}).then((cookies) => cookies.filter(cookie => cookie.name.includes('AM.ROBLOSECURITY')));
}

async function scanForOldCookies() {
    let cookies = await getExtensionCookies();
    cookies = cookies.filter(cookie => cookie.name.includes('AM.ROBLOSECURITY'));

    if (cookies.length > 0) {
        return true;
    } else {
        return false;
    }
}

async function restoreOldAccounts() {
    const cookies = await getExtensionCookies();
    const savedAccounts = await getSavedAccounts() || {};
    const accounts = savedAccounts.accounts || {};

    for (const cookie of cookies) {
        const value = cookies.value;

        const accountDataRes = await fetch('https://www.roblox.com/my/account/json', {
            headers: {
                Cookie: `.ROBLOSECURITY=${value}`
            }
        });

        if (!accountDataRes.ok) {
            continue;
        }

        const accountDataJson = await accountDataRes.json();

        const userId = accountDataJson.UserId;
        const username = accountDataJson.Name;

        const avatarHeadshotURLRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=48x48&format=Png&isCircular=false`).catch((err) => {
            console.log(err);
        })

        if (!avatarHeadshotURLRes.ok) {
            continue;
        }

        const avatarHeadshotURLJson = await avatarHeadshotURLRes.json();
        const avatarURL = avatarHeadshotURLJson.data[0].imageUrl;

        const data = {
            userId: userId,
            username: username,
            avatarHeadshotURL: avatarURL
        }

        accounts[userId] = data;
    }

    chrome.storage.sync.set({accounts: accounts});
}