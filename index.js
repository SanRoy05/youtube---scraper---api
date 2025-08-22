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

// Helper: convert "mm:ss" or "hh:mm:ss" into seconds
function parseDuration(str) {
  const parts = str.split(":").map(Number).reverse();
  let seconds = 0;
  if (parts[0]) seconds += parts[0];         // seconds
  if (parts[1]) seconds += parts[1] * 60;    // minutes
  if (parts[2]) seconds += parts[2] * 3600;  // hours
  return seconds;
}

app.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    const html = await axios
      .get(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(
          query
        )}`
      )
      .then((r) => r.data);

    const $ = load(html);
    let ytDataRaw = null;

    $("script").each((_, el) => {
      const txt = $(el).html();
      if (txt && txt.includes("var ytInitialData")) {
        try {
          ytDataRaw =
            txt.split("var ytInitialData = ")[1].split("};")[0] + "}";
        } catch (err) {
          console.error("ytInitialData parse error");
        }
      }
    });

    if (!ytDataRaw) {
      return res
        .status(500)
        .json({ error: "Failed to extract YouTube data" });
    }

    const data = JSON.parse(ytDataRaw);
    const results = [];

    function extractItems(items) {
      items?.forEach((item) => {
        if (item.videoRenderer) {
          const v = item.videoRenderer;

          // ✅ Only include if it has a duration AND is >= 60 seconds
          if (v.lengthText) {
            const durationText = v.lengthText.simpleText; // e.g. "3:45"
            const totalSeconds = parseDuration(durationText);

            if (totalSeconds >= 60) {
              results.push({
                title: v.title?.runs?.[0]?.text || "",
                videoId: v.videoId,
                thumbnail:
                  v.thumbnail?.thumbnails?.slice(-1)[0]?.url || "",
                duration: durationText, // keep if you want song length
              });
            }
          }
        }
      });
    }

    // First batch of items
    let items =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
    extractItems(items);

    // Return only the first 20 valid songs
    res.json(results.slice(0, 20));
  } catch (e) {
    console.error("Scrape error:", e.message);
    res
      .status(500)
      .json({ error: "Scrape failed or YouTube layout changed" });
  }
});

app.listen(PORT, () =>
  console.log(`✅ API running on port ${PORT}`)
);
