const { Client, RichEmbed, TextChannel } = require('discord.js');

const client = new Client();

// Go To Discord, Open DevTools (Ctrl + Shift + I), Under `Application` -> `Local Storage` -> `token`
const DISCORD_LOGIN_TOKEN = "COPY_PASTE_YOUR_LOGIN_AUTH_TOKEN_HERE";

client.on("ready", () => {
  console.log(`✨ Client Logged In As :: ${client.user.username}#${client.user.discriminator}`);
});

client.on("message", async message => {
  console.log(`[${message.guild.name}] [${message.channel.name}] [${message.author.username}#${message.author.discriminator}] ${message.content}`);

  // Example :: Use `!quote <discord_msg_url> <ReplayMsgThat CanAlsoHave SpaceCharacter AndThisIsNotRequired>`
  // !quote https://discord.com/channels/281068107974443009/281068107974443009/767639372023201792 Reply Message Text Here
  if (message.content.startsWith('!quote') && message.author.id === client.user.id) {
    const captureRegex = /!quote (https:\/\/discord.com\/channels\/([0-9]+)\/([0-9]+)\/([0-9]+))(.*$)/gi;
    const captureResult = captureRegex.exec(message.content);
    const [rawInput, MessageUrl, serverId, channelId, messageId, textReply] = captureResult;
    if (rawInput && MessageUrl && serverId && channelId && messageId) {
      const quotedServer = await client.guilds.get(serverId);
      const quotedChannel = await quotedServer.channels.get(channelId);
      const textChannel = new TextChannel(quotedServer, quotedChannel);
      const quotedMessage = await textChannel.fetchMessage(messageId);
      embedQuote(MessageUrl, message.channel, quotedMessage, textReply);
      message.delete().catch(console.error);
    }
  }

  // TODO :: You Can Add Other Self Bot Command Here

});

function embedQuote(MessageUrl, channel, quotedMessage, textReply) {
  const messageEmbed = new RichEmbed()
    .setColor(quotedMessage.member.displayColor)
    .setAuthor(quotedMessage.author.username, quotedMessage.author.avatarURL, MessageUrl)
    .setDescription(quotedMessage.content)
    .setTimestamp(quotedMessage.createdTimestamp)
    .setFooter(`#${quotedMessage.channel.name} @ ${quotedMessage.channel.guild.name}`);
  channel.send(messageEmbed);
  if (textReply) {
    channel.send(textReply);
  }
}

client.login(DISCORD_LOGIN_TOKEN);
