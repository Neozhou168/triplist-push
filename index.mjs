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

// 城市频道映射配置
const CITY_CHANNELS = {
  // 中文城市名映射
  '北京': process.env.BEIJING_CHANNEL,
  '上海': process.env.SHANGHAI_CHANNEL,
  '成都': process.env.CHENGDU_CHANNEL,
  '广州': process.env.GUANGZHOU_CHANNEL,
  '深圳': process.env.SHENZHEN_CHANNEL,
  '杭州': process.env.HANGZHOU_CHANNEL,
  '南京': process.env.NANJING_CHANNEL,
  '西安': process.env.XIAN_CHANNEL,
  '重庆': process.env.CHONGQING_CHANNEL,
  '天津': process.env.TIANJIN_CHANNEL,
  
  // 英文城市名映射
  'beijing': process.env.BEIJING_CHANNEL,
  'shanghai': process.env.SHANGHAI_CHANNEL,
  'chengdu': process.env.CHENGDU_CHANNEL,
  'guangzhou': process.env.GUANGZHOU_CHANNEL,
  'shenzhen': process.env.SHENZHEN_CHANNEL,
  'hangzhou': process.env.HANGZHOU_CHANNEL,
  'nanjing': process.env.NANJING_CHANNEL,
  'xian': process.env.XIAN_CHANNEL,
  'chongqing': process.env.CHONGQING_CHANNEL,
  'tianjin': process.env.TIANJIN_CHANNEL,
  
  // 备用默认频道
  'default': process.env.DEFAULT_CHANNEL || process.env.TEST_CHANNEL_ID
};

// 智能城市匹配函数
function getChannelIdByCity(city) {
  if (!city) {
    console.log('⚠️ No city provided, using default channel');
    return CITY_CHANNELS.default;
  }
  
  // 清理城市名称（去除空格、特殊字符，转为小写）
  const cleanCity = city.trim().toLowerCase().replace(/[^a-z\u4e00-\u9fa5]/g, '');
  
  // 直接匹配
  if (CITY_CHANNELS[cleanCity]) {
    console.log(`📍 Found direct match for city: ${city} -> ${cleanCity}`);
    return CITY_CHANNELS[cleanCity];
  }
  
  // 模糊匹配（检查是否包含关键词）
  const cityKeys = Object.keys(CITY_CHANNELS);
  const matchedKey = cityKeys.find(key => {
    if (key === 'default') return false;
    return cleanCity.includes(key) || key.includes(cleanCity);
  });
  
  if (matchedKey) {
    console.log(`📍 Found fuzzy match for city: ${city} -> ${matchedKey}`);
    return CITY_CHANNELS[matchedKey];
  }
  
  // 没有匹配，使用默认频道
  console.log(`📍 No match found for city: ${city}, using default channel`);
  return CITY_CHANNELS.default;
}

// 获取城市频道配置状态
function getCityChannelStatus() {
  const status = {};
  Object.entries(CITY_CHANNELS).forEach(([city, channelId]) => {
    status[city] = channelId ? 'Set' : 'Not Set';
  });
  return status;
}

