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

let botReady = false;

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  botReady = true;
});

client.on("error", (error) => {
  console.error("❌ Discord client error:", error);
});

// 登录Discord Bot
if (process.env.DISCORD_BOT_TOKEN) {
  client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
    console.error("❌ Failed to login to Discord:", error);
  });
} else {
  console.error("❌ DISCORD_BOT_TOKEN not found in environment variables");
}

// 2. 启动 Express API
const app = express();
app.use(express.json());

// 健康检查接口
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    botReady: botReady,
    timestamp: new Date().toISOString()
  });
});

// 接收 Base44 推送 playlist
app.post("/pushPlaylist", async (req, res) => {
  const { title, description, city, imageUrl, pageUrl } = req.body;

  try {
    // 检查Bot是否准备好
    if (!botReady) {
      throw new Error("Discord bot is not ready yet");
    }

    // 检查环境变量
    const channelId = process.env.TEST_CHANNEL_ID;
    if (!channelId) {
      throw new Error("TEST_CHANNEL_ID not found in environment variables");
    }

    console.log(`🔍 Attempting to fetch channel: ${channelId}`);
    
    // 获取频道
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    console.log(`📡 Channel found: ${channel.name} (${channel.type})`);

    // 检查频道类型和权限
    if (!channel.isTextBased()) {
      throw new Error("Channel is not a text-based channel");
    }

    // 发送消息
    const embedData = {
      title: title || "Untitled Playlist",
      description: description || "No description",
      url: pageUrl,
      color: 3447003,
      fields: [
        { name: "City", value: city || "Unknown", inline: true }
      ],
      timestamp: new Date().toISOString()
    };

    // 只有当imageUrl存在且不是示例URL时才添加图片
    if (imageUrl && !imageUrl.includes('example.com')) {
      embedData.image = { url: imageUrl };
    }

    await channel.send({
      embeds: [embedData]
    });

    console.log(`📤 Playlist pushed successfully: ${title}`);
    res.json({ success: true, message: "Playlist pushed to Discord" });

  } catch (err) {
    console.error("❌ Push failed:", err.message);
    console.error("❌ Full error:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// 监听端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API running on port ${PORT}`);
  console.log(`🔑 Bot Token: ${process.env.DISCORD_BOT_TOKEN ? 'Set' : 'Not Set'}`);
  console.log(`📺 Channel ID: ${process.env.TEST_CHANNEL_ID ? 'Set' : 'Not Set'}`);
});