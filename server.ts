import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Proxy endpoint to bypass CORS and Mixed Content
  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    
    if (!targetUrl) {
      return res.status(400).send("Missing 'url' query parameter");
    }

    try {
      // Stream the response from the target URL
      const response = await axios({
        method: "get",
        url: targetUrl,
        responseType: "stream",
        timeout: 15000, // 15s timeout
        maxRedirects: 5,
        headers: {
          // Forward Range header if present
          ...(req.headers.range && { Range: req.headers.range }),
          // Spoof User-Agent
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          // Strip identifying headers that might trigger blocks
          "Referer": new URL(targetUrl).origin + "/",
          "Origin": new URL(targetUrl).origin,
          "Host": new URL(targetUrl).host,
        },
        validateStatus: (status) => status < 400 || status === 416, // Accept partial content errors to handle them manually
      });

      // Forward relevant response headers
      const headersToForward = [
        "content-type", 
        "content-length", 
        "accept-ranges", 
        "content-range",
        "last-modified",
        "etag"
      ];
      
      headersToForward.forEach(header => {
        if (response.headers[header]) {
          res.setHeader(header, response.headers[header]);
        }
      });

      // Always allow CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range");
      
      // Handle status code
      res.status(response.status);

      // Pipe the stream
      response.data.pipe(res);
    } catch (error: any) {
      console.error(`Proxy error for ${targetUrl}:`, error.message);
      res.status(500).send("Error fetching resource");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, "dist")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
