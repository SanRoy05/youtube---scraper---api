import express from "express";
import axios from "axios";
import cheerio from "cheerio";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());

app.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    const html = await axios.get(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    ).then(r => r.data);

    const $ = cheerio.load(html);
    const results = [];

    $('script').each((_, el) => {
      const txt = $(el).html();
      if (txt && txt.includes('var ytInitialData')) {
        const jsonStr = txt.split('var ytInitialData = ')[1].split(';</script>')[0];
        const data = JSON.parse(jsonStr);
        const items = data.contents.twoColumnSearchResultsRenderer.primaryContents
          .sectionListRenderer.contents[0].itemSectionRenderer.contents;

        items.forEach(item => {
          if (item.videoRenderer) {
            const v = item.videoRenderer;
            results.push({
              title: v.title.runs[0].text,
              videoId: v.videoId,
              channel: v.ownerText?.runs[0]?.text || "",
              views: v.viewCountText?.simpleText || "",
              thumbnail: v.thumbnail.thumbnails[0].url
            });
          }
        });
      }
    });

    res.json(results.slice(0, 10));
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "Scrape failed" });
  }
});

app.listen(PORT, () => console.log(`API running on port ${PORT}`));
