const fs = require('fs');
const readline = require('readline');
const { Client, RichEmbed, TextChannel, version } = require('discord.js');
const { fastify } = require('fastify');

const jsonConfig = 'config.json';
const jsonFile = fs.readFileSync(jsonConfig, 'utf8');
const jsonData = JSON.parse(jsonFile);

const server = new fastify({ logger: jsonData.logging });
const client = new Client();

// Go To Discord, Open DevTools (Ctrl + Shift + I), Under `Application` -> `Local Storage` -> `token`
// Put Your Token Here As String Into `DISCORD_LOGIN_TOKEN` Variable
let DISCORD_LOGIN_TOKEN = process.env.DISCORD_TOKEN || jsonData.token || null;

// Discord Emoji Ping / Tag
const emojiPing = jsonData.ping || [];

// Domain
const current_domain = 'https://embed.fansub.id';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

server.get('/oembed', (req, res) => {
  res.code(200).header('Content-Type', 'application/json; charset=utf-8').send({
    author_name: req.query.author_name,
    author_url: req.query.author_url,
    provider_name: req.query.site_name,
    provider_url: req.query.site_url
  });
});

server.get('/', (req, res) => {
  const site_name = req.query.site_name || '「💤 Fansub ✨ ID 🌞」';
  const site_url = req.query.site_url || 'https://fansub.id';
  const title = req.query.title || '「💤 Fansub ✨ ID 🌞」';
  const descriptions = req.query.descriptions || '「💤 Fansub ✨ ID 🌞」';
  const author_name = req.query.author_name || '「💤 Fansub ✨ ID 🌞」';
  const author_url = req.query.author_url || 'https://fansub.id';
  const image_url = req.query.image_url || 'https://fansub.id/assets/img/favicon.png';
  const icon_url = req.query.icon_url || 'https://fansub.id/favicon.ico';
  res.code(200).header('Content-Type', 'text/html; charset=utf-8').send(`
    <!DOCTYPE html>
    <html lang="in">

      <head>
        <base href="/" />

        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta http-equiv="refresh" content="0; url=${site_url}" />

        <meta name="viewport" property="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" property="theme-color" content="#3f51b5" />

        <!-- Site Settings -->
        <title>${title}</title>

        <link rel="shortcut icon" href="${icon_url}" />
        <link rel="icon" href="${icon_url}" />
        <link rel="canonical" href="${site_url}" />
        <link
          rel="alternate"
          href="${current_domain}/oembed?author_name=${encodeURIComponent(author_name)}&author_url=${encodeURIComponent(author_url)}&site_name=${encodeURIComponent(site_name)}&site_url=${encodeURIComponent(site_url)}"
          type="application/json+oembed"
          title="${title}"
        />

        <!-- Search Engine Settings -->
        <meta name="description" property="description" content="${descriptions}" />
        <meta name="keywords" property="keywords" content="${descriptions}" />
        <meta name="copyright" property="copyright" content="${site_name}" />
        <meta name="author" property="author" content="${author_name}" />

        <!-- Open Graph Protocol -->
        <meta name="og:site_name" property="og:site_name" content="${site_name}" />
        <meta name="og:title" property="og:title" content="${title}" />
        <meta name="og:description" property="og:description" content="${descriptions}" />
        <meta name="og:image" property="og:image" content="${image_url?.trim() ? image_url : icon_url}" />
        <meta name="og:url" property="og:url" content="${site_url}" />

        <!-- Twitter Card -->
        <meta name="twitter:site" property="twitter:site" content="${site_name}">
        <meta name="twitter:title" property="twitter:title" content="${title}" />
        <meta name="twitter:description" property="twitter:description" content="${descriptions}" />
        <meta name="twitter:image" property="twitter:image" content="${image_url?.trim() ? image_url : icon_url}" />
        <meta name="twitter:card" property="twitter:card" content="${image_url?.trim() ? 'summary_large_image' : 'summary'}" />
        <meta name="twitter:creator" property="twitter:creator" content="${author_name}" />

        <!-- Icon In The Highest Resolution We Need It For -->
        <link rel="icon" sizes="192x192" href="${icon_url}" />

        <!-- Reuse Same Icon For Safari -->
        <link rel="apple-touch-icon" href="${icon_url}" />
        <link rel="apple-touch-startup-image" href="${icon_url}" />

        <!-- Multiple Icons For IE -->
        <meta name="msapplication-square310x310logo" content="${icon_url}" />
      </head>

      <body>
        <!-- Empty -->
      </body>

    </html>
  `);
});

client.on('ready', async () => {
  console.log(`[✨ User Logged In] ${client.user.username}#${client.user.discriminator}`);
  console.log(`[🎉 Discord API & Token] ${version} :: ${client.token}`);
});

client.on('message', async message => {
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
        jsonData.ping = emojiPing;
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
          // const messageEmbed = new RichEmbed();
          // messageEmbed.setColor(quotedMessage.member?.displayColor || 'WHITE');
          // messageEmbed.setAuthor(
          //   `${quotedMessage.author.username}#${quotedMessage.author.discriminator}`,
          //   quotedMessage.author.avatarURL,
          //   quotedMessageUrl
          // );
          // messageEmbed.setDescription(quotedMessage.content);
          const site_name = `#${quotedMessage.channel.name} @ ${quotedMessage.channel.guild.name} ~ ${new Date(quotedMessage.createdTimestamp).toUTCString()}`;
          const site_url = quotedMessageUrl;
          const title = ' ';
          const descriptions = quotedMessage.content;
          const author_name = `${quotedMessage.author.username}#${quotedMessage.author.discriminator}`;
          const author_url = `https://discord.com/users/${quotedMessage.author.id}`;
          let image_url = ' ';
          const icon_url = quotedMessage.author.avatarURL;
          if (quotedMessage.attachments) {
            const attachment = quotedMessage.attachments.entries().next().value;
            if (attachment) {
              const [_, attachmentContent] = attachment;
              if (attachmentContent.height && attachmentContent.width) {
                // messageEmbed.setImage(attachmentContent.url);
                image_url = attachmentContent.url;
              } else {
                // const totalFileSize = attachmentContent.filesize.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',');
                // messageEmbed.addField(
                //   attachmentContent.filename,
                //   `File Size :: ${totalFileSize} Bytes`
                // );
              }
            }
          }
          // messageEmbed.setTimestamp(quotedMessage.createdTimestamp);
          // messageEmbed.setFooter(`#${quotedMessage.channel.name} @ ${quotedMessage.channel.guild.name}`);
          // const _ = await message.channel.send(textReply, messageEmbed);
          let urlParam = ``;
          urlParam += `site_name=${encodeURIComponent(site_name)}`;
          urlParam += `&site_url=${encodeURIComponent(site_url)}`;
          urlParam += `&title=${encodeURIComponent(title)}`;
          urlParam += `&descriptions=${encodeURIComponent(descriptions)}`;
          urlParam += `&author_name=${encodeURIComponent(author_name)}`;
          urlParam += `&author_url=${encodeURIComponent(author_url)}`;
          urlParam += `&image_url=${encodeURIComponent(image_url)}`;
          urlParam += `&icon_url=${encodeURIComponent(icon_url)}`;
          const _ = await message.channel.send(`${textReply} ||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​|| _ _ _ _ _ _ ${current_domain}/?${urlParam}`);
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
  await server.listen({ port: process.env['PORT'] || 3001 }, (err, addr) => {
    if (err) {
      console.error(err);
    }
    console.log(`[🌐 Server Listen] ${addr}`);
  });
}

start();
