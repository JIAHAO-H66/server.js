const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

async function getBinance(symbol) {
  const url =
    "https://fapi.binance.com/fapi/v1/klines" +
    "?symbol=" + encodeURIComponent(symbol) +
    "&interval=4h&limit=1000";

  const r = await fetch(url);

  if (!r.ok) {
    throw new Error("Binance HTTP " + r.status);
  }

  return await r.json();
}

const server = http.createServer(async (req, res) => {
  try {
    // Binance 数据代理
    if (req.url.startsWith("/api/klines")) {
      const u = new URL(req.url, "http://localhost");
      const symbol = u.searchParams.get("symbol");

      if (!/^[A-Z0-9]+$/.test(symbol || "")) {
        res.writeHead(400, {
          "Content-Type": "application/json; charset=utf-8"
        });
        res.end(JSON.stringify({ error: "Invalid symbol" }));
        return;
      }

      const data = await getBinance(symbol);

      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });

      res.end(JSON.stringify(data));
      return;
    }

    // 首页
    if (req.url === "/" || req.url === "/index.html") {
      const file = fs.readFileSync(
        path.join(__dirname, "index.html")
      );

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });

      res.end(file);
      return;
    }

    res.writeHead(404);
    res.end("Not Found");

  } catch (e) {
    console.error(e);

    res.writeHead(502, {
      "Content-Type": "application/json; charset=utf-8"
    });

    res.end(JSON.stringify({
      error: e.message
    }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
