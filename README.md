# Accounts-manager
An extension to keep multiple Roblox accounts connected at the same time on just one browser

<hr>

This extension allows you to keep more accounts connected in just one browser at the same time. You will be prompted to save your account when you login, if you accept then a copy of your `.ROBLOSECURITY` cookie will be made and named `AM.ROBLOSECURITY.<UserId>`. Cookie copies are saved with the same security level as roblox's ROBLOSECURITY cookie, these copies have the httpOnly flag enabled so that the chances of an XSS attack are lowred.
You can easily switch to another account using the panel that you can access by clicking on the extension icon.

# How it works

This extension automatically detects logins to Roblox and prompts you to save the account you logged in, if you accept a copy of the account's ROBLOSECURITY cookie will be made so it can be used when you want to switch account to replace the current ROBLOSECURITY cookie.
When you log out your ROBLOSECURITY cookie is invalidated by Roblox and so the extension will detect it and remove the saved account from the list. When you log out and try to access the extension's panel if you don't have any saved account you will not be able to use it until you save one.
When you click "Add account" your current ROBLOSECURITY cookie will be removed but not invalidated so that you can get to the login page.

# Adding multiple accounts

To add multiple accounts you must open the extension's panel and click the "Add account" button, this will bring you to the login page. Once you complete the log in your will be prompted to save the account then click OK.

# Switching to another account

If you want to change account open the extension's panel and click on the account you want to switch to.

# Removing an account

If you want to remove an account from the accounts list open the extension's panel and click "Remove account". This will remove the account you are using at the moment of the action from the list.

# Disclaimer

You may notice that if you log out from an account and open the dev tools, go to the application tab and open the cookies section there are still other accounts' ROBLOSECURITY cookies in there. This may appear as a security issue to you as someone with phisical access to the computer can create a cookie named `.ROBLOSECURITY` and paste the value copied from the `AM.ROBLOSECURITY.<UserId>` one. This is actually not an issue as those cookies are not invalidated by a log out action so this means that you  are still logged in with that account but the account page just doesn't appear because the correct cookie is not set but it is the same as if you leave your account connected.
This means that issues created in the issues page of this repository or in our Dicord server will be ignored.

# BETA Version

This extension is currently in beta so expect bugs. If you find any bug please report it in [the issues page](https://github.com/iKingNinja/Accounts-manager/issues) or in our [Discord server](https://discord.gg/v2Y83Numgf).
