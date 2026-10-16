const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Web Scraper Endpoint
app.post('/api/scrape', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    // Fetch the page
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract data
    const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    
    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '';

    // Headings H1-H3
    const headings = {
      h1: [],
      h2: [],
      h3: [],
    };

    $('h1').each((_, el) => {
      const text = $(el).text().trim();
      if (text) headings.h1.push(text);
    });
    $('h2').each((_, el) => {
      const text = $(el).text().trim();
      if (text) headings.h2.push(text);
    });
    $('h3').each((_, el) => {
      const text = $(el).text().trim();
      if (text) headings.h3.push(text);
    });

    // Links
    const links = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href) {
        // Resolve relative URLs
        let absoluteHref = href;
        try {
          absoluteHref = new URL(href, targetUrl).href;
        } catch (e) {
          // keep original if invalid
        }
        links.push({
          text: text || '(no text)',
          href: absoluteHref,
        });
      }
    });

    // Remove duplicate links
    const uniqueLinks = [];
    const seen = new Set();
    for (const link of links) {
      if (!seen.has(link.href)) {
        seen.add(link.href);
        uniqueLinks.push(link);
      }
    }

    const result = {
      url: targetUrl,
      title,
      description,
      headings,
      links: uniqueLinks.slice(0, 100), // limit to 100 links
      scrapedAt: new Date().toISOString(),
    };

    res.json(result);
  } catch (error) {
    console.error('Scrape error:', error.message);
    res.status(500).json({
      error: 'Failed to scrape the URL',
      details: error.message,
    });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 All-in-One Utility Tools running at http://localhost:${PORT}`);
});
