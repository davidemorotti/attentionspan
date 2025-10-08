# AttentionSpan 🎯

> **The World's Most Passive-Aggressive Productivity Tool**

## What the Heck is This? 🤔

Welcome to AttentionSpan, the revolutionary eye-tracking app that monitors your attention with the precision of a disappointed parent and the subtlety of a sledgehammer. Because nothing motivates like shame, animated GIFs, and the crushing weight of your own inadequacy.

## The Problem We're "Solving" 😤

You know that feeling when you're supposed to be working but instead you're:
- Watching cat videos on YouTube
- Reading Wikipedia articles about the history of cheese
- Staring at your screen pretending to work while actually daydreaming about lunch
- Checking your phone for the 47th time this hour

**AttentionSpan doesn't solve this problem.** Instead, it makes you feel *really bad* about it by showing you disappointment GIFs every time you look away. It's like having a judgmental roommate who never pays rent but always judges your life choices.

## How It Works (Or Doesn't) 🔬

1. **Advanced Iris Tracking**: Uses TensorFlow.js Face Landmarks Detection with MediaPipe Iris model to track your eyeballs with military precision - now with 468 facial landmarks including iris keypoints
2. **Disappointment Delivery**: The moment you look away, you get hit with a curated collection of disappointment GIFs
3. **Shame Spiral**: Watch your self-esteem decrease proportionally to your productivity increase
4. **Leaderboard of Shame**: Compete with other masochists to see who can stare at their screen the longest

## Features That Nobody Asked For ✨

