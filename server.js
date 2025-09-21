const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(express.json());

// MongoDB connection
mongoose.connect("mongodb+srv://sirtheprogrammer:01319943591Bk.@cluster0.p2rjers.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error(err));

// ===== Schema & Model =====
const logSchema = new mongoose.Schema({
  url: String,
  status: String,
  responseTime: Number,
  timestamp: { type: Date, default: Date.now }
});

const monitoredUrlSchema = new mongoose.Schema({
  url: String,
  logs: [logSchema]
});

const MonitoredUrl = mongoose.model("MonitoredUrl", monitoredUrlSchema);

// ===== Worker: Ping every 3s =====
setInterval(async () => {
  const urls = await MonitoredUrl.find();
  for (const entry of urls) {
    try {
      const start = Date.now();
      await axios.get(entry.url);
      const responseTime = Date.now() - start;

      entry.logs.push({ url: entry.url, status: "UP", responseTime });
      if (entry.logs.length > 100) entry.logs.shift(); // limit logs
      await entry.save();
    } catch (err) {
      entry.logs.push({ url: entry.url, status: "DOWN", responseTime: 0 });
      if (entry.logs.length > 100) entry.logs.shift();
      await entry.save();
    }
  }
}, 3000);

// ===== Routes =====
app.get("/", async (req, res) => {
  const urls = await MonitoredUrl.find();

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Uptime Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        ul { list-style: none; padding: 0; }
        li { background: white; padding: 10px; margin: 5px 0; border-radius: 5px; }
        form { margin-bottom: 20px; }
        input { padding: 5px; margin-right: 10px; }
        button { padding: 5px 10px; }
      </style>
    </head>
    <body>
      <h1>🚀 Uptime Monitor</h1>
      
      <form id="addUrlForm">
        <input type="text" id="urlInput" placeholder="Enter URL" required />
        <button type="submit">Add URL</button>
      </form>

      <h2>Monitored URLs</h2>
      <ul>
  `;

  urls.forEach(url => {
    html += `<li><strong>${url.url}</strong> - <a href="/logs/${url._id}">View Logs</a></li>`;
  });

  html += `
      </ul>
      <script>
        document.getElementById("addUrlForm").addEventListener("submit", async e => {
          e.preventDefault();
          const url = document.getElementById("urlInput").value;
          await fetch("/add-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
          });
          location.reload();
        });
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

app.post("/add-url", async (req, res) => {
  const { url } = req.body;
  const newUrl = new MonitoredUrl({ url, logs: [] });
  await newUrl.save();
  res.json({ message: "✅ URL added!" });
});

app.get("/logs/:id", async (req, res) => {
  const url = await MonitoredUrl.findById(req.params.id);
  res.json(url.logs);
});

// ===== Start Server =====
app.listen(3000, () => console.log("🚀 Uptime Bot running at http://localhost:3000"));
