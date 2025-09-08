import express from "express";
import cors from "cors";
import axios from "axios";
import { load } from "cheerio";
import play from "play-dl";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// 🔑 Load YouTube cookies (from cookies.json)
try {
  const cookies = JSON.parse(fs.readFileSync("./cookies.json"));
  await play.setCookies(cookies.cookies);
  console.log("✅ YouTube cookies loaded successfully.");
} catch (err) {
  console.error("⚠️ Could not load cookies.json, play-dl may fail:", err.message);
}

// 🔍 SEARCH API
app.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing search query" });

  try {
    const response = await axios.get(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    );
    const html = response.data;
    const $ = load(html);

    let ytInitialData = null;
    $("script").each((_, el) => {
      const txt = $(el).html();
      if (txt && txt.includes("var ytInitialData")) {
        ytInitialData =
          txt.split("var ytInitialData = ")[1].split("};")[0] + "}";
      }
    });

    if (!ytInitialData) return res.json([]);

    const data = JSON.parse(ytInitialData);
    const items =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ||
      [];

    const results = [];
    items.forEach((item) => {
      if (item.videoRenderer) {
        const v = item.videoRenderer;
        const lengthText = v.lengthText?.simpleText || "0:00";
        const [m, s] = lengthText.split(":").map(Number);
        const durationSec = (m || 0) * 60 + (s || 0);

        if (durationSec >= 60) {
          results.push({
            title: v.title?.runs?.[0]?.text || "",
            videoId: v.videoId,
            thumbnail: v.thumbnail?.thumbnails?.[0]?.url || "",
          });
        }
      }
    });

    res.json(results.slice(0, 15));
  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// 🎧 AUDIO STREAM API
app.get("/audio/:videoId", async (req, res) => {
  const { videoId } = req.params;
  try {
    const ytInfo = await play.video_info(
      `https://www.youtube.com/watch?v=${videoId}`
    );
    const stream = await play.stream_from
