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
      const messageDelete = await message.delete();
      let captureRegex = null;
      if (message.content.startsWith('!quote https://discordapp.com')) {
        captureRegex = /!quote (https:\/\/discordapp.com\/channels\/([0-9]+)\/([0-9]+)\/([0-9]+))(.*$)/gi;
      } else if (message.content.startsWith('!quote https://discord.com')) {
        captureRegex = /!quote (https:\/\/discord.com\/channels\/([0-9]+)\/([0-9]+)\/([0-9]+))(.*$)/gi;
      }
      const captureResult = captureRegex.exec(message.content);
      const [rawInput, quotedMessageUrl, serverId, channelId, messageId, textReply] = captureResult;
      if (rawInput && quotedMessageUrl && serverId && channelId && messageId) {
        const quotedServer = await client.guilds.get(serverId);
        const quotedChannel = await quotedServer.channels.get(channelId);
        const textChannel = new TextChannel(quotedServer, quotedChannel);
        const quotedMessage = await textChannel.fetchMessage(messageId);
        const messageEmbed = new RichEmbed();
        messageEmbed.setColor(quotedMessage.member.displayColor);
        messageEmbed.setAuthor(quotedMessage.author.username, quotedMessage.author.avatarURL, quotedMessageUrl);
        messageEmbed.setDescription(quotedMessage.content);
        if (quotedMessage.attachments) {
          const attachment = quotedMessage.attachments.entries().next().value[1];
          if (attachment.height && attachment.width) {
            messageEmbed.setImage(attachment.url);
          } else {
            messageEmbed.addField(
              attachment.filename,
              `File Size :: ${attachment.filesize.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",")} Bytes`
            );
          }
        }
        messageEmbed.setTimestamp(quotedMessage.createdTimestamp);
        messageEmbed.setFooter(
          `${quotedMessage.channel.guild.name} in #${quotedMessage.channel.name}`,
          `https://cdn.discordapp.com/icons/${quotedMessage.channel.guild.id}/${quotedMessage.channel.guild.icon}`
        );
        const messageSend = await message.channel.send(textReply, messageEmbed);
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