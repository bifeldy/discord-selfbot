const readline = require("readline");
const { Client, RichEmbed, TextChannel, version } = require('discord.js');

const client = new Client();

// Go To Discord, Open DevTools (Ctrl + Shift + I), Under `Application` -> `Local Storage` -> `token`
// Put Your Token Here As String Into `DISCORD_LOGIN_TOKEN` Variable
let DISCORD_LOGIN_TOKEN = process.env.DISCORD_TOKEN || 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' || null;

// Discord Emoji Ping / Tag
const emojiPing = [
  '<a:angeryping:764216711943553074>',
  '<:PeepoPing:804619370209869874>',
  '<:pingblob:764216893552459796>',
  '<a:chaikaping:529354369750138881>',
  '<a:AniPing:581882192175562752>',
  '<:GWnoneAngryPing:615559148167364608>',
  '<a:LumiPing:749361418385489970>',
  '<:yutagme:518103195474722826>'
];

function shuffleArray(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;
  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}

// Bot Discriminator Farmer
async function changeDiscrim(message) {
  const currentDiscrim = client.user.discriminator;
  const check = /^(\d)(?!\1+$)\d{11}$/;
  const targetDiscrim = message.content.split(' ')[1];
  if(!(
    currentDiscrim.startsWith('000') ||
    currentDiscrim.endsWith('000') ||
    currentDiscrim == targetDiscrim ||
    check.test(currentDiscrim)
  )) {
    const guilds =  client.guilds.array();
    for (let guild of guilds) {
      console.log(`[+] Guild ${guild.id}`);
      try {
        guild = await (await guild.fetch()).fetchMembers();
        const members = guild.members.array();
        for(const member of members) {
          console.log(`    [-] ${member.user.username}#${member.user.discriminator}`);
          if(
            member.user.discriminator == currentDiscrim &&
            member.user.username !== client.user.username
          ) {
            console.log(`[=] ${member.user.username}#${member.user.discriminator}`);
            const _ = client.user.setUsername(member.user.username);
            break;
          }
        }
        if (currentDiscrim != client.user.discriminator) {
          const _ = await message.channel.send(`[🎶 New Id] ${client.user.username}#${client.user.discriminator}`);
          break;
        }
      } catch (err) {
        const _ = await message.channel.send(err.toString());
      }
    };
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

client.on("ready", async () => {
  console.log(`[✨ User Logged In] ${client.user.username}#${client.user.discriminator}`);
  console.log(`[🎉 Discord API & Token] ${version} :: ${client.token}`);
});

client.on("message", async message => {
  try {

    // Logging Message Only From What I Sent Only
    if (message.author.id === client.user.id) {
      console.log(`[${message.guild.name}] [${message.channel.name}] [${message.author.username}#${message.author.discriminator}] ${message.content}`);
    }

    // Auto Reply If Someone Tag Me With Sticker / Emoji Ping Angry
    if (
      (
        message.content.includes(`<@${client.user.id}>`) ||
        message.content.includes(`<@!${client.user.id}>`)
      ) && message.author.id !== client.user.id
    ) {
      const _ = await message.channel.send(emojiPing[Math.floor(Math.random() * emojiPing.length)]);
    }

    // Change Bot Discriminator
    else if (message.content.startsWith('!change-discrim ') && message.author.id === client.user.id) {
      changeDiscrim(message);
    }

    // Example :: Use `!quote <discord_msg_url> <ReplayMsgThat CanAlsoHave SpaceCharacter AndThisIsNotRequired>`
    // !quote https://discord.com/channels/281068107974443009/281068107974443009/767639372023201792 Reply Message Text Here
    else if (message.content.startsWith('!quote ') && message.author.id === client.user.id) {
      const _ = await message.delete();
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
        messageEmbed.setAuthor(
          `${quotedMessage.author.username}#${quotedMessage.author.discriminator}`,
          quotedMessage.author.avatarURL,
          quotedMessageUrl
        );
        messageEmbed.setDescription(quotedMessage.content);
        if (quotedMessage.attachments) {
          const attachment = quotedMessage.attachments.entries().next().value;
          if (attachment) {
            const [_, attachmentContent] = attachment;
            if (attachmentContent.height && attachmentContent.width) {
              messageEmbed.setImage(attachmentContent.url);
            } else {
              const totalFileSize = attachmentContent.filesize.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
              messageEmbed.addField(
                attachmentContent.filename,
                `File Size :: ${totalFileSize} Bytes`
              );
            }
          }
        }
        messageEmbed.setTimestamp(quotedMessage.createdTimestamp);
        messageEmbed.setFooter(`#${quotedMessage.channel.name} @ ${quotedMessage.channel.guild.name}`);
        const _ = await message.channel.send(textReply, messageEmbed);
      }
    }

    // TODO :: You Can Add Other Self Bot Command Here

  } catch (err) {
    const _ = await message.channel.send(err.toString());
  }
});

async function start() {
  try {
    const login = await client.login(DISCORD_LOGIN_TOKEN);
  } catch (err) {
    console.log(err);
    DISCORD_LOGIN_TOKEN = null;
    rl.question('[🏹 Input User Token] ', (token) => {
      DISCORD_LOGIN_TOKEN = token;
      start();
    });
  }
}

start();