- 🎭 **State-of-the-art disappointment technology** (patent pending)
- 👁️ **Military-grade eye tracking** (because regular eye tracking wasn't judgmental enough)
- 😞 **Curated disappointment GIFs** (hand-picked to maximize guilt)
- ⏱️ **Precision timing** (down to the millisecond of your failure)
- 🏆 **Leaderboard of champions** (who apparently have no social lives)
- 📱 **Mobile-friendly shame** (now you can feel bad anywhere!)

## Prerequisites & Setup 🔧

### Required:
- **Web server with PHP support** (Apache, Nginx, or local development server)
- **Giphy API key** (free from https://developers.giphy.com/)
- **HTTPS or localhost** (required for camera access)

### API Configuration:

1. **Get Giphy API Key:**
   - Visit https://developers.giphy.com/
   - Create account and get free API key
   - Replace `$GIPHY_API_KEY` in `giphy.php` (line 78)

2. **Configure CORS Domains:**
   - Edit `giphy.php` line 4: `$allowedDomains = ['yourdomain.com'];`
   - Add your actual domain(s) to the array
   - For localhost: `$allowedDomains = ['localhost', '127.0.0.1'];`

3. **File Permissions:**
   ```bash
   chmod 666 leaderboard_data.txt
   chmod 666 rate_limit.txt
   ```

## Installation (Why Are You Still Reading This?) 🚀

```bash
# Clone this repository (if you really want to)
git clone https://github.com/davidemorotti/attentionspan.git

# Navigate to the folder of regret
cd attentionspan

# Configure your Giphy API key and CORS domains (see Prerequisites above)

# Start a local PHP server
php -S localhost:8000

# Open http://localhost:8000/app.html in your browser
# Prepare for disappointment
```

## Usage Instructions 📖

1. **Open `app.html`** in your browser (the main app)
2. **Allow camera access** (yes, we're watching you)
3. **Wait for the 3-second countdown** (time to prepare for disappointment)
4. **Try to focus** (good luck with that)
5. **Get disappointed** (this is the main feature)
6. **Click "Try Again"** to restart your misery
7. **Register your score** to join the leaderboard of shame
8. **Repeat until you question your life choices**

## Technical Details (For the Nerds) 🔧

- **Frontend**: Pure HTML/CSS/JavaScript (because we're not pretentious)
- **Eye Tracking**: MediaPipe Face Mesh with Iris landmarks (468 facial landmarks for maximum judgment)
- **Backend**: PHP (because we hate ourselves)
- **Database**: Text files (we're not fancy enough for SQL)
- **API**: Giphy API for disappointment GIFs
- **Security**: CORS protection, rate limiting, input validation
- **Browser Support**: Modern browsers with WebRTC support (Chrome, Firefox, Safari, Edge)

## Security Notes ⚠️

- **API Key**: Never commit your Giphy API key to public repositories
- **CORS**: Configure allowed domains to prevent unauthorized access
- **Rate Limiting**: Built-in protection against spam (10 requests/hour per IP)
- **Input Validation**: All user inputs are sanitized and validated
- **File Permissions**: Ensure proper permissions for data files

## Known Issues (There Are Many) 🐛

- **Doesn't actually improve productivity** (this is a feature, not a bug)
- **May cause existential crisis** (also a feature)
- **Eye tracking accuracy varies** (depends on how much coffee you've had)
- **Works best with good lighting** (and low self-esteem)
- **May trigger imposter syndrome** (especially if you're already prone to it)
- **Camera access required** (privacy concerns are valid)
- **Giphy API rate limits** (free tier has daily limits)

## Troubleshooting 🔧

### Common Issues:

**"Camera not working"**
- Ensure you're using HTTPS or localhost
- Check browser permissions for camera access
- Try refreshing the page

**"GIFs not loading"**
- Check your Giphy API key in `giphy.php`
- Verify CORS domain configuration
- Check browser console for errors

**"Leaderboard not working"**
- Ensure PHP server is running
- Check file permissions for `leaderboard_data.txt`
- Verify CORS headers in `leaderboard.php`

**"Eye tracking not accurate"**
- Ensure good lighting conditions
- Keep face centered in camera view
- Avoid wearing glasses (if possible)
- Try different browsers

**"CORS errors"**
- Update `$allowedDomains` in `giphy.php`
- Add your domain to the allowed list
- For localhost: `['localhost', '127.0.0.1']`

### Development Setup:

```bash
# For local development
php -S localhost:8000

# For production (example with Apache)
# Ensure mod_rewrite is enabled
# Configure virtual host with PHP support
```

## Contributing (Please Don't) 🤝

If you're masochistic enough to want to contribute to this project:

1. Fork the repository (why would you do this to yourself?)
2. Create a feature branch (name it something depressing)
3. Commit your changes (with a commit message that reflects your life choices)
4. Push to the branch (and question what you're doing with your life)
5. Open a Pull Request (and prepare for disappointment)

## License 📜

This project is licensed under the **"Do Whatever You Want, We Don't Care"** License (DWYWWDTC for short).

```
Copyright (c) 2024 AttentionSpan

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

DISCLAIMER: This software may cause feelings of inadequacy, existential dread,
and the sudden urge to reorganize your entire life. Use at your own risk.
We are not responsible for any productivity gains, losses, or mid-life crises
that may result from using this software. If you actually become more productive,
please contact us immediately so we can fix this bug.
```

## Support (Good Luck) 💬

- **Issues**: Open a GitHub issue (we'll probably ignore it)
- **Questions**: Ask yourself why you're using this app
- **Feature Requests**: We don't take requests, only complaints
- **Bug Reports**: We know there are bugs, we put them there on purpose

## Acknowledgments 🙏

- **Google MediaPipe** for making eye tracking judgmental with iris precision
- **Giphy** for providing endless disappointment
- **Our users** for being masochistic enough to use this
- **Our sanity** for leaving us long ago
- **PHP** for existing (we're not sure why)

## Final Thoughts 💭

If you've read this far, you're either:
1. Really bored (in which case, this app is perfect for you)
2. Actually interested in this project (seek help)
3. A masochist (welcome to the club)

Remember: **This app won't make you more productive, but it will make you feel really bad about not being productive.** And sometimes, that's enough.

---

*"The best productivity app is the one that makes you feel so guilty about not being productive that you eventually just give up and go watch Netflix."* - Someone, probably

**Happy procrastinating!** 🎉
