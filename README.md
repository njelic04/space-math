# Space Math

A space-themed math game for kids. Practice addition and subtraction solo, or race a friend over your home network.

**[Прочитај на српском (README_SR.md)](README_SR.md)**

---

## What You Need

- A computer (Mac, Windows, or Linux)
- An internet connection (only needed once, for the install step)

---

## How to Install

### Step 1: Install Node.js

Node.js is a free program that runs the game. You only need to install it once.

1. Go to **https://nodejs.org**
2. Click the big green button that says **"LTS"** (the recommended version)
3. Open the downloaded file and follow the installer — just keep clicking **Next** / **Continue** until it's done
4. Restart your computer after installing

### Step 2: Download the Game

1. Go to this page: **https://github.com/njelic04/space-math**
2. Click the green **"Code"** button
3. Click **"Download ZIP"**
4. Find the downloaded ZIP file (usually in your **Downloads** folder) and unzip it
   - **Mac**: Double-click the ZIP file
   - **Windows**: Right-click the ZIP file and choose **"Extract All"**

### Step 3: Install Game Dependencies

You only need to do this once after downloading.

1. Open a terminal:
   - **Mac**: Open the app called **Terminal** (search for it in Spotlight with Cmd + Space)
   - **Windows**: Open the app called **Command Prompt** (search for it in the Start menu)
2. Type the following and press Enter (copy-paste is easiest):
   ```
   cd Downloads/space-math-main
   ```
   > If you moved the folder somewhere else, replace the path above with where you put it.
3. Type this and press Enter:
   ```
   npm install
   ```
   Wait a few seconds until it finishes.

---

## How to Play

### Start the Game

1. Open a terminal (same as Step 3 above)
2. Go to the game folder:
   ```
   cd Downloads/space-math-main
   ```
3. Start the game:
   ```
   npm start
   ```
4. You should see a message like:
   ```
   Space Math Server Running!
   Local:   http://localhost:3000
   Network: http://192.168.x.x:3000
   ```
5. Open your web browser (Chrome, Safari, Firefox, Edge — any will work)
6. Go to **http://localhost:3000**

That's it! The game is running!

### Solo Mode

Click **Solo Mission**, enter your name and a password (to save your score), and start playing!

- Choose your operations (addition, subtraction, or both)
- Pick a number range (1-10 for beginners, up to 1-100 for a challenge)
- Use the quick presets: **Starter**, **Classic**, **Challenge**, or **Expert**
- Type your answer with the keyboard and press **Enter**

### Two-Player Mode (Space Race)

Play against someone on the same Wi-Fi network!

1. Start the game on your computer (follow the steps above)
2. Click **Space Race** on your computer — you'll see a network address like `http://192.168.x.x:3000`
3. On the second player's device (phone, tablet, or another computer), open a browser and type in that address
4. Both players are now connected! The host clicks **Start Game**

---

## How to Stop the Game

In the terminal where the game is running, press **Ctrl + C** to stop it.

---

## Troubleshooting

**"command not found: node" or "command not found: npm"**
Node.js isn't installed yet, or you need to restart your terminal after installing. Go back to Step 1.

**"address already in use"**
The game is already running in another terminal. Close that terminal first, or press Ctrl + C in it.

**The second player can't connect**
Make sure both devices are on the same Wi-Fi network. Use the Network address shown in the terminal (not `localhost`).

---

## License

MIT License

Copyright (c) 2026 Nenad Jelic

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
