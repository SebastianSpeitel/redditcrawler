"use strict";
const snoowrap = require("snoowrap");
const fs = require("fs");
const fetch = require("node-fetch");

const config = require("./config.json");
let secrets;
try {
  secrets = require("./secret.json");
} catch (e) {
  console.error("No secret.json found");
  process.exit(0);
}

const r = new snoowrap({
  userAgent: "sebastianspeitel@redditcrawler",
  clientId: secrets.clientId,
  clientSecret: secrets.clientSecret,
  username: secrets.username,
  password: secrets.password
});

r.config({
  requestDelay: 100
});

const igthft = r.getSubreddit(config.subreddit);

function cleanComments(comments) {
  return [...comments].map(c => {
    const r = {
      author: c.author.name,
      text: c.body,
      permalink: "https://reddit.com" + c.permalink
    };
    if (c.replies.length) r.replies = cleanComments(c.replies);

    return r;
  });
}

async function main() {
  const first = await igthft.getTop({
    time: "month"
  });

  const posts = await first.fetchMore({ amount: config.amount });

  console.log(posts.length);

  const selection = posts.map(async p => {
    const comments = cleanComments((await p.fetch()).comments);
    return {
      title: p.title,
      imgUrl: p.preview.images[0].source.url,
      permalink: "https://reddit.com" + p.permalink,
      comments: comments
    };
  });

  try {
    fs.mkdirSync("./posts");
  } catch {}
  selection.forEach(async p => {
    p = await p;
    const path =
      "./posts/" + p.permalink.split(".com", 2)[1].replace(/\//g, "_");
    try {
      fs.mkdirSync(path).catch(_ => _);
    } catch {}
    fs.writeFileSync(path + `/meta.json`, JSON.stringify(p, null, 2));
    fs.writeFileSync(
      path + `/comments.json`,
      JSON.stringify(p.comments, null, 2)
    );

    const url = p.imgUrl.split("?")[0];
    const resp = await fetch(p.imgUrl);

    const img = await resp.arrayBuffer();
    console.log(img);
    const ending = url.endsWith(".png") ? ".png" : ".jpg";
    fs.writeFileSync(path + `/image` + ending, Buffer(img));
  });
  fs.writeFileSync("./selected.json", JSON.stringify(selection, null, 2));
}

main();
