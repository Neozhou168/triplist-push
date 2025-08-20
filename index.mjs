import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

// 存储playlist数据的缓存
const playlistCache = new Map();

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
    if (customId.startsWith('show_venues_')) {
      const playlistId = customId.replace('show_venues_', '');
      const playlistData = playlistCache.get(playlistId);
      
      console.log(`📋 Processing show_venues interaction for playlist: ${playlistId}`);
      
      if (!playlistData) {
        await interaction.reply({
          content: '❌ Playlist data not found. Please try refreshing.',
          ephemeral: true
        });
        return;
      }

      // 创建venues列表，每个venue下面有自己的地图按钮
      let venuesList = `📋 **Venues in this Playlist:**\n\n`;
      
      // 创建动态按钮行
      const actionRows = [];
      let currentRow = new ActionRowBuilder();
      let buttonCount = 0;
      let processedVenues = 0;
      const maxContentLength = 1500;

      playlistData.relatedVenues.forEach((venue, index) => {
        // 尝试多种可能的字段名来查找Google Maps URL
        const googleMapsUrl = venue['Google Maps Direct URL'] || 
                             venue['googleMapsUrl'] || 
                             venue['googleMapsDirectUrl'] || 
                             venue['google_maps_url'] ||
                             venue['mapUrl'] ||
                             venue['mapsUrl'];
        
        // 计算这个venue条目的完整内容
        const venueContent = `🏛️ **${venue.name}**\n${googleMapsUrl ? '📍 [Open in Google Maps](' + googleMapsUrl + ')\n' : ''}`;
        
        if (venuesList.length + venueContent.length > maxContentLength) {
          venuesList += `*... and ${playlistData.relatedVenues.length - index} more venues*`;
          return false;
        }
        
        venuesList += venueContent + '\n';
        processedVenues++;

        // Discord限制最多显示前25个venues
        if (processedVenues >= 25) {
          venuesList += `*Showing first ${processedVenues} venues*`;
          return false;
        }
      });

      venuesList += `💡 *Tip: Click playlist title for full details!*`;

      await interaction.reply({
        content: venuesList,
        ephemeral: true
      });
      
      console.log(`✅ show_venues interaction completed successfully`);
      
    } else if (customId.startsWith('show_routes_')) {
      const playlistId = customId.replace('show_routes_', '');
      const playlistData = playlistCache.get(playlistId);
      
      console.log(`🗺️ Processing show_routes interaction for playlist: ${playlistId}`);
      
      if (!playlistData) {
        await interaction.reply({
          content: '❌ Playlist data not found. Please try refreshing.',
          ephemeral: true
        });
        return;
      }

      let routesList = `🗺️ **Routes in this Playlist:**\n\n`;
      
      let processedRoutes = 0;
      const maxContentLength = 1500;

      playlistData.relatedRoutes.forEach((route, index) => {
        // 尝试多种可能的字段名来查找Google Maps URL
        const googleMapsUrl = route['Google Maps Direct URL'] || 
                             route['googleMapsUrl'] || 
                             route['googleMapsDirectUrl'] || 
                             route['google_maps_url'] ||
                             route['mapUrl'] ||
                             route['mapsUrl'];

        // 计算这个route条目的完整内容
        const routeContent = `📍 **${route.name}**\n${googleMapsUrl ? '🗺️ [View Route on Google Maps](' + googleMapsUrl + ')\n' : ''}`;
        
        if (routesList.length + routeContent.length > maxContentLength) {
          routesList += `*... and ${playlistData.relatedRoutes.length - index} more routes*`;
          return false;
        }
        
        routesList += routeContent + '\n';
        processedRoutes++;

        // Discord限制最多显示前25个routes
        if (processedRoutes >= 25) {
          routesList += `*Showing first ${processedRoutes} routes*`;
          return false;
        }
      });

      routesList += `💡 *Tip: Click playlist title for detailed route info!*`;

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
    timestamp: new Date().toISOString(),
    cachedPlaylists: playlistCache.size
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
function createInteractionButtons(relatedVenues = [], relatedRoutes = [], playlistId) {
  const rows = [];
  
  // 如果有多个venues/routes，创建选择按钮
  if (relatedVenues.length > 0 || relatedRoutes.length > 0) {
    const mainRow = new ActionRowBuilder();
    
    if (relatedVenues.length > 0) {
      // 统计有Google Maps链接的venues数量 - 支持多种字段名
      const venuesWithMaps = relatedVenues.filter(v => 
        v['Google Maps Direct URL'] || 
        v['googleMapsUrl'] || 
        v['googleMapsDirectUrl'] || 
        v['google_maps_url'] ||
        v['mapUrl'] ||
        v['mapsUrl']
      ).length;
      const label = venuesWithMaps > 0 
        ? `View Venues (${relatedVenues.length}) 📍`
        : `View Venues (${relatedVenues.length})`;
        
      mainRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`show_venues_${playlistId}`)
          .setLabel(label)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🏛️')
      );
    }
    
    if (relatedRoutes.length > 0) {
      const routesWithMaps = relatedRoutes.filter(r => 
        r['Google Maps Direct URL'] || 
        r['googleMapsUrl'] || 
        r['googleMapsDirectUrl'] || 
        r['google_maps_url'] ||
        r['mapUrl'] ||
        r['mapsUrl']
      ).length;
      const label = routesWithMaps > 0 
        ? `View Routes (${relatedRoutes.length}) 📍`
        : `View Routes (${relatedRoutes.length})`;
        
      mainRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`show_routes_${playlistId}`)
          .setLabel(label)
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
    // 生成唯一的playlist ID
    const playlistId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    // 缓存playlist数据以供按钮交互使用
    playlistCache.set(playlistId, playlistData);
    
    // 在30分钟后清理缓存
    setTimeout(() => {
      playlistCache.delete(playlistId);
      console.log(`🗑️ Cleaned up cache for playlist: ${playlistId}`);
    }, 30 * 60 * 1000);

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
    console.log(`📊 Playlist data: ${title} (ID: ${playlistId}), Travel Type: ${travelType}, Venues: ${relatedVenues?.length || 0}, Routes: ${relatedRoutes?.length || 0}`);
    
    // 统计有Google Maps链接的数量 - 支持多种字段名
    const venuesWithMaps = relatedVenues?.filter(v => 
      v['Google Maps Direct URL'] || 
      v['googleMapsUrl'] || 
      v['googleMapsDirectUrl'] || 
      v['google_maps_url'] ||
      v['mapUrl'] ||
      v['mapsUrl']
    )?.length || 0;
    
    const routesWithMaps = relatedRoutes?.filter(r => 
      r['Google Maps Direct URL'] || 
      r['googleMapsUrl'] || 
      r['googleMapsDirectUrl'] || 
      r['google_maps_url'] ||
      r['mapUrl'] ||
      r['mapsUrl']
    )?.length || 0;
    console.log(`🗺️ Venues with Google Maps: ${venuesWithMaps}, Routes with Google Maps: ${routesWithMaps}`);
    
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
    const components = createInteractionButtons(relatedVenues, relatedRoutes, playlistId);

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
      playlistId: playlistId,
      stats: {
        travelType: travelType,
        venues: relatedVenues?.length || 0,
        routes: relatedRoutes?.length || 0,
        venuesWithMaps: venuesWithMaps,
        routesWithMaps: routesWithMaps
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