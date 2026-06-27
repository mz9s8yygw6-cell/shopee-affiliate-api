const crypto = require("crypto");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Only POST method is allowed"
    });
  }

  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: "請輸入至少一個蝦皮連結"
      });
    }

    if (urls.length > 5) {
      return res.status(400).json({
        success: false,
        error: "每次最多只能轉換 5 個蝦皮連結"
      });
    }

    const cleanUrls = urls
      .map((url) => String(url).trim())
      .filter(Boolean);

    const invalidUrl = cleanUrls.find((url) => {
  return !url.includes("shopee.tw") && !url.includes("tw.shp.ee");
});

if (invalidUrl) {
  return res.status(400).json({
    success: false,
    error: "請確認輸入的是蝦皮台灣連結"
  });
}

    const appId = process.env.SHOPEE_APP_ID;
    const secret = process.env.SHOPEE_SECRET;

    if (!appId || !secret) {
      return res.status(500).json({
        success: false,
        error: "伺服器尚未設定 SHOPEE_APP_ID 或 SHOPEE_SECRET"
      });
    }

    const endpoint = "https://open-api.affiliate.shopee.tw/graphql";

    const results = await Promise.all(
      cleanUrls.map(async (cleanUrl) => {
        const query = `
          mutation {
            generateShortLink(input: {
              originUrl: ${JSON.stringify(cleanUrl)}
            }) {
              shortLink
            }
          }
        `;

        const payload = JSON.stringify({ query });
        const timestamp = Math.floor(Date.now() / 1000).toString();

        const signature = crypto
          .createHash("sha256")
          .update(appId + timestamp + payload + secret)
          .digest("hex");

        const authorization =
          `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authorization
          },
          body: payload
        });

        const data = await response.json();

        if (data.errors && data.errors.length > 0) {
          return {
            success: false,
            error: data.errors[0].message || "Shopee API 發生錯誤"
          };
        }

        const shortLink = data?.data?.generateShortLink?.shortLink;

        if (!shortLink) {
          return {
            success: false,
            error: "沒有取得推廣連結"
          };
        }

        return {
          success: true,
          shortLink
        };
      })
    );

    return res.status(200).json({
      success: true,
      results
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