// 创建富文本embed
function createPlaylistEmbed(playlistData) {
  const { title, description, city, travelType, imageUrl, pageUrl, relatedVenues = [], relatedRoutes = [] } = playlistData;
  
  const embed = new EmbedBuilder()
    .setTitle(title || "Untitled Triplist")
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

  // 优化图片显示 - 特别针对Cloudinary图片进行优化
  if (imageUrl && !imageUrl.includes('example.com')) {
    let optimizedImageUrl = imageUrl;
    
    // 检测Cloudinary URL并进行优化
    if (imageUrl.includes('cloudinary.com')) {
      // Cloudinary URL优化：添加变换参数确保大图显示
      const cloudinaryOptimizations = [
        'w_1200',      // 宽度1200px
        'h_675',       // 高度675px (16:9比例)
        'c_fill',      // 填充模式，保持比例
        'q_auto',      // 自动质量
        'f_auto'       // 自动格式
      ].join(',');
      
      // 在Cloudinary URL中插入变换参数
      optimizedImageUrl = imageUrl.replace(
        '/upload/', 
        `/upload/${cloudinaryOptimizations}/`
      );
      
      console.log(`🖼️ Cloudinary optimization applied`);
      console.log(`📐 Original: ${imageUrl}`);
      console.log(`✨ Optimized: ${optimizedImageUrl}`);
    } else {
      // 非Cloudinary图片的通用优化尝试
      console.log(`🖼️ Non-Cloudinary image, using original: ${imageUrl}`);
    }
    
    embed.setImage(optimizedImageUrl);
  }

  // 添加部分景点信息到embed - 优化显示
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

// 健康检查接口 - 显示城市频道配置状态
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    botReady: botReady,
    timestamp: new Date().toISOString(),
    version: "3.1 - Multi-City Channels",
    cityChannels: getCityChannelStatus()
  });
});
function createDirectLinkButtons(relatedVenues = [], relatedRoutes = [], pageUrl) {
  const rows = [];
  
  if (!pageUrl) {
    console.log('⚠️ No pageUrl provided, skipping button creation');
    return rows;
  }
  
  if (relatedVenues.length > 0 || relatedRoutes.length > 0) {
    const mainRow = new ActionRowBuilder();
    
    const totalItems = relatedVenues.length + relatedRoutes.length;
    
    // 方案A: 直接定位到"Related Routes & Venues"部分
    const targetUrl = `${pageUrl}#related-routes-venues`;
    
    mainRow.addComponents(
      new ButtonBuilder()
        .setLabel(`🌟 View ${totalItems} Venues & Routes`)
        .setStyle(ButtonStyle.Link)
        .setURL(targetUrl)
    );
    
    console.log(`🔗 Button URL with anchor: ${targetUrl}`);
    
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

// 主要API端点 - 推送triplist到Discord
app.post("/pushPlaylist", async (req, res) => {
  const playlistData = req.body;
  const { title, description, city, travelType, imageUrl, pageUrl, relatedVenues, relatedRoutes } = playlistData;

  try {
    // 检查Bot是否准备好
    if (!botReady) {
      throw new Error("Discord bot is not ready yet");
    }

    // 根据城市选择对应的频道ID
    const channelId = getChannelIdByCity(city);
    if (!channelId) {
      throw new Error("No suitable channel found. Please check city channel configuration.");
    }

    console.log(`🔍 Processing triplist: ${title}`);
    console.log(`📊 City: ${city || 'Unknown'}, Venues: ${relatedVenues?.length || 0}, Routes: ${relatedRoutes?.length || 0}`);
    console.log(`📍 Selected channel ID: ${channelId}`);
    console.log(`🔗 Page URL: ${pageUrl || 'No URL provided'}`);
    console.log(`🖼️ Image URL: ${imageUrl || 'No image provided'}`);
    
    // 分析图片URL以帮助调试
    if (imageUrl) {
      const imageAnalysis = {
        hasExtension: /\.(jpg|jpeg|png|gif|webp)$/i.test(imageUrl),
        hasParameters: imageUrl.includes('?'),
        length: imageUrl.length,
        domain: new URL(imageUrl).hostname
      };
      console.log(`🔍 Image analysis:`, imageAnalysis);
    }
    
    // 获取频道
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    console.log(`📡 Channel found: ${channel.name} (${channel.type})`);
    console.log(`🔍 Channel details:`, {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      isForumChannel: channel.type === 15,
      parentId: channel.parentId || 'None',
      availableTags: channel.availableTags?.length || 0
    });
    
    // 检查Bot在服务器中的权限
    const guild = channel.guild;
    const botMember = await guild.members.fetch(client.user.id);
    const permissions = botMember.permissions;
    
    console.log(`🔧 Bot permissions in guild:`, permissions.toArray());
    console.log(`🔧 Has USE_APPLICATION_COMMANDS:`, permissions.has('UseApplicationCommands'));
    console.log(`🔧 Has SEND_MESSAGES:`, permissions.has('SendMessages'));

    // 创建富文本embed
    const embed = createPlaylistEmbed(playlistData);
    
    // 创建直接跳转按钮
    const components = createDirectLinkButtons(relatedVenues, relatedRoutes, pageUrl);

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
      
      // 详细分析Forum频道设置
      console.log(`🔍 Forum channel analysis:`, {
        defaultAutoArchiveDuration: channel.defaultAutoArchiveDuration,
        defaultThreadRateLimitPerUser: channel.defaultThreadRateLimitPerUser,
        flags: channel.flags?.toArray(),
        defaultReactionEmoji: channel.defaultReactionEmoji
      });
      
      // 创建帖子的配置
      const threadConfig = {
        name: title || "New Triplist",
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
      console.log(`🔗 Thread URL: https://discord.com/channels/${guild.id}/${thread.id}`);
      
      // 分析创建的thread
      console.log(`🧵 Thread details:`, {
        id: thread.id,
        name: thread.name,
        type: thread.type,
        appliedTags: thread.appliedTags?.length || 0
      });
      
    } else if (channel.isTextBased()) {
      console.log(`💬 Sending message to text channel: ${channel.name}`);
      console.log(`📊 Text channel details:`, {
        type: channel.type,
        isThread: channel.isThread(),
        parentId: channel.parentId
      });
      
      // 普通文本频道直接发送
      await channel.send(messageData);
      
    } else {
      throw new Error(`Unsupported channel type: ${channel.type}. Please use a text channel or forum channel.`);
    }

      console.log(`📤 Triplist pushed successfully to ${city || 'default'} channel: ${title}`);
    res.json({ 
      success: true, 
      message: `Triplist pushed to Discord ${city || 'default'} channel with direct website link`,
      city: city,
      channelId: channelId,
      pageUrl: pageUrl,
      stats: {
        travelType: travelType,
        venues: relatedVenues?.length || 0,
        routes: relatedRoutes?.length || 0,
        totalItems: (relatedVenues?.length || 0) + (relatedRoutes?.length || 0),
        redirect_to_website: true,
        no_caching_needed: true,
        button_created: pageUrl ? true : false
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

// 管理API - 查看城市频道配置
app.get("/admin/channels", async (req, res) => {
  try {
    const cityStatus = getCityChannelStatus();
    const channelDetails = {};
    
    // 获取每个频道的详细信息
    for (const [city, channelId] of Object.entries(CITY_CHANNELS)) {
      if (channelId) {
        try {
          const channel = await client.channels.fetch(channelId);
          channelDetails[city] = {
            id: channelId,
            name: channel.name,
            type: channel.type,
            status: 'Connected',
            // 添加Forum频道特有的设置分析
            isForumChannel: channel.type === 15,
            availableTags: channel.availableTags?.length || 0,
            defaultAutoArchiveDuration: channel.defaultAutoArchiveDuration || 'Not set',
            flags: channel.flags?.toArray() || [],
            parentId: channel.parentId || 'None'
          };
        } catch (error) {
          channelDetails[city] = {
            id: channelId,
            name: 'Unknown',
            type: 'Unknown',
            status: 'Error - Channel not found',
            isForumChannel: false,
            availableTags: 0
          };
        }
      } else {
        channelDetails[city] = {
          id: null,
          name: null,
          type: null,
          status: 'Not Configured',
          isForumChannel: false,
          availableTags: 0
        };
      }
    }
    
    res.json({
      success: true,
      botReady: botReady,
      channels: channelDetails,
      summary: {
        total: Object.keys(CITY_CHANNELS).length,
        configured: Object.values(CITY_CHANNELS).filter(id => id).length,
        connected: Object.values(channelDetails).filter(ch => ch.status === 'Connected').length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 测试API - 测试城市匹配
app.get("/test/city/:cityName", (req, res) => {
  const cityName = req.params.cityName;
  const channelId = getChannelIdByCity(cityName);
  
  res.json({
    input: cityName,
    matchedChannelId: channelId,
    isDefault: channelId === CITY_CHANNELS.default,
    availableCities: Object.keys(CITY_CHANNELS).filter(key => key !== 'default')
  });
});
app.get("/venue/:id", async (req, res) => {
  res.json({
    id: req.params.id,
    message: "This endpoint is deprecated. Please use direct website links instead.",
    redirect: `https://pandahoho.com/venue/${req.params.id}`
  });
});

app.get("/route/:id", async (req, res) => {
  res.json({
    id: req.params.id,
    message: "This endpoint is deprecated. Please use direct website links instead.",
    redirect: `https://pandahoho.com/route/${req.params.id}`
  });
});

// 监听端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API running on port ${PORT}`);
  console.log(`🔑 Bot Token: ${process.env.DISCORD_BOT_TOKEN ? 'Set' : 'Not Set'}`);
  console.log(`🌐 Frontend Base URL: ${process.env.FRONTEND_BASE_URL || 'https://pandahoho.com'}`);
  console.log(`✨ Version: 3.1 - Multi-City Channels Support`);
  
  // 显示城市频道配置状态
  console.log(`📍 City Channels Configuration:`);
  const cityStatus = getCityChannelStatus();
  Object.entries(cityStatus).forEach(([city, status]) => {
    console.log(`   ${city}: ${status}`);
  });
  
  // 警告未配置的频道
  const unsetChannels = Object.entries(cityStatus).filter(([_, status]) => status === 'Not Set');
  if (unsetChannels.length > 0) {
    console.log(`⚠️  Warning: ${unsetChannels.length} city channels are not configured`);
  }
});

// 注意：虽然API endpoint仍然是 /pushPlaylist (保持向后兼容)，但现在处理的是 Triplist 数据