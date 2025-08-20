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

    // 准备消息内容
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

    // 根据频道类型发送消息
    if (channel.type === 15) { // 15 = Forum Channel
      console.log(`📋 Creating forum post in: ${channel.name}`);
      
      // 获取可用的标签
      const availableTags = channel.availableTags || [];
      console.log(`📌 Available tags: ${availableTags.length}`);
      
      // 创建帖子的配置
      const threadConfig = {
        name: title || "New Playlist",
        message: {
          embeds: [embedData]
        }
      };
      
      // 如果有可用标签，使用第一个；如果没有标签要求，留空
      if (availableTags.length > 0) {
        threadConfig.appliedTags = [availableTags[0].id];
        console.log(`🏷️ Using tag: ${availableTags[0].name}`);
      } else {
        console.log(`🏷️ No tags available, creating without tags`);
      }
      
      const thread = await channel.threads.create(threadConfig);
      console.log(`📝 Forum post created: ${thread.name}`);
      
    } else if (channel.isTextBased()) {
      console.log(`💬 Sending message to text channel: ${channel.name}`);
      
      // 普通文本频道直接发送
      await channel.send({
        embeds: [embedData]
      });
      
    } else {
      throw new Error(`Unsupported channel type: ${channel.type}. Please use a text channel or forum channel.`);
    }

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