const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = ".";
const players = new Map();

// Slash commands
const commands = [
  new SlashCommandBuilder().setName('play').setDescription('Play a song')
    .addStringOption(option =>
      option.setName('song').setDescription('Song name or URL').setRequired(true)
    ),
  new SlashCommandBuilder().setName('stop').setDescription('Stop music')
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("✅ Slash commands ready");
  } catch (err) {
    console.log(err);
  }
});

// PLAY FUNCTION
async function playMusic(ctx, query) {
  try {
    const member = ctx.member;
    const channel = member.voice.channel;

    if (!channel) return ctx.reply("❌ Join voice channel first!");

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator
    });

    const stream = await play.stream(query);
    const resource = createAudioResource(stream.stream);

    const player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);

    players.set(channel.guild.id, player);

    player.on(AudioPlayerStatus.Idle, () => {
      connection.destroy();
    });

    return ctx.reply(`🎵 Playing: ${query}`);
  } catch (err) {
    console.log(err);
    return ctx.reply("❌ Failed to play song!");
  }
}

// Slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'play') {
    await interaction.deferReply();
    const song = interaction.options.getString('song');
    await playMusic(interaction, song);
  }

  if (interaction.commandName === 'stop') {
    const player = players.get(interaction.guild.id);
    if (player) player.stop();
    interaction.reply("⏹ Stopped");
  }
});

// Prefix commands
client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "play") {
    const query = args.join(" ");
    playMusic(message, query);
  }

  if (cmd === "stop") {
    const player = players.get(message.guild.id);
    if (player) player.stop();
    message.reply("⏹ Stopped");
  }
});

client.login(process.env.TOKEN);
