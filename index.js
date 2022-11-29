const fs = require('fs');
const readline = require("readline");
const { Client, RichEmbed, TextChannel, version } = require('discord.js');

const jsonConfig = 'config.json';
const jsonFile = fs.readFileSync(jsonConfig, 'utf8');
const jsonData = JSON.parse(jsonFile);

const client = new Client();

// Go To Discord, Open DevTools (Ctrl + Shift + I), Under `Application` -> `Local Storage` -> `token`
// Put Your Token Here As String Into `DISCORD_LOGIN_TOKEN` Variable
let DISCORD_LOGIN_TOKEN = process.env.DISCORD_TOKEN || jsonData.token || null;

// Discord Emoji Ping / Tag
const emojiPing = jsonData.ping || [];

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

    // Logging Message
    if (jsonData.logging) {
      const guildDmChannelName = message.guild ? `[${message.guild.name}] [${message.channel.name}]` : '💌 DM';
      console.log(`${guildDmChannelName} [${message.author.username}#${message.author.discriminator}] ${message.content}`);
    }

    // Test Ping
    if (
      message?.content && (
        message.content == `<@${client.user.id}> ping` ||
        message.content == `<@!${client.user.id}> ping`
      )
    ) {
      const latency = new Date().getTime() - new Date(message.createdTimestamp).getTime();
      const _ = await message.channel.send(`<@${message.author.id}> Pong ${latency} ms late!`);
    }

    // Self Bot Area
    else if (
      message?.content && (
        message.content.startsWith(`<@${client.user.id}>`) ||
        message.content.startsWith(`<@!${client.user.id}>`)
      ) && message.author.id === client.user.id
    ) {

      if (message.content.startsWith(`<@${client.user.id}>`)) {
        message.content = message.content.slice(`<@${client.user.id}>`.length).trim();
      }
      else if (message.content.startsWith(`<@!${client.user.id}>`)) {
        message.content = message.content.slice(`<@!${client.user.id}>`.length).trim();
      }

      // Change Bot Discriminator
      if (message.content.startsWith('log')) {
        jsonData.logging = !jsonData.logging;
        const _ = await message.channel.send(`Logging :: ${jsonData.logging}`);
        fs.writeFileSync(jsonConfig, JSON.stringify(jsonData, null, 2));
      }

      // Change Bot Discriminator
      else if (message.content.startsWith('change-discrim ')) {
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

      // Add Emoji List For Ping
      else if (message.content.startsWith('ping ')) {
        const emojiToAdd = message.content.slice(5).trim().split(' ');
        for (const emoji of emojiToAdd) {
          if (!emojiPing.includes(emoji)) {
            emojiPing.push(emoji);
          }
        }
        fs.writeFileSync(jsonConfig, JSON.stringify(jsonData, null, 2));
        const _ = await message.channel.send(`Totals :: ${emojiPing.join('')}`);
      }

      // Upload A Files
      else if (message.content.startsWith('ddl ')) {
        const ddlToUpload = message.content.slice(4).trim();
        if (ddlToUpload) {
          const __ = await message.channel.send(`<@${message.author.id}>`, { files: [ddlToUpload] });
        }
      }

      // Example :: Use `!quote <discord_msg_url> <ReplayMsgThat CanAlsoHave SpaceCharacter AndThisIsNotRequired>`
      // !quote https://discord.com/channels/281068107974443009/281068107974443009/767639372023201792 Reply Message Text Here
      else if (message.content.startsWith('quote ')) {
        let captureRegex = null;
        if (message.content.startsWith('quote https://discordapp.com')) {
          captureRegex = /quote (https:\/\/discordapp.com\/channels\/([0-9]+)\/([0-9]+)\/([0-9]+))(.*$)/gi;
        } else if (message.content.startsWith('quote https://discord.com')) {
          captureRegex = /quote (https:\/\/discord.com\/channels\/([0-9]+)\/([0-9]+)\/([0-9]+))(.*$)/gi;
        }
        const captureResult = captureRegex.exec(message.content);
        const [rawInput, quotedMessageUrl, serverId, channelId, messageId, textReply] = captureResult;
        if (rawInput && quotedMessageUrl && serverId && channelId && messageId) {
          const quotedServer = await client.guilds.get(serverId);
          const quotedChannel = await quotedServer.channels.get(channelId);
          const textChannel = new TextChannel(quotedServer, quotedChannel);
          const quotedMessage = await textChannel.fetchMessage(messageId);
          const messageEmbed = new RichEmbed();
          messageEmbed.setColor(quotedMessage.member?.displayColor || 'WHITE');
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
        const _ = await message.delete();
      }

      // TODO :: You Can Add Other Self Bot Command Here

    }

    // Auto Reply If Someone Tag Me With Sticker / Emoji Ping Angry
    else if (
      message?.content && (
        message.content.includes(`<@${client.user.id}>`) ||
        message.content.includes(`<@!${client.user.id}>`)
      ) && message.author.id !== client.user.id
    ) {
      const _ = await message.channel.send(emojiPing[Math.floor(Math.random() * emojiPing.length)]);
    }

    // TODO :: You Can Add Other Public Bot Command Here

  } catch (err) {
    const _ = await message.channel.send(err.toString());
  }
});

async function start() {
  try {
    const login = await client.login(DISCORD_LOGIN_TOKEN);
  } catch (err) {
    console.error(err);
    DISCORD_LOGIN_TOKEN = null;
    rl.question('[🏹 Input User Token] ', (token) => {
      DISCORD_LOGIN_TOKEN = token;
      start();
    });
  }
}

start();
