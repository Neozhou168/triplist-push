import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

// 1. 启动 Discord Bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

let botReady = false;

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🔧 Bot ID: ${client.user.id}`);
  console.log(`🔧 Bot permissions in guild should include: USE_APPLICATION_COMMANDS`);
  botReady = true;
});

client.on("error", (error) => {
  console.error("❌ Discord client error:", error);
});

// 处理按钮交互
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  console.log(`🔘 Button interaction received: ${interaction.customId}`);
  const { customId } = interaction;
  
  try {
    // 确保在3秒内回复，避免超时
    if (customId === 'show_venues') {
      console.log(`📋 Processing show_venues interaction`);
      
      const venuesList = `📋 **All Venues in this Playlist:**

🏛️ **Featured Museums & Cultural Sites**
Explore Beijing's rich cultural heritage through its temples, museums, and historic streets.

🏛️ **Fayuan Temple 法源寺**
Ancient Buddhist temple with beautiful gardens

🏛️ **Beijing Xuannan Cultural Museum (北京宣南文化博物馆)**
Discover the cultural history of southern Beijing

🏛️ **Liulichang Cultural Street (琉璃厂文化街)**
Historic street famous for antiques and traditional crafts

*...and many more venues to explore!*

💡 **Tip**: Click the playlist title above to visit the full page with detailed venue information, photos, and directions!`;

      await interaction.reply({
        content: venuesList,
        ephemeral: true
      });
      
      console.log(`✅ show_venues interaction completed successfully`);
      
    } else if (customId === 'show_routes') {
      console.log(`🗺️ Processing show_routes interaction`);
      
      const routesList = `🗺️ **All Routes in this Playlist:**

📍 **Cultural Heritage Walking Route**
A carefully planned route connecting Beijing's most significant cultural sites

📍 **Museum District Tour**
Explore the concentrated cultural attractions in this historic area

📍 **Traditional Architecture Path**
Follow the architectural evolution through different dynasties

