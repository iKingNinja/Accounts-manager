const accountsHTML = `
<h1 class="title">Accounts manager</h1>
<div class="container" id="container"></div>
<hr>
<button class="addAccount" id="amAddAccount">Add account</button>
<button class="removeAccount" id="amRemoveAccount">Remove account</button>
<script src="../accounts.js"></script>`;

const notLoggedInHTML = `
<h1 class="title">Accounts manager</h1>
<div class="container" id="container"></div>
<p class="message">You must be logged in at least in one account</p>
<script src="../accounts.js"></script>`;

const notOnRobloxHTML = `
<h1 class="title">Accounts manager</h1>
<div class="container" id="container"></div>
<p class="message">This extension only works on Roblox pages</p>
<script src="../accounts.js"></script>`;

const forbiddenReasonsToHTML = {
    not_roblox: notOnRobloxHTML,
    login_no_account: notLoggedInHTML
}

window.addEventListener('load', async function() {
    const body = this.document.getElementById('amPopupBody');
    const isUseAllowed = await browser.runtime.sendMessage({type: 'is_use_allowed'});
    
    if (!isUseAllowed.allowed) {
        return body.innerHTML = forbiddenReasonsToHTML[isUseAllowed.reason];
    }

    body.innerHTML = accountsHTML;

    const addAccountButton = this.document.getElementById('amAddAccount');
    addAccountButton.addEventListener('click', function() {
        browser.runtime.sendMessage({type: 'add_account'});
    })

    const accountsData = await browser.runtime.sendMessage({type: 'get_accounts_data'});
    const removeAccountButton = this.document.getElementById('amRemoveAccount');

    if (Object.keys(accountsData).length < 1) {
        removeAccountButton.style.setProperty('cursor', 'default');
        removeAccountButton.style.setProperty('background-color', '#f5726c');

        return;
    }

    for (const userId in accountsData) {
        const account = accountsData[userId];
        const mainFrame = document.createElement('div');

        const frame = document.createElement('div');
        frame.className = 'accountFrame';
        frame.id = userId;

        const avatarHeadshot = document.createElement('img');
        avatarHeadshot.src = account.avatarHeadshotURL;

        const username = document.createElement('label');
        username.innerText = account.username;
        frame.appendChild(avatarHeadshot);
        frame.appendChild(username);
        mainFrame.appendChild(frame);

        frame.addEventListener('mouseenter', function () {
            frame.style.backgroundColor = '#2e2e2e';
        })

        frame.addEventListener('mouseleave', function () {
            frame.style.backgroundColor = '#3c3c3c';
        })

        frame.addEventListener('click', function () {
            browser.runtime.sendMessage({type: 'switch_account', userId: userId});
        })

        document.getElementById('container').appendChild(mainFrame);
    }

    removeAccountButton.addEventListener('click', function() {
        browser.runtime.sendMessage({type: 'remove_account'});
        window.close();
    })
})