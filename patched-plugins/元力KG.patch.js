
/* ===== 播放修复补丁（元力KG） =====
 * 原因：原插件调用的第三方解析接口 music-api2.cenguigui.cn 已失效。
 * 处理：改用酷狗官方取链接口；酷狗受限（VIP/付费）时自动回退到酷我公开接口。
 */
(function () {
  var axios = require("axios");
  var CryptoJs = require("crypto-js");

  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  var KG_HEADERS = { "User-Agent": UA, Referer: "https://www.kugou.com/" };
  var KW_HEADERS = { "User-Agent": UA, Referer: "https://www.kuwo.cn/" };

  function md5(s) {
    return CryptoJs.MD5(s).toString(CryptoJs.enc.Hex);
  }

  function toHttps(url) {
    return String(url || "").replace(/^http:\/\//i, "https://");
  }

  function getHashes(item, quality) {
    var id = item.id;
    var h320 = item["320hash"];
    var sq = item.sqhash;
    var res = item.ResFileHash;
    var list;
    if (quality === "low") list = [id];
    else if (quality === "standard") list = [h320, id];
    else if (quality === "high") list = [sq, h320, id];
    else list = [res, sq, h320, id];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && out.indexOf(list[i]) < 0) out.push(list[i]);
    }
    return out;
  }

  async function getKugouUrl(item, quality) {
    var hashes = getHashes(item, quality);
    for (var i = 0; i < hashes.length; i++) {
      try {
        var hash = hashes[i];
        var key = md5(hash + "kgcloud");
        var res = await axios.get(
          "https://trackercdn.kugou.com/i/?cmd=4&hash=" +
            encodeURIComponent(hash) +
            "&key=" +
            key +
            "&pid=1&forceDown=0&vip=1",
          { headers: KG_HEADERS, timeout: 10000 },
        );
        var d = res.data || {};
        if (d.status === 1 && d.url) return toHttps(d.url);
      } catch (e) {}
    }
    return null;
  }

  function cleanTitle(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[\s\u3000]/g, "")
      .replace(/[()（）\[\]【】]/g, "")
      .replace(/[-_/\\,，。.、·'"“”‘’!?！？:：;；&+]/g, "");
  }

  function artistSet(s) {
    return String(s || "")
      .toLowerCase()
      .split(/[/&,，、;；()（）\[\]【】\s]+/)
      .filter(function (x) {
        return !!x;
      });
  }

  function artistMatch(a, b) {
    var sa = artistSet(a);
    var sb = artistSet(b);
    for (var i = 0; i < sa.length; i++) {
      for (var j = 0; j < sb.length; j++) {
        if (
          sa[i] === sb[j] ||
          sa[i].indexOf(sb[j]) >= 0 ||
          sb[j].indexOf(sa[i]) >= 0
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function cleanTitleLoose(s) {
    return cleanTitle(
      String(s || "")
        .replace(/[-–—].*$/, "")
        .replace(/[（(\[【].*$/, ""),
    );
  }

  function parseDuration(d) {
    if (typeof d === "number") return d;
    var s = String(d || "").trim();
    if (s.indexOf(":") >= 0) {
      var parts = s.split(":");
      var sec = 0;
      for (var i = 0; i < parts.length; i++) {
        sec = sec * 60 + (Number(parts[i]) || 0);
      }
      return sec;
    }
    return Number(s) || 0;
  }

  function decodeEntities(s) {    return String(s || "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#(\d+);/g, function (_, n) {
        return String.fromCharCode(Number(n));
      });
  }

  async function searchKuwo(item) {
    var keyword = (item.title || "") + " " + (item.artist || "");
    if (!item.title) return null;
    var res = await axios.get(
      "https://search.kuwo.cn/r.s?client=kt&all=" +
        encodeURIComponent(keyword) +
        "&pn=0&rn=20&uid=2574109560&ver=kwplayer_ar_8.5.4.2&vipver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1",
      { headers: KW_HEADERS, timeout: 10000 },
    );
    var data = res.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
    var list = data && (data.abslist || data.list);
    if (!list || !list.length) return null;

    var targetTitle = cleanTitle(item.title);
    var targetTitleLoose = cleanTitleLoose(item.title);
    var targetDur = parseDuration(item.duration);
    var best = null;
    var bestScore = 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var title = decodeEntities(it.SONGNAME || it.NAME || "");
      if (!title) continue;
      var titleScore = 0;
      if (cleanTitle(title) === targetTitle) titleScore = 4;
      else if (
        targetTitleLoose &&
        cleanTitleLoose(title) === targetTitleLoose
      )
        titleScore = 2;
      if (!titleScore) continue;
      var candDur = Number(it.DURATION) || 0;
      var durOk =
        targetDur > 0 && candDur > 0 && Math.abs(candDur - targetDur) <= 3;
      var artistOk = artistMatch(item.artist, decodeEntities(it.ARTIST || ""));
      if (!durOk && !artistOk) continue;
      var score = titleScore + (durOk ? 2 : 0) + (artistOk ? 2 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = it;
      }
    }
    if (!best) return null;
    var rid = String(best.MUSICRID || best.MP3RID || "")
      .replace(/^MUSIC_/, "")
      .replace(/^MP3_/, "");
    if (!/^\d+$/.test(rid)) return null;
    return { rid: rid };
  }

  async function headSize(url) {
    try {
      var res = await axios.head(url, { headers: KW_HEADERS, timeout: 10000 });
      var h = res.headers || {};
      var len = Number(h["content-length"] || 0);
      var type = String(h["content-type"] || "");
      if (type && !/audio|octet-stream|mpeg|mp4|flac/i.test(type)) return 0;
      return len;
    } catch (e) {
      return 0;
    }
  }

  async function getKuwoUrl(item, quality) {
    var matched = null;
    try {
      matched = await searchKuwo(item);
    } catch (e) {}
    if (!matched) return null;

    var levels;
    if (quality === "low") levels = ["standard"];
    else if (quality === "standard") levels = ["exhigh", "standard"];
    else levels = ["lossless", "exhigh", "standard"];

    for (var i = 0; i < levels.length; i++) {
      try {
        var proxy =
          "https://music.nxinxz.com/kw.php?id=" +
          matched.rid +
          "&level=" +
          levels[i] +
          "&type=mp3";
        if ((await headSize(proxy)) > 500 * 1024) return proxy;
      } catch (e) {}
    }

    try {
      var res = await axios.get(
        "https://antiserver.kuwo.cn/anti.s?type=convert_url3&rid=" +
          matched.rid +
          "&format=mp3",
        { headers: KW_HEADERS, timeout: 10000 },
      );
      var url = res.data && res.data.url;
      if (url && (await headSize(url)) > 500 * 1024) return toHttps(url);
    } catch (e) {}

    return null;
  }

  async function getMediaSource(musicItem, quality) {
    if (!musicItem) return null;
    var url = null;
    try {
      url = await getKugouUrl(musicItem, quality);
    } catch (e) {}
    if (!url) {
      try {
        url = await getKuwoUrl(musicItem, quality);
      } catch (e) {}
    }
    if (!url) return null;
    return { url: url };
  }

  module.exports.getMediaSource = getMediaSource;
  module.exports.version = "0.1.1";
})();

