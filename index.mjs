import { Client, GatewayIntentBits } from "discord.js";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

// 1. 启动 Discord Bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);

// 2. 启动 Express API
const app = express();
app.use(express.json());

// 接收 Base44 推送 playlist
app.post("/pushPlaylist", async (req, res) => {
  const { title, description, city, imageUrl, pageUrl } = req.body;

  try {
    // 这里临时写死一个测试频道 ID
    // 后面可以用 city -> channelId 映射表
    const channelId = process.env.TEST_CHANNEL_ID;

    const channel = await client.channels.fetch(channelId);

    await channel.send({
      embeds: [
        {
          title: title || "Untitled Playlist",
          description: description || "No description",
          url: pageUrl,
          image: imageUrl ? { url: imageUrl } : null,
          color: 3447003,
          fields: [
            { name: "City", value: city || "Unknown", inline: true }
          ]
        }
      ]
    });

    console.log(`📤 Playlist pushed: ${title}`);
    res.json({ success: true, message: "Playlist pushed to Discord" });

  } catch (err) {
    console.error("❌ Push failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 监听端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API running on port ${PORT}`));
