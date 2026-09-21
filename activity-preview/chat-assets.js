(function (root) {
  "use strict";
  const assets = Object.freeze({
    "basketball-synthetic": Object.freeze({
      path: "../activity-preview/chat-assets/basketball-synthetic.svg",
      sourceId: "sample-basketball", eventId: "comets-grove", category: "basketball",
      alt: "Original fictional Comets and Grove team badges",
      attribution: "Original demo artwork by Family Copilot."
    }),
    "movie-synthetic": Object.freeze({
      path: "../activity-preview/chat-assets/movie-synthetic.svg",
      sourceId: "sample-movie", eventId: "skybound", category: "movie",
      alt: "Original fictional Skybound poster",
      attribution: "Original demo artwork by Family Copilot."
    })
  });

  const demoReferences = Object.freeze([
    Object.freeze({
      path: "../activity-preview/chat-assets/ctbc-dea.png",
      sourceId: "tpbl-snapshot", eventId: "27539", category: "basketball",
      activityUrl: "https://tpbl.basketball/schedule/27539",
      sourceUrl: "https://zh.wikipedia.org/wiki/File:%E6%96%B0%E5%8C%97%E4%B8%AD%E4%BF%A1%E7%89%B9%E6%94%BB.png",
      officialUrl: "https://ctbcdea.com.tw/",
      alt: "New Taipei CTBC DEA team logo",
      fallback: "新北中信特攻 / TPBL",
      matchup: Object.freeze({
        game: "GAME 5",
        homeName: "新北中信特攻",
        awayName: "福爾摩沙夢想家",
        awayPath: "../activity-preview/chat-assets/formosa-dreamers.webp",
        awayAlt: "Formosa Dreamers team logo",
        sourceUrl: "https://tpbl.basketball/schedule/27539",
        attribution: "Formosa Dreamers logo and home/away pairing, via TPBL game 27539. Copyright remains with the respective rights holders."
      }),
      attribution: "New Taipei CTBC DEA logo, via Chinese Wikipedia. Non-free logo; Wikipedia's fair-use rationale does not grant reuse permission.",
      rights: "Internal demo reference only. Public reuse permission has not been confirmed. No endorsement implied."
    }),
    Object.freeze({
      path: "../activity-preview/chat-assets/forgotten-island.jpg",
      sourceId: "vieshow-snapshot", eventId: "8956", category: "movie",
      activityUrl: "https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=8956",
      sourceUrl: "https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=8956",
      alt: "Forgotten Island theatrical poster",
      attribution: "Forgotten Island poster, via Vieshow Cinemas. Copyright remains with the respective rights holders.",
      rights: "Internal demo reference only. Public reuse permission has not been confirmed. No endorsement implied."
    }),
    Object.freeze({
      path: "../activity-preview/chat-assets/chiikawa.jpg",
      sourceId: "vieshow-snapshot", eventId: "8786", category: "movie",
      activityUrl: "https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=8786",
      sourceUrl: "https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=8786",
      alt: "Chiikawa The Movie: The Secret of the Mermaid Island theatrical poster",
      attribution: "Chiikawa movie poster, via Vieshow Cinemas. Copyright remains with the respective rights holders.",
      rights: "Internal demo reference only. Public reuse permission has not been confirmed. No endorsement implied."
    })
  ]);

  function resolve(item, source = null) {
    if (source?.kind === "public_snapshot" && source.sourceId === item.sourceId && item.thumbnail === null) {
      return demoReferences.find(asset => ["sourceId", "eventId", "category"].every(field => item[field] === asset[field]) &&
        item.sourceUrl === asset.activityUrl) || null;
    }
    const thumbnail = item.thumbnail;
    if (!thumbnail || thumbnail.permission !== "original_synthetic" || !Object.hasOwn(assets, thumbnail.assetKey)) return null;
    const asset = assets[thumbnail.assetKey];
    return ["sourceId", "eventId", "category"].every(field => item[field] === asset[field]) ? asset : null;
  }

  const api = Object.freeze({ resolve });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FamilyChatActivityAssets = api;
})(globalThis);
