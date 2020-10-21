const readline = require("readline");
const { Client, RichEmbed, TextChannel, version } = require('discord.js');

const client = new Client();

// Go To Discord, Open DevTools (Ctrl + Shift + I), Under `Application` -> `Local Storage` -> `token`
// Put Your Token Here As String Into `DISCORD_LOGIN_TOKEN` Variable
let DISCORD_LOGIN_TOKEN = process.env.DISCORD_TOKEN || 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' || null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

client.on("ready", () => {
  console.log(`✨ User Logged In As :: ${client.user.username}#${client.user.discriminator}`);
  console.log(`🎉 Discord API & Token :: ${version} :: ${client.token}`);
});

client.on("message", async message => {
  try {
    console.log(`[${message.guild.name}] [${message.channel.name}] [${message.author.username}#${message.author.discriminator}] ${message.content}`);

    // Example :: Use `!quote <discord_msg_url> <ReplayMsgThat CanAlsoHave SpaceCharacter AndThisIsNotRequired>`
    // !quote https://discord.com/channels/281068107974443009/281068107974443009/767639372023201792 Reply Message Text Here
    if (message.content.startsWith('!quote') && message.author.id === client.user.id) {
      const captureRegex = /!quote (https:\/\/discord.com\/channels\/([0-9]+)\/([0-9]+)\/([0-9]+))(.*$)/gi;
      const captureResult = captureRegex.exec(message.content);
      const [rawInput, quotedMessageUrl, serverId, channelId, messageId, textReply] = captureResult;
      if (rawInput && quotedMessageUrl && serverId && channelId && messageId) {
        const quotedServer = await client.guilds.get(serverId);
        const quotedChannel = await quotedServer.channels.get(channelId);
        const textChannel = new TextChannel(quotedServer, quotedChannel);
        const quotedMessage = await textChannel.fetchMessage(messageId);
        const messageEmbed = new RichEmbed()
          .setColor(quotedMessage.member.displayColor)
          .setAuthor(quotedMessage.author.username, quotedMessage.author.avatarURL, quotedMessageUrl)
          .setDescription(quotedMessage.content)
          .setTimestamp(quotedMessage.createdTimestamp)
          .setFooter(`#${quotedMessage.channel.name} @ ${quotedMessage.channel.guild.name}`);
        const messageSend = await message.channel.send(textReply, messageEmbed);
        const messageDelete = await message.delete();
      }
    }

    // TODO :: You Can Add Other Self Bot Command Here

  } catch (err) {
    console.log(err);
  }
});

async function start() {
  try {
    const login = await client.login(DISCORD_LOGIN_TOKEN);
  } catch (err) {
    console.log(err);
    DISCORD_LOGIN_TOKEN = null;
    rl.question('🏹 Input User Token :: ', (token) => {
      DISCORD_LOGIN_TOKEN = token;
      start();
    });
  }
}

start();