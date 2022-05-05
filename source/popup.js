var areListenersAttached = false;

const accountsHTML = `
<h1 class="title">Accounts manager</h1>
<div class="container" id="container"></div>
<hr>
<button class="addAccount" id="addAccount">Add account</button>
<button class="removeAccount" id="removeAccount">Remove account</button>
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

window.onload = function() {
    chrome.runtime.sendMessage({command: 'is-use-allowed'}, function(data) {
        if (!data) {
            return;
        }

        if (data.isUseAllowed) {
            document.getElementById('popupBody').innerHTML = accountsHTML;

            chrome.runtime.sendMessage({command: 'get-user-data'}, function(userData) {
                for (const user of userData) {
                    const mainFrame = document.createElement('div');

                    const frame = document.createElement('div');
                    frame.className = 'accountFrame';
                    frame.id = user.userId;

                    const avatarHeadshot = document.createElement('img');
                    avatarHeadshot.src = user.avatarURL;

                    const username = document.createElement('label');
                    username.innerText = user.username;

                    /*const settingsButton = document.createElement('button');
                    settingsButton.className = 'settingsButton';
                    
                    const settingsButtonIcon = document.createElement('span');
                    settingsButtonIcon.className = "material-symbols-outlined";
                    settingsButtonIcon.innerText = 'delete';

                    settingsButton.appendChild(settingsButtonIcon);*/
                    frame.appendChild(avatarHeadshot);
                    frame.appendChild(username);
                    mainFrame.appendChild(frame);
                    //mainFrame.appendChild(settingsButton);

                    frame.addEventListener('mouseenter', function () {
                        frame.style.backgroundColor = '#2e2e2e';
                    })

                    frame.addEventListener('mouseleave', function () {
                        frame.style.backgroundColor = '#3c3c3c';
                    })

                    frame.addEventListener('click', function() {
                        chrome.runtime.sendMessage({data: {
                            command: 'switch-account',
                            userId: frame.id
                        }})
                    })

                    document.getElementById('container').appendChild(mainFrame);
                }

                if (!areListenersAttached) {
                    document.getElementById('addAccount').addEventListener('click', function() {
                        chrome.runtime.sendMessage({command: 'add-account'});
                        window.close();
                    })
    
                    if (userData.length == 0) {
                        const removeAccountButton = document.getElementById('removeAccount');
                        removeAccountButton.style.cursor = 'default';
                        removeAccountButton.style.backgroundColor = '#f5726c';
                    } else {
                        document.getElementById('removeAccount').addEventListener('click', function() {
                            chrome.runtime.sendMessage({command: 'remove-account'});
                            window.close();
                        })
                    }
            
                    areListenersAttached = true;
                }
            })
        } else {
            if (data.error == 'not-roblox') {
                document.getElementById('popupBody').innerHTML = notOnRobloxHTML;
            } else {
                document.getElementById('popupBody').innerHTML = notLoggedInHTML;
            }
        }
    });
}