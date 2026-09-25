const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;

const SYMBOLS = [
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "SUIUSDT",
  "APTUSDT",
  "NEARUSDT",
  "INJUSDT"
];

const BINANCE_HOST = "https://fapi.binance.com";

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });

  res.end(
    typeof data === "string"
      ? data
      : JSON.stringify(data)
  );
}

function sendError(res, status, message) {
  send(res, status, {
    ok: false,
    error: message
  });
}

async function getBinanceKlines(symbol, interval = "4h", limit = 1000) {
  const url =
    BINANCE_HOST +
    "/fapi/v1/klines" +
    "?symbol=" + encodeURIComponent(symbol) +
    "&interval=" + encodeURIComponent(interval) +
    "&limit=" + encodeURIComponent(limit);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "binance-quant-v1/1.0",
      "Accept": "application/json"
    }
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      "Binance HTTP " +
      response.status +
      "：" +
      text.slice(0, 300)
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Binance 返回的不是 JSON");
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "Binance 返回异常：" +
      JSON.stringify(data).slice(0, 300)
    );
  }

  return data.map(function (k) {
    return {
      time: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5])
    };
  });
}

function serveIndex(res) {
  const file = path.join(__dirname, "index.html");

  fs.readFile(file, "utf8", function (err, html) {
    if (err) {
      sendError(res, 500, "找不到 index.html");
      return;
    }

    send(res, 200, html, "text/html; charset=utf-8");
  });
}

const server = http.createServer(async function (req, res) {
  try {
    const url = new URL(
      req.url,
      "http://" + (req.headers.host || "localhost")
    );

    /*
     * 首页
     */
    if (req.method === "GET" && url.pathname === "/") {
      serveIndex(res);
      return;
    }

    /*
     * 健康检查
     */
    if (req.method === "GET" && url.pathname === "/health") {
      send(res, 200, {
        ok: true,
        service: "binance-quant-v1",
        time: new Date().toISOString()
      });
      return;
    }

    /*
     * 获取 Binance K 线
     *
     * 浏览器：
     * /api/klines?symbol=SOLUSDT&interval=4h&limit=1000
     *
     * 服务器再去请求 Binance。
     */
    if (req.method === "GET" && url.pathname === "/api/klines") {
      const symbol = (
        url.searchParams.get("symbol") || ""
      ).toUpperCase();

      const interval =
        url.searchParams.get("interval") || "4h";

      const limit = Math.min(
        Math.max(
          Number(url.searchParams.get("limit") || 1000),
          1
        ),
        1500
      );

      if (!SYMBOLS.includes(symbol)) {
        sendError(
          res,
          400,
          "不支持的币种：" + symbol
        );
        return;
      }

      const allowedIntervals = [
        "1h",
        "2h",
        "4h",
        "6h",
        "8h",
        "12h",
        "1d"
      ];

      if (!allowedIntervals.includes(interval)) {
        sendError(
          res,
          400,
          "不支持的周期：" + interval
        );
        return;
      }

      try {
        const data = await getBinanceKlines(
          symbol,
          interval,
          limit
        );

        send(res, 200, {
          ok: true,
          symbol: symbol,
          interval: interval,
          count: data.length,
          data: data
        });
      } catch (err) {
        console.error(
          "Binance 请求失败：",
          symbol,
          err.message
        );

        sendError(
          res,
          502,
          symbol + " 获取失败：" + err.message
        );
      }

      return;
    }

    /*
     * 未找到
     */
    sendError(res, 404, "Not Found");

  } catch (err) {
    console.error(err);
    sendError(
      res,
      500,
      "服务器内部错误：" + err.message
    );
  }
});

server.listen(PORT, "0.0.0.0", function () {
  console.log(
    "Binance Quant V1 server running on port " + PORT
  );
});