💡 **Tip**: Click the playlist title above to access detailed route maps, timing suggestions, and step-by-step directions!`;

      await interaction.reply({
        content: routesList,
        ephemeral: true
      });
      
      console.log(`✅ show_routes interaction completed successfully`);
      
    } else if (customId.startsWith('venue_') || customId.startsWith('route_')) {
      const [type, action, id] = customId.split('_');
      console.log(`🔗 Processing ${type}_${action} interaction for ID: ${id}`);
      
      if (action === 'view') {
        const baseUrl = process.env.FRONTEND_BASE_URL || 'https://pandahoho.com';
        const detailUrl = type === 'venue' 
          ? `${baseUrl}/VenueDetail?id=${id}`
          : `${baseUrl}/RouteDetail?id=${id}`;
        
        await interaction.reply({
          content: `🔗 [View ${type === 'venue' ? 'Venue' : 'Route'} Details](${detailUrl})`,
          ephemeral: true
        });
      } else if (action === 'maps') {
        await interaction.reply({
          content: `🗺️ Opening Google Maps for this ${type}...`,
          ephemeral: true
        });
      }
      
      console.log(`✅ ${type}_${action} interaction completed successfully`);
    } else {
      console.log(`⚠️ Unknown interaction customId: ${customId}`);
      await interaction.reply({
        content: '❓ Unknown action. Please try again or contact support.',
        ephemeral: true
      });
    }
    
  } catch (error) {
    console.error(`❌ Button interaction error for customId "${customId}":`, error);
    console.error(`❌ Error stack:`, error.stack);
    
    // 尝试回复错误消息
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `❌ Sorry, there was a technical issue. Error: ${error.message}`,
          ephemeral: true
        });
      } else {
        console.log(`⚠️ Interaction already replied/deferred, cannot send error message`);
      }
    } catch (replyError) {
      console.error(`❌ Failed to send error reply:`, replyError);
    }
  }
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

// CORS配置 - 根据Base44要求
const corsOptions = {
  origin: [
    'https://www.pandahoho.com',
    'https://pandahoho.com',
    'https://base44.app',
    'https://*.base44.app',
    // Base44 preview和开发域名
    'https://preview--panda-hoho-2459df7e.base44.app',
    /^https:\/\/preview--.*\.base44\.app$/,  // 匹配所有preview域名
    /^https:\/\/.*\.base44\.app$/,           // 匹配所有base44.app子域名
    'http://localhost:3000'  // for local development
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: false
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// 健康检查接口
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    botReady: botReady,
    timestamp: new Date().toISOString()
  });
});

// 创建富文本embed
function createPlaylistEmbed(playlistData) {
  const { title, description, city, travelType, imageUrl, pageUrl, relatedVenues = [], relatedRoutes = [] } = playlistData;
  
  const embed = new EmbedBuilder()
    .setTitle(title || "Untitled Playlist")
    .setDescription(description || "No description")
    .setColor(0x3447FF)
    .addFields(
      { name: "📍 City", value: city || "Unknown", inline: true },
      { name: "🎯 Travel Type", value: travelType || "General", inline: true },
      { name: "🏛️ Venues", value: relatedVenues.length.toString(), inline: true },
      { name: "🗺️ Routes", value: relatedRoutes.length.toString(), inline: true }
    )
    .setTimestamp();

  if (pageUrl) {
    embed.setURL(pageUrl);
  }

  if (imageUrl && !imageUrl.includes('example.com')) {
    embed.setImage(imageUrl);
  }

  // 添加部分景点信息到embed
  if (relatedVenues.length > 0) {
    const venueList = relatedVenues.slice(0, 3).map(venue => `• ${venue.name}`).join('\n');
    const moreVenues = relatedVenues.length > 3 ? `\n... and ${relatedVenues.length - 3} more` : '';
    embed.addFields({
      name: "🏛️ Featured Venues",
      value: venueList + moreVenues,
      inline: false
    });
  }

  if (relatedRoutes.length > 0) {
    const routeList = relatedRoutes.slice(0, 2).map(route => `• ${route.name}`).join('\n');
    const moreRoutes = relatedRoutes.length > 2 ? `\n... and ${relatedRoutes.length - 2} more` : '';
    embed.addFields({
      name: "🗺️ Available Routes",
      value: routeList + moreRoutes,
      inline: false
    });
  }

  return embed;
}

// 创建交互按钮
function createInteractionButtons(relatedVenues = [], relatedRoutes = []) {
  const rows = [];
  
  // 如果有多个venues/routes，创建选择按钮
  if (relatedVenues.length > 0 || relatedRoutes.length > 0) {
    const mainRow = new ActionRowBuilder();
    
    if (relatedVenues.length > 0) {
      mainRow.addComponents(
        new ButtonBuilder()
          .setCustomId('show_venues')
          .setLabel(`View Venues (${relatedVenues.length})`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🏛️')
      );
    }
    
    if (relatedRoutes.length > 0) {
      mainRow.addComponents(
        new ButtonBuilder()
          .setCustomId('show_routes')
          .setLabel(`View Routes (${relatedRoutes.length})`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🗺️')
      );
    }
    
    rows.push(mainRow);
  }

  return rows;
}

// 智能标签匹配函数
function findBestTag(availableTags, travelType, city, title, description) {
  if (availableTags.length === 0) return null;
  
  // 1. 优先匹配Travel Type（去除表情符号进行匹配）
  if (travelType) {
    const travelTypeTag = availableTags.find(tag => {
      const cleanTagName = tag.name.replace(/[^\w\s]/g, '').trim().toLowerCase();
      const cleanTravelType = travelType.toLowerCase();
      return cleanTagName.includes(cleanTravelType) || cleanTravelType.includes(cleanTagName);
    });
    if (travelTypeTag) return travelTypeTag;
  }
  
  // 2. 匹配城市标签
  if (city) {
    const cityTag = availableTags.find(tag => 
      tag.name.toLowerCase().includes(city.toLowerCase())
    );
    if (cityTag) return cityTag;
  }
  
  // 3. 匹配标题关键词
  if (title) {
    const titleTag = availableTags.find(tag => {
      const cleanTagName = tag.name.replace(/[^\w\s]/g, '').trim().toLowerCase();
      return title.toLowerCase().includes(cleanTagName) || cleanTagName.includes(title.toLowerCase());
    });
    if (titleTag) return titleTag;
  }
  
  // 4. 匹配描述关键词
  if (description) {
    const descTag = availableTags.find(tag => {
      const cleanTagName = tag.name.replace(/[^\w\s]/g, '').trim().toLowerCase();
      return description.toLowerCase().includes(cleanTagName);
    });
    if (descTag) return descTag;
  }
  
  // 5. 默认返回第一个标签
  return availableTags[0];
}

// 添加更详细的权限检查
app.post("/pushPlaylist", async (req, res) => {
  const playlistData = req.body;
  const { title, description, city, travelType, imageUrl, pageUrl, relatedVenues, relatedRoutes } = playlistData;

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
    console.log(`📊 Playlist data: ${title}, Travel Type: ${travelType}, Venues: ${relatedVenues?.length || 0}, Routes: ${relatedRoutes?.length || 0}`);
    
    // 获取频道
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    console.log(`📡 Channel found: ${channel.name} (${channel.type})`);
    
    // 检查Bot在服务器中的权限
    const guild = channel.guild;
    const botMember = await guild.members.fetch(client.user.id);
    const permissions = botMember.permissions;
    
    console.log(`🔧 Bot permissions in guild:`, permissions.toArray());
    console.log(`🔧 Has USE_APPLICATION_COMMANDS:`, permissions.has('UseApplicationCommands'));
    console.log(`🔧 Has SEND_MESSAGES:`, permissions.has('SendMessages'));

    // 创建富文本embed
    const embed = createPlaylistEmbed(playlistData);
    
    // 创建交互按钮
    const components = createInteractionButtons(relatedVenues, relatedRoutes);

    // 准备消息内容
    const messageData = {
      embeds: [embed],
      components: components
    };

    // 根据频道类型发送消息
    if (channel.type === 15) { // 15 = Forum Channel
      console.log(`📋 Creating forum post in: ${channel.name}`);
      
      // 获取可用的标签
      const availableTags = channel.availableTags || [];
      console.log(`📌 Available tags: ${availableTags.length}`);
      
      // 创建帖子的配置
      const threadConfig = {
        name: title || "New Playlist",
        message: messageData
      };
      
      // 智能标签选择（优先匹配Travel Type）
      if (availableTags.length > 0) {
        const selectedTag = findBestTag(availableTags, travelType, city, title, description);
        
        if (selectedTag) {
          threadConfig.appliedTags = [selectedTag.id];
          console.log(`🏷️ Using tag: ${selectedTag.name} (matched by: ${travelType ? 'Travel Type' : 'fallback'})`);
        }
      } else {
        console.log(`🏷️ No tags available, creating without tags`);
      }
      
      const thread = await channel.threads.create(threadConfig);
      console.log(`📝 Forum post created: ${thread.name}`);
      console.log(`🔧 Thread ID: ${thread.id} - Bot should be able to respond to interactions in this thread`);
      
      // 如果有很多venues/routes，可以发送一个follow-up消息
      if ((relatedVenues?.length || 0) + (relatedRoutes?.length || 0) > 5) {
        setTimeout(async () => {
          await thread.send({
            content: `💡 **Tip**: This playlist contains ${relatedVenues?.length || 0} venues and ${relatedRoutes?.length || 0} routes. Use the buttons above to explore them all!`,
          });
        }, 1000);
      }
      
    } else if (channel.isTextBased()) {
      console.log(`💬 Sending message to text channel: ${channel.name}`);
      
      // 普通文本频道直接发送
      await channel.send(messageData);
      
    } else {
      throw new Error(`Unsupported channel type: ${channel.type}. Please use a text channel or forum channel.`);
    }

    console.log(`📤 Playlist pushed successfully: ${title}`);
    res.json({ 
      success: true, 
      message: "Playlist pushed to Discord",
      stats: {
        travelType: travelType,
        venues: relatedVenues?.length || 0,
        routes: relatedRoutes?.length || 0
      }
    });

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

// 新增：获取venue/route详细信息的API端点
app.get("/venue/:id", async (req, res) => {
  res.json({
    id: req.params.id,
    message: "Venue details would be fetched from database"
  });
});

app.get("/route/:id", async (req, res) => {
  res.json({
    id: req.params.id,
    message: "Route details would be fetched from database"
  });
});

// 监听端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API running on port ${PORT}`);
  console.log(`🔑 Bot Token: ${process.env.DISCORD_BOT_TOKEN ? 'Set' : 'Not Set'}`);
  console.log(`📺 Channel ID: ${process.env.TEST_CHANNEL_ID ? 'Set' : 'Not Set'}`);
  console.log(`🌐 Frontend Base URL: ${process.env.FRONTEND_BASE_URL || 'https://pandahoho.com'}`);
});