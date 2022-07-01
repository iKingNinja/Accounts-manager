var areListenersAttached = false;

const accountsHTML = `
<h1 class="title">Accounts manager</h1>
<div class="container" id="container"></div>
<hr>
<button class="addAccount" id="addAccount">Add account</button>
<button class="removeAccount" id="removeAccount">Remove account</button>
<script src="../accounts.js"></script>`; //HTML for accounts list

const notLoggedInHTML = `
<h1 class="title">Accounts manager</h1>
<div class="container" id="container"></div>
<p class="message">You must be logged in at least in one account</p>
<script src="../accounts.js"></script>`; //HTML for not logged in error

const notOnRobloxHTML = `
<h1 class="title">Accounts manager</h1>
<div class="container" id="container"></div>
<p class="message">This extension only works on Roblox pages</p>
<script src="../accounts.js"></script>`; //HTML for not roblox page error

window.onload = function() { //when popup.html is opened
    chrome.runtime.sendMessage({command: 'is-use-allowed'}, function(data) { //check if the user is allowed to use the extension
        if (!data) {
            return;
        }

        if (data.isUseAllowed) { //if use is allowed it means that the accounts list must be displayed
            document.getElementById('popupBody').innerHTML = accountsHTML; //set popup body html to accountsHTML

            chrome.runtime.sendMessage({command: 'get-user-data'}, function(userData) { //get current user data
                if (userData) {
                    for (const user of userData) { //iterate over the accounts list and create a frame for each account
                        const mainFrame = document.createElement('div');
    
                        const frame = document.createElement('div');
                        frame.className = 'accountFrame';
                        frame.id = user.userId;
    
                        const avatarHeadshot = document.createElement('img');
                        avatarHeadshot.src = user.avatarURL;
    
                        const username = document.createElement('label');
                        username.innerText = user.username;
                        frame.appendChild(avatarHeadshot);
                        frame.appendChild(username);
                        mainFrame.appendChild(frame);
    
                        frame.addEventListener('mouseenter', function () {
                            frame.style.backgroundColor = '#2e2e2e';
                        })
    
                        frame.addEventListener('mouseleave', function () {
                            frame.style.backgroundColor = '#3c3c3c';
                        })
    
                        frame.addEventListener('click', function() {
                            chrome.runtime.sendMessage({data: { //switch account
                                command: 'switch-account',
                                userId: frame.id
                            }})
                        })
    
                        document.getElementById('container').appendChild(mainFrame);
                    }
                }

                if (!areListenersAttached) { //if listeners haven't been attached yet then attach them
                    document.getElementById('addAccount').addEventListener('click', function() {
                        chrome.runtime.sendMessage({command: 'add-account'}); //add an account
                        window.close();
                    })
    
                    if ((!userData) || userData.length == 0) { //if userData is null or it is empty then disable the remove account button
                        const removeAccountButton = document.getElementById('removeAccount');
                        removeAccountButton.style.cursor = 'default';
                        removeAccountButton.style.backgroundColor = '#f5726c';
                    } else {
                        document.getElementById('removeAccount').addEventListener('click', function() {
                            chrome.runtime.sendMessage({command: 'remove-account'}); //remove the current account
                            window.close();
                        })
                    }
            
                    areListenersAttached = true;
                }
            })
        } else {
            if (data.error == 'not-roblox') { //if the use of the extension is not allowed then display the proper error message by setting the body HTML
                document.getElementById('popupBody').innerHTML = notOnRobloxHTML;
            } else {
                document.getElementById('popupBody').innerHTML = notLoggedInHTML;
            }
        }
    });
}
