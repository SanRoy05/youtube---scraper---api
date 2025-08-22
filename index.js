import express from "express";
import axios from "axios";
import { load } from "cheerio";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());

app.get("/ping", (req, res) => {
  res.status(200).json({ message: "API is alive" });
});

app.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    const html = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`)
      .then((r) => r.data);

    const $ = load(html);
    const results = [];

    let ytDataRaw = null;

    $("script").each((_, el) => {
      const txt = $(el).html();
      if (txt && txt.includes("var ytInitialData")) {
        try {
          ytDataRaw = txt.split("var ytInitialData = ")[1].split("};")[0] + "}";
        } catch (err) {
          console.error("ytInitialData parse error");
        }
      }
    });

    if (!ytDataRaw) {
      return res.status(500).json({ error: "Failed to extract YouTube data" });
    }

    const data = JSON.parse(ytDataRaw);
    const items = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

    if (!items) return res.json([]);

    items.forEach((item) => {
      if (item.videoRenderer) {
        const v = item.videoRenderer;
        results.push({
          title: v.title?.runs?.[0]?.text || "",
          videoId: v.videoId,
          channel: v.ownerText?.runs?.[0]?.text || "",
          views: v.viewCountText?.simpleText || "",
          thumbnail: v.thumbnail?.thumbnails?.[0]?.url || "",
        });
      }
    });

    res.json(results.slice(0, 20)); // return upto 20 response 
  } catch (e) {
    console.error("Scrape error:", e.message);
    res.status(500).json({ error: "Scrape failed or YouTube layout changed" });
  }
});

app.listen(PORT, () => console.log(`✅ API running on port ${PORT}`));
