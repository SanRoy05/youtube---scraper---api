import express from "express";
import cors from "cors";
import axios from "axios";
import { load } from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

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
        ytInitialData = txt.split("var ytInitialData = ")[1].split("};")[0] + "}";
      }
    });

    if (!ytInitialData) return res.json([]);

    const data = JSON.parse(ytInitialData);
    const items =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

    const results = [];
    items.forEach((item) => {
      if (item.videoRenderer) {
        const v = item.videoRenderer;
        const lengthText = v.lengthText?.simpleText || "0:00";
        const [m, s] = lengthText.split(":").map(Number);
        const durationSec = (m || 0) * 60 + (s || 0);

        // 🎵 only take proper songs, not shorts/reels
        if (durationSec >= 60) {
          results.push({
            title: v.title?.runs?.[0]?.text || "",
            videoId: v.videoId,
            thumbnail: v.thumbnail?.thumbnails?.[0]?.url || "",
          });
        }
      }
    });

    res.json(results.slice(0, 20)); // only first 20 results
  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// 🎶 RECOMMEND API (auto-next)
app.get("/recommend", async (req, res) => {
  const mood = req.query.mood || "romantic"; // default mood romantic
  try {
    const response = await axios.get(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(mood + " songs playlist")}`
    );
    const html = response.data;
    const $ = load(html);

    let ytInitialData = null;
    $("script").each((_, el) => {
      const txt = $(el).html();
      if (txt && txt.includes("var ytInitialData")) {
        ytInitialData = txt.split("var ytInitialData = ")[1].split("};")[0] + "}";
      }
    });

    if (!ytInitialData) return res.json([]);

    const data = JSON.parse(ytInitialData);
    const items =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

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

    // shuffle & send back 10 songs
    const shuffled = results.sort(() => 0.5 - Math.random());
    res.json(shuffled.slice(0, 10));
  } catch (err) {
    console.error("Recommend error:", err.message);
    res.status(500).json({ error: "Recommendation failed" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
