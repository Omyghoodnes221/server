const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIG (set these as Render Environment Variables) ---
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;   // your GitHub PAT
const GITHUB_USER   = process.env.GITHUB_USER;    // your GitHub username
const GITHUB_REPO   = process.env.GITHUB_REPO;    // your repo name
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_FILE   = process.env.GITHUB_FILE   || 'source.lua'; // path inside repo
const SECRET_KEY    = process.env.SECRET_KEY;     // optional extra protection

// Build the raw GitHub API URL
function buildGithubUrl() {
  return `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${GITHUB_FILE}?ref=${GITHUB_BRANCH}`;
}

// Check if the request looks like it's from Roblox
function isRoblox(req) {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const hasRobloxUA = ua.includes('roblox');

  // Roblox HttpService sends this header
  const hasRobloxHeader = req.headers['roblox-id'] !== undefined;

  // Optional: check your own secret key sent from the Roblox script
  const secretOk = !SECRET_KEY || req.headers['x-secret'] === SECRET_KEY;

  return (hasRobloxUA || hasRobloxHeader) && secretOk;
}

// Health check (Render pings this to keep the service alive)
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// The actual source endpoint
app.get('/source', async (req, res) => {
  // Block anything that's not Roblox
  if (!isRoblox(req)) {
    return res.status(403).send('Access Denied');
  }

  // Check config is set
  if (!GITHUB_TOKEN || !GITHUB_USER || !GITHUB_REPO) {
    console.error('Missing environment variables');
    return res.status(500).send('Server misconfigured');
  }

  try {
    // Fetch from GitHub Contents API (works with private repos)
    const response = await fetch(buildGithubUrl(), {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw', // returns raw file content
        'User-Agent': 'roblox-source-loader'
      }
    });

    if (!response.ok) {
      console.error('GitHub fetch failed:', response.status);
      return res.status(502).send('Failed to fetch source');
    }

    const source = await response.text();
    res.setHeader('Content-Type', 'text/plain');
    res.send(source);

  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('Internal error');
  }
});

app.listen(PORT, () => {
  console.log(`Loader running on port ${PORT}`);
});